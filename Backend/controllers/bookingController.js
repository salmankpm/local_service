const asyncHandler  = require('express-async-handler');
const Booking       = require('../models/Booking');
const Worker        = require('../models/Worker');
const User          = require('../models/User');
const {
  notifyNewBooking,
  notifyBookingAccepted,
  notifyBookingCompleted,
} = require('../services/notificationService');

// ─────────────────────────────────────────────
//  @route  POST /api/bookings
//  @access Private (user)
// ─────────────────────────────────────────────
const createBooking = asyncHandler(async (req, res) => {
  const { workerId, service, description, scheduledAt, address, lat, lng, amount } = req.body;

  const workerUser   = await User.findById(workerId);
  const workerProfile= await Worker.findOne({ user: workerId });
  if (!workerUser || !workerProfile)  { res.status(404); throw new Error('Worker not found'); }
  if (!workerProfile.isAvailable)     { res.status(400); throw new Error('Worker not available'); }

  const finalAmount = amount || workerProfile.hourlyRate || 300;

  const booking = await Booking.create({
    user:        req.user._id,
    worker:      workerId,
    service,
    description,
    scheduledAt: new Date(scheduledAt),
    address,
    amount:      finalAmount,
    location: (lat && lng)
      ? { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }
      : undefined,
  });

  await booking.populate([
    { path: 'user',   select: 'name phone avatar' },
    { path: 'worker', select: 'name phone avatar fcmToken' },
  ]);

  // Real-time socket notification
  const io = req.app.get('io');
  io.to(`worker:${workerId}`).emit('new-booking', {
    bookingId: booking._id,
    service,
    user:      req.user.name,
    scheduledAt,
    address,
  });

  // Push notification
  await notifyNewBooking(workerUser.fcmToken, req.user.name, service);

  res.status(201).json({ success: true, booking });
});

// ─────────────────────────────────────────────
//  @route  GET /api/bookings
//  @access Private
// ─────────────────────────────────────────────
const getMyBookings = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  const filter = req.user.role === 'worker'
    ? { worker: req.user._id }
    : { user:   req.user._id };

  if (status) filter.status = status;

  const total    = await Booking.countDocuments(filter);
  const bookings = await Booking.find(filter)
    .populate('user',   'name phone avatar')
    .populate('worker', 'name phone avatar')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json({ success: true, total, page: Number(page), bookings });
});

// ─────────────────────────────────────────────
//  @route  GET /api/bookings/all   (Admin)
//  @access Admin
// ─────────────────────────────────────────────
const getAllBookings = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20, search } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const total    = await Booking.countDocuments(filter);
  const bookings = await Booking.find(filter)
    .populate('user',   'name phone')
    .populate('worker', 'name phone')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json({ success: true, total, page: Number(page), bookings });
});

// ─────────────────────────────────────────────
//  @route  GET /api/bookings/:id
//  @access Private
// ─────────────────────────────────────────────
const getBookingById = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('user',   'name phone avatar')
    .populate('worker', 'name phone avatar');
  if (!booking) { res.status(404); throw new Error('Booking not found'); }
  res.json({ success: true, booking });
});

// ─────────────────────────────────────────────
//  @route  PUT /api/bookings/:id/status
//  @access Private (worker)
// ─────────────────────────────────────────────
const updateBookingStatus = asyncHandler(async (req, res) => {
  const { status, cancelReason } = req.body;
  const booking = await Booking.findById(req.params.id).populate('user', 'name fcmToken');
  if (!booking) { res.status(404); throw new Error('Booking not found'); }

  if (req.user.role === 'user') {
    if (booking.user._id.toString() !== req.user._id.toString()) {
      res.status(403); throw new Error('Not authorized to update this booking');
    }
    if (status !== 'cancelled') {
      res.status(403); throw new Error('Users can only cancel bookings');
    }
  }

  booking.status = status;
  if (status === 'accepted')    booking.acceptedAt  = new Date();
  if (status === 'in-progress') booking.startedAt   = new Date();
  if (status === 'completed')   booking.completedAt = new Date();
  if (status === 'cancelled') {
    booking.cancelledAt  = new Date();
    booking.cancelReason = cancelReason || '';
  }
  await booking.save();

  // Real-time socket update
  const io = req.app.get('io');
  io.to(`booking:${booking._id}`).emit('booking-update', { bookingId: booking._id, status });

  // Push notifications
  if (status === 'accepted')  await notifyBookingAccepted(booking.user.fcmToken, req.user.name);
  if (status === 'completed') await notifyBookingCompleted(booking.user.fcmToken, booking.service);

  // Credit worker earnings when completed
  if (status === 'completed') {
    await Worker.findOneAndUpdate(
      { user: booking.worker },
      { $inc: { 'earnings.total': booking.workerPay, 'earnings.pending': booking.workerPay } }
    );
  }

  res.json({ success: true, status: booking.status });
});

// ─────────────────────────────────────────────
//  @route  POST /api/bookings/:id/message
//  @access Private
// ─────────────────────────────────────────────
const sendMessage = asyncHandler(async (req, res) => {
  const { text } = req.body;
  const booking  = await Booking.findById(req.params.id);
  if (!booking) { res.status(404); throw new Error('Booking not found'); }

  const msg = { sender: req.user._id, text, sentAt: new Date() };
  booking.messages.push(msg);
  await booking.save();

  // Real-time socket
  const io = req.app.get('io');
  io.to(`booking:${booking._id}`).emit('new-message', {
    sender: req.user.name,
    text,
    sentAt: msg.sentAt,
  });

  res.json({ success: true, message: msg });
});

module.exports = {
  createBooking, getMyBookings, getAllBookings,
  getBookingById, updateBookingStatus, sendMessage,
};