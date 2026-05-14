const router = require('express').Router();
const {
  sendOTP, verifyOTP, register, login, getMe, updateFcmToken,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/send-otp',    sendOTP);
router.post('/verify-otp',  verifyOTP);
router.post('/register',    register);
router.post('/login',       login);
router.get ('/me',          protect, getMe);
router.put ('/update-fcm',  protect, updateFcmToken);

module.exports = router;