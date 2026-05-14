const asyncHandler      = require('express-async-handler');
const Worker            = require('../models/Worker');
const User              = require('../models/User');
const Review            = require('../models/Review');
const { buildGeoQuery, annotateWithDistance, parseCoords } = require('../services/locationService');

// ─────────────────────────────────────────────
//  @route  GET /api/workers
//  @access Public
//  Query: lat, lng, radius(km), skill, page, limit
// ─────────────────────────────────────────────
const getWorkers = asyncHandler(async (req, res) => {
  const { skill, radius = 5, page = 1, limit = 20, sort = 'rating' } = req.query;
  const coords = parseCoords(req.query);

  // Build worker filter
  const workerFilter = { isApproved: true, isSuspended: false };
  if (skill) workerFilter.skills = { $regex: skill, $options: 'i' };

  // Build user/location filter
  const userFilter = { isActive: true };
  if (coords) userFilter.location = buildGeoQuery(coords.lat, coords.lng, radius);

  // Find matching users first (geo-filtered)
  const matchingUsers = await User.find(userFilter).select('_id');
  const userIds = matchingUsers.map((u) => u._id);

  // Find workers for those users
  const sortMap = {
    rating:    { 'rating.average': -1 },
    price_asc: { hourlyRate: 1 },
    price_desc:{ hourlyRate: -1 },
    newest:    { createdAt: -1 },
  };

  const total   = await Worker.countDocuments({ ...workerFilter, user: { $in: userIds } });
  const workers = await Worker.find({ ...workerFilter, user: { $in: userIds } })
    .populate('user', 'name phone avatar location')
    .sort(sortMap[sort] || sortMap.rating)
    .skip((page - 1) * limit)
    .limit(Number(limit));

  // Annotate with distance if coords supplied
  const result = coords
    ? annotateWithDistance(workers, coords.lat, coords.lng)
    : workers.map((w) => w.toObject());

  res.json({ success: true, total, page: Number(page), workers: result });
});

// ─────────────────────────────────────────────
//  @route  GET /api/workers/:id
//  @access Public
// ─────────────────────────────────────────────
const getWorkerById = asyncHandler(async (req, res) => {
  const worker = await Worker.findById(req.params.id)
    .populate('user', 'name phone avatar location createdAt');
  if (!worker) { res.status(404); throw new Error('Worker not found'); }

  const reviews = await Review.find({ worker: worker._id })
    .populate('user', 'name avatar')
    .sort({ createdAt: -1 })
    .limit(10);

  res.json({ success: true, worker, reviews });
});

// ─────────────────────────────────────────────
//  @route  POST /api/workers/register
//  @access Private (user)
// ─────────────────────────────────────────────
const registerAsWorker = asyncHandler(async (req, res) => {
  const { skills, bio, experience, hourlyRate, serviceRadius } = req.body;

  const exists = await Worker.findOne({ user: req.user._id });
  if (exists) { res.status(409); throw new Error('Already registered as a worker'); }

  const worker = await Worker.create({
    user: req.user._id,
    skills: Array.isArray(skills) ? skills : [skills],
    bio, experience, hourlyRate, serviceRadius,
  });

  await User.findByIdAndUpdate(req.user._id, { role: 'worker' });
  res.status(201).json({ success: true, worker });
});

// ─────────────────────────────────────────────
//  @route  PUT /api/workers/profile
//  @access Private (worker)
// ─────────────────────────────────────────────
const updateWorkerProfile = asyncHandler(async (req, res) => {
  const { skills, bio, experience, hourlyRate, serviceRadius, payoutInfo } = req.body;

  const worker = await Worker.findOneAndUpdate(
    { user: req.user._id },
    { skills, bio, experience, hourlyRate, serviceRadius, payoutInfo },
    { new: true, runValidators: true }
  );
  if (!worker) { res.status(404); throw new Error('Worker profile not found'); }
  res.json({ success: true, worker });
});

// ─────────────────────────────────────────────
//  @route  PUT /api/workers/availability
//  @access Private (worker)
// ─────────────────────────────────────────────
const setAvailability = asyncHandler(async (req, res) => {
  const { isAvailable } = req.body;
  const worker = await Worker.findOneAndUpdate(
    { user: req.user._id },
    { isAvailable },
    { new: true }
  );
  res.json({ success: true, isAvailable: worker.isAvailable });
});

// ─────────────────────────────────────────────
//  @route  PUT /api/workers/:id/approve   (Admin)
//  @access Admin
// ─────────────────────────────────────────────
const approveWorker = asyncHandler(async (req, res) => {
  const worker = await Worker.findByIdAndUpdate(
    req.params.id,
    { isApproved: true },
    { new: true }
  );
  if (!worker) { res.status(404); throw new Error('Worker not found'); }
  res.json({ success: true, worker });
});

// ─────────────────────────────────────────────
//  @route  PUT /api/workers/:id/suspend   (Admin)
//  @access Admin
// ─────────────────────────────────────────────
const suspendWorker = asyncHandler(async (req, res) => {
  const worker = await Worker.findByIdAndUpdate(
    req.params.id,
    { isSuspended: !( await Worker.findById(req.params.id) ).isSuspended },
    { new: true }
  );
  res.json({ success: true, isSuspended: worker.isSuspended });
});

// ─────────────────────────────────────────────
//  @route  POST /api/workers/upload-doc
//  @access Private (worker)
// ─────────────────────────────────────────────
const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) { res.status(400); throw new Error('No file uploaded'); }
  const fileUrl = `/uploads/${req.file.filename}`;
  await Worker.findOneAndUpdate(
    { user: req.user._id },
    { $push: { documents: fileUrl } }
  );
  res.json({ success: true, fileUrl });
});

// ─────────────────────────────────────────────
//  @route  POST /api/workers/admin-create
//  @access Admin
// ─────────────────────────────────────────────
const adminCreateWorker = asyncHandler(async (req, res) => {
  const { name, phone, password, skills, hourlyRate, experience, bio } = req.body;
  if (!name || !phone || !password) { res.status(400); throw new Error('Name, phone, and password are required'); }

  const exists = await User.findOne({ phone });
  if (exists) { res.status(409); throw new Error('Phone already registered'); }

  const user = await User.create({
    name,
    phone,
    passwordHash: password, // Pre-save hook hashes it
    role: 'worker',
    isVerified: true,
    isActive: true,
  });

  const worker = await Worker.create({
    user: user._id,
    skills: Array.isArray(skills) ? skills : (skills || '').split(',').map(s => s.trim()).filter(Boolean),
    hourlyRate: Number(hourlyRate) || 0,
    experience: Number(experience) || 0,
    bio: bio || '',
    isApproved: true,
    isAvailable: true,
  });

  await worker.populate('user', 'name phone avatar location createdAt');

  res.status(201).json({ success: true, worker });
});

module.exports = {
  getWorkers, getWorkerById, registerAsWorker,
  updateWorkerProfile, setAvailability,
  approveWorker, suspendWorker, uploadDocument, adminCreateWorker
};