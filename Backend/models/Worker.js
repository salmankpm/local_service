const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema(
  {
    user: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      unique:   true,
    },

    skills:      [{ type: String, trim: true }],
    bio:         { type: String, maxlength: 600, default: '' },
    experience:  { type: Number, default: 0 },   // years
    hourlyRate:  { type: Number, default: 0 },   // ₹
    serviceRadius: { type: Number, default: 5 }, // km

    isAvailable: { type: Boolean, default: true  },
    isApproved:  { type: Boolean, default: false }, // admin must approve
    isSuspended: { type: Boolean, default: false },

    // Documents uploaded (Aadhaar, certificates)
    documents: [{ type: String }],

    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count:   { type: Number, default: 0 },
    },

    earnings: {
      total:     { type: Number, default: 0 },
      pending:   { type: Number, default: 0 },
      withdrawn: { type: Number, default: 0 },
    },

    // Bank/UPI details for payout
    payoutInfo: {
      upiId:       { type: String, default: '' },
      bankAccount: { type: String, default: '' },
      ifsc:        { type: String, default: '' },
    },
  },
  { timestamps: true }
);

// Auto-recalculate average rating
workerSchema.methods.recalcRating = async function () {
  const Review = mongoose.model('Review');
  const stats  = await Review.aggregate([
    { $match: { worker: this._id } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  this.rating.average = stats[0] ? Math.round(stats[0].avg * 10) / 10 : 0;
  this.rating.count   = stats[0] ? stats[0].count : 0;
  await this.save();
};

module.exports = mongoose.model('Worker', workerSchema);