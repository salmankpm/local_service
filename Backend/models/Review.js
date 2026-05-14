const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
    worker:  { type: mongoose.Schema.Types.ObjectId, ref: 'Worker',  required: true },
    rating:  { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, maxlength: 500, default: '' },
  },
  { timestamps: true }
);

// After saving a review, recalculate the worker's average rating
reviewSchema.post('save', async function () {
  try {
    const worker = await mongoose.model('Worker').findById(this.worker);
    if (worker) await worker.recalcRating();
  } catch (err) {
    console.error('Rating recalc error:', err.message);
  }
});

module.exports = mongoose.model('Review', reviewSchema);