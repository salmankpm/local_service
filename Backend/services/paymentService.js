const Razorpay = require('razorpay');
const crypto   = require('crypto');

// Check if we are in demo mode (using dummy keys)
const isDemoMode = !process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID.includes('xxxx');

// Initialise Razorpay instance only if not in demo mode
let razorpay;
if (!isDemoMode) {
  razorpay = new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

/**
 * Create a Razorpay order
 * @param {number} amount  - amount in ₹ (converted to paise internally)
 * @param {string} receipt - unique receipt string (e.g. bookingId)
 */
const createOrder = async (amount, receipt) => {
  if (isDemoMode) {
    return {
      id: `order_mock_${Date.now()}`,
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt,
      status: 'created'
    };
  }

  const order = await razorpay.orders.create({
    amount:   Math.round(amount * 100), // paise
    currency: 'INR',
    receipt,
  });
  return order;
};

/**
 * Verify Razorpay payment signature
 * @returns {boolean}
 */
const verifySignature = (razorpayOrderId, razorpayPaymentId, razorpaySignature) => {
  if (isDemoMode && razorpayOrderId.startsWith('order_mock_')) {
    return true; // Auto-verify in demo mode
  }

  const body      = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected  = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  return expected === razorpaySignature;
};

/**
 * Fetch payment details from Razorpay
 */
const fetchPayment = async (paymentId) => {
  if (isDemoMode && paymentId.startsWith('pay_mock_')) {
    return { id: paymentId, status: 'captured', amount: 1000 };
  }
  return razorpay.payments.fetch(paymentId);
};

/**
 * Initiate refund
 */
const refundPayment = async (paymentId, amount) => {
  if (isDemoMode) {
    return { id: `rfnd_mock_${Date.now()}`, status: 'processed', amount: Math.round(amount * 100) };
  }
  return razorpay.payments.refund(paymentId, { amount: Math.round(amount * 100) });
};

module.exports = { createOrder, verifySignature, fetchPayment, refundPayment };