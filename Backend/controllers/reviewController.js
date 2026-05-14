const asyncHandler = require('express-async-handler');
const Review       = require('../models/Review');
const Booking      = require('../models/Booking');
const Worker       = require('../models/Worker');

// ─────────────────────────────────────────────
//  @route  POST /api/reviews
//  @access Private (user)
// ─────────────────────────────────────────────
const createReview = asyncHandler(async (req, res) => {
  const { bookingId, rating, comment } = req.body;

  // Validate booking
  const booking = await Booking.findById(bookingId);
  if (!booking)                                     { res.status(404); throw new Error('Booking not found'); }
  if (String(booking.user) !== String(req.user._id)){ res.status(403); throw new Error('Not your booking'); }
  if (booking.status !== 'completed')               { res.status(400); throw new Error('Booking not completed yet'); }
  if (booking.isReviewed)                           { res.status(400); throw new Error('Already reviewed'); }

  // Find worker profile for ref
  const workerProfile = await Worker.findOne({ user: booking.worker });
  if (!workerProfile) { res.status(404); throw new Error('Worker profile not found'); }

  const review = await Review.create({
    booking: bookingId,
    user:    req.user._id,
    worker:  workerProfile._id,
    rating,
    comment,
  });

  // Mark booking as reviewed
  booking.isReviewed = true;
  await booking.save();

  res.status(201).json({ success: true, review });
});

// ─────────────────────────────────────────────
//  @route  GET /api/reviews/worker/:workerId
//  @access Public
// ─────────────────────────────────────────────
const getWorkerReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const total   = await Review.countDocuments({ worker: req.params.workerId });
  const reviews = await Review.find({ worker: req.params.workerId })
    .populate('user', 'name avatar')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json({ success: true, total, page: Number(page), reviews });
});

// ─────────────────────────────────────────────
//  @route  GET /api/reviews/my
//  @access Private (user)
// ─────────────────────────────────────────────
const getMyReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ user: req.user._id })
    .populate('worker')
    .sort({ createdAt: -1 });
  res.json({ success: true, reviews });
});

// ─────────────────────────────────────────────
//  @route  DELETE /api/reviews/:id   (Admin)
//  @access Admin
// ─────────────────────────────────────────────
const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) { res.status(404); throw new Error('Review not found'); }
  await review.deleteOne();

  // Recalc worker rating
  const workerProfile = await Worker.findById(review.worker);
  if (workerProfile) await workerProfile.recalcRating();

  res.json({ success: true, message: 'Review deleted' });
});

module.exports = { createReview, getWorkerReviews, getMyReviews, deleteReview };