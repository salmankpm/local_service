const asyncHandler     = require('express-async-handler');
const Payment          = require('../models/Payment');
const Booking          = require('../models/Booking');
const Worker           = require('../models/Worker');
const paymentService   = require('../services/paymentService');
const { notifyPaymentSuccess } = require('../services/notificationService');

// ─────────────────────────────────────────────
//  @route  POST /api/payments/create-order
//  @access Private (user)
// ─────────────────────────────────────────────
const createOrder = asyncHandler(async (req, res) => {
  const { bookingId } = req.body;

  const booking = await Booking.findById(bookingId);
  if (!booking)        { res.status(404); throw new Error('Booking not found'); }
  if (booking.isPaid)  { res.status(400); throw new Error('Already paid'); }
  if (String(booking.user) !== String(req.user._id)) {
    res.status(403); throw new Error('Not your booking');
  }

  const order = await paymentService.createOrder(booking.amount, `sewa_${bookingId}`);

  // Save payment record
  await Payment.create({
    booking:           bookingId,
    user:              req.user._id,
    worker:            booking.worker,
    razorpayOrderId:   order.id,
    amount:            booking.amount,
    commission:        booking.commission,
    workerPay:         booking.workerPay,
  });

  res.json({
    success:  true,
    orderId:  order.id,
    amount:   booking.amount,
    currency: 'INR',
    keyId:    process.env.RAZORPAY_KEY_ID,
  });
});

// ─────────────────────────────────────────────
//  @route  POST /api/payments/verify
//  @access Private (user)
// ─────────────────────────────────────────────
const verifyPayment = asyncHandler(async (req, res) => {
  const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  // Verify Razorpay signature
  const isValid = paymentService.verifySignature(
    razorpay_order_id, razorpay_payment_id, razorpay_signature
  );
  if (!isValid) { res.status(400); throw new Error('Payment verification failed'); }

  // Update payment record
  const payment = await Payment.findOneAndUpdate(
    { razorpayOrderId: razorpay_order_id },
    {
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      status:  'paid',
      paidAt:  new Date(),
    },
    { new: true }
  );

  // Mark booking as paid
  const booking = await Booking.findByIdAndUpdate(
    bookingId,
    { isPaid: true, paymentId: razorpay_payment_id },
    { new: true }
  ).populate('user', 'name fcmToken');

  // Credit worker pending earnings
  await Worker.findOneAndUpdate(
    { user: booking.worker },
    { $inc: { 'earnings.total': payment.workerPay, 'earnings.pending': payment.workerPay } }
  );

  // Push notification to user
  await notifyPaymentSuccess(booking.user.fcmToken, booking.amount);

  // Real-time socket
  const io = req.app.get('io');
  io.to(`booking:${bookingId}`).emit('payment-success', { bookingId, amount: booking.amount });

  res.json({ success: true, payment, booking });
});

// ─────────────────────────────────────────────
//  @route  POST /api/payments/refund/:paymentId (Admin)
//  @access Admin
// ─────────────────────────────────────────────
const refundPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.paymentId);
  if (!payment)              { res.status(404); throw new Error('Payment not found'); }
  if (payment.status !== 'paid') { res.status(400); throw new Error('Only paid payments can be refunded'); }

  const refund = await paymentService.refundPayment(
    payment.razorpayPaymentId, payment.amount
  );

  payment.status     = 'refunded';
  payment.refundedAt = new Date();
  payment.refundId   = refund.id;
  await payment.save();

  // Deduct from worker earnings
  await Worker.findOneAndUpdate(
    { user: payment.worker },
    { $inc: { 'earnings.total': -payment.workerPay, 'earnings.pending': -payment.workerPay } }
  );

  res.json({ success: true, refund });
});

// ─────────────────────────────────────────────
//  @route  GET /api/payments              (Admin)
//  @access Admin
// ─────────────────────────────────────────────
const getAllPayments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const total    = await Payment.countDocuments(filter);
  const payments = await Payment.find(filter)
    .populate('user',    'name phone')
    .populate('worker',  'name phone')
    .populate('booking', 'service scheduledAt')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json({ success: true, total, page: Number(page), payments });
});

module.exports = { createOrder, verifyPayment, refundPayment, getAllPayments };