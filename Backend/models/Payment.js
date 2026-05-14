const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    booking:  { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
    worker:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },

    // Razorpay IDs
    razorpayOrderId:   { type: String, required: true },
    razorpayPaymentId: { type: String, default: '' },
    razorpaySignature: { type: String, default: '' },

    amount:     { type: Number, required: true }, // total in ₹
    commission: { type: Number, required: true }, // platform cut
    workerPay:  { type: Number, required: true }, // worker's share

    currency: { type: String, default: 'INR' },
    method:   { type: String, default: '' }, // upi / card / netbanking

    status: {
      type:    String,
      enum:    ['created', 'paid', 'failed', 'refunded'],
      default: 'created',
    },

    paidAt:     { type: Date },
    refundedAt: { type: Date },
    refundId:   { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);