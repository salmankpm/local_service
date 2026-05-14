const jwt      = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User     = require('../models/User');

/**
 * protect — verifies JWT, attaches req.user
 */
const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401);
    throw new Error('Not authorised — no token');
  }

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-passwordHash -otp -otpExpiresAt');
    if (!req.user) {
      res.status(401);
      throw new Error('User not found');
    }
    next();
  } catch (err) {
    res.status(401);
    throw new Error('Not authorised — invalid token');
  }
});

module.exports = { protect };