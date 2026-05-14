const router = require('express').Router();
const {
  getProfile, updateProfile, changePassword,
  getAllUsers, toggleUserActive, getUserBookings,
} = require('../controllers/userController');
const { protect }    = require('../middleware/authMiddleware');
const { authorise }  = require('../middleware/roleMiddleware');

router.get ('/',                protect, authorise('admin'), getAllUsers);
router.get ('/profile',         protect, getProfile);
router.put ('/profile',         protect, updateProfile);
router.put ('/change-password', protect, changePassword);
router.put ('/:id/toggle-active', protect, authorise('admin'), toggleUserActive);
router.get ('/:id/bookings',    protect, authorise('admin'), getUserBookings);

module.exports = router;