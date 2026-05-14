/**
 * authorise(...roles) — must come after protect middleware
 * Usage: router.get('/admin-only', protect, authorise('admin'), handler)
 */
const authorise = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    res.status(403);
    throw new Error(`Role '${req.user.role}' is not allowed to access this route`);
  }
  next();
};

module.exports = { authorise };