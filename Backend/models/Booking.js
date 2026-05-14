const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sender:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text:    { type: String, required: true },
    sentAt:  { type: Date, default: Date.now },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
    worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },

    service:     { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    scheduledAt: { type: Date,   required: true },
    address:     { type: String, required: true },

    location: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
    },

    status: {
      type:    String,
      enum:    ['pending', 'accepted', 'rejected', 'in-progress', 'completed', 'cancelled'],
      default: 'pending',
    },

    amount:     { type: Number, default: 0 },
    commission: { type: Number, default: 0 }, // 15% platform fee
    workerPay:  { type: Number, default: 0 }, // amount - commission

    isPaid:    { type: Boolean, default: false },
    paymentId: { type: String,  default: '' },

    isReviewed:  { type: Boolean, default: false },

    // In-app chat messages for this booking
    messages: [messageSchema],

    // Timestamps for status changes
    acceptedAt:   { type: Date },
    startedAt:    { type: Date },
    completedAt:  { type: Date },
    cancelledAt:  { type: Date },
    cancelReason: { type: String, default: '' },
  },
  { timestamps: true }
);

bookingSchema.index({ location: '2dsphere' });

// Pre-save: auto-calculate commission and workerPay
bookingSchema.pre('save', function (next) {
  if (this.isModified('amount')) {
    this.commission = Math.round(this.amount * 0.15);
    this.workerPay  = this.amount - this.commission;
  }
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);