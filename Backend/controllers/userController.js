const asyncHandler = require('express-async-handler');
const User         = require('../models/User');
const Booking      = require('../models/Booking');

// ─────────────────────────────────────────────
//  @route  GET /api/users/profile
//  @access Private
// ─────────────────────────────────────────────
const getProfile = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
});

// ─────────────────────────────────────────────
//  @route  PUT /api/users/profile
//  @access Private
// ─────────────────────────────────────────────
const updateProfile = asyncHandler(async (req, res) => {
  const { name, email, avatar, address, lat, lng } = req.body;

  const user = await User.findById(req.user._id);
  if (!user) { res.status(404); throw new Error('User not found'); }

  if (name)   user.name  = name;
  if (email)  user.email = email;
  if (avatar) user.avatar = avatar;
  if (address || (lat && lng)) {
    user.location = {
      type:        'Point',
      coordinates: [parseFloat(lng || 0), parseFloat(lat || 0)],
      address:     address || user.location.address,
    };
  }

  await user.save();
  res.json({ success: true, user });
});

// ─────────────────────────────────────────────
//  @route  PUT /api/users/change-password
//  @access Private
// ─────────────────────────────────────────────
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+passwordHash');

  if (!(await user.matchPassword(currentPassword))) {
    res.status(401); throw new Error('Current password incorrect');
  }
  user.passwordHash = newPassword;
  await user.save();
  res.json({ success: true, message: 'Password updated' });
});

// ─────────────────────────────────────────────
//  @route  GET /api/users                (Admin)
//  @access Admin
// ─────────────────────────────────────────────
const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, role, search } = req.query;
  const filter = {};
  if (role)   filter.role = role;
  if (search) filter.$or  = [
    { name:  { $regex: search, $options: 'i' } },
    { phone: { $regex: search, $options: 'i' } },
    { email: { $regex: search, $options: 'i' } },
  ];

  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.json({ success: true, total, page: Number(page), users });
});

// ─────────────────────────────────────────────
//  @route  PUT /api/users/:id/toggle-active (Admin)
//  @access Admin
// ─────────────────────────────────────────────
const toggleUserActive = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) { res.status(404); throw new Error('User not found'); }
  user.isActive = !user.isActive;
  await user.save();
  res.json({ success: true, isActive: user.isActive });
});

// ─────────────────────────────────────────────
//  @route  GET /api/users/:id/bookings    (Admin)
//  @access Admin
// ─────────────────────────────────────────────
const getUserBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ user: req.params.id })
    .populate('worker', 'name phone')
    .sort({ createdAt: -1 });
  res.json({ success: true, bookings });
});

module.exports = {
  getProfile, updateProfile, changePassword,
  getAllUsers, toggleUserActive, getUserBookings,
};