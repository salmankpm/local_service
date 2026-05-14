const asyncHandler    = require('express-async-handler');
const User            = require('../models/User');
const generateToken   = require('../utils/generateToken');
const { sendOTPSms }  = require('../services/notificationService');

// ── Generate 6-digit OTP ──────────────────────
const makeOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ─────────────────────────────────────────────
//  @route  POST /api/auth/send-otp
//  @access Public
// ─────────────────────────────────────────────
const sendOTP = asyncHandler(async (req, res) => {
  const { phone } = req.body;
  if (!phone) { res.status(400); throw new Error('Phone number is required'); }

  const otp       = makeOTP();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Upsert user so we can store OTP
  await User.findOneAndUpdate(
    { phone },
    { otp, otpExpiresAt: expiresAt },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await sendOTPSms(phone, otp);
  res.json({ success: true, message: 'OTP sent successfully' });
});

// ─────────────────────────────────────────────
//  @route  POST /api/auth/verify-otp
//  @access Public
// ─────────────────────────────────────────────
const verifyOTP = asyncHandler(async (req, res) => {
  const { phone, otp, name } = req.body;
  if (!phone || !otp) { res.status(400); throw new Error('Phone and OTP required'); }

  const user = await User.findOne({ phone }).select('+otp +otpExpiresAt');
  if (!user)                           { res.status(404); throw new Error('User not found'); }
  if (user.otp !== otp)               { res.status(400); throw new Error('Invalid OTP'); }
  if (new Date() > user.otpExpiresAt) { res.status(400); throw new Error('OTP expired'); }

  user.isVerified = true;
  user.otp        = undefined;
  user.otpExpiresAt = undefined;
  if (name && !user.name) user.name = name;
  await user.save();

  res.json({
    success: true,
    token:   generateToken(user._id, user.role),
    user,
  });
});

// ─────────────────────────────────────────────
//  @route  POST /api/auth/register
//  @access Public
// ─────────────────────────────────────────────
const register = asyncHandler(async (req, res) => {
  const { name, phone, email, password, role } = req.body;
  if (!name || !phone) { res.status(400); throw new Error('Name and phone are required'); }

  const exists = await User.findOne({ phone });
  if (exists) { res.status(409); throw new Error('Phone already registered'); }

  const userObj = { name, phone };
  if (email) userObj.email = email;
  if (password) userObj.passwordHash = password;
  if (role) userObj.role = role;

  const user = await User.create(userObj);

  if (user.role === 'worker') {
    const Worker = require('../models/Worker');
    await Worker.create({
      user: user._id,
      skills: ['General Service'],
      isApproved: true,
      isAvailable: true,
    });
  }

  res.status(201).json({
    success: true,
    token:   generateToken(user._id, user.role),
    user,
  });
});

// ─────────────────────────────────────────────
//  @route  POST /api/auth/login
//  @access Public
// ─────────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) { res.status(400); throw new Error('Phone and password required'); }

  const user = await User.findOne({ phone }).select('+passwordHash');
  if (!user || !(await user.matchPassword(password))) {
    res.status(401); throw new Error('Invalid credentials');
  }
  if (!user.isActive) { res.status(403); throw new Error('Account suspended'); }

  res.json({
    success: true,
    token:   generateToken(user._id, user.role),
    user,
  });
});

// ─────────────────────────────────────────────
//  @route  GET /api/auth/me
//  @access Private
// ─────────────────────────────────────────────
const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
});

// ─────────────────────────────────────────────
//  @route  PUT /api/auth/update-fcm
//  @access Private
// ─────────────────────────────────────────────
const updateFcmToken = asyncHandler(async (req, res) => {
  const { fcmToken } = req.body;
  await User.findByIdAndUpdate(req.user._id, { fcmToken });
  res.json({ success: true });
});

module.exports = { sendOTP, verifyOTP, register, login, getMe, updateFcmToken };