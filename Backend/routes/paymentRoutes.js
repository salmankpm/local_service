const router = require('express').Router();
const {
  createOrder, verifyPayment, refundPayment, getAllPayments,
} = require('../controllers/paymentController');
const { protect }   = require('../middleware/authMiddleware');
const { authorise } = require('../middleware/roleMiddleware');

router.post('/create-order',          protect,                    createOrder);
router.post('/verify',                protect,                    verifyPayment);
router.post('/refund/:paymentId',     protect, authorise('admin'), refundPayment);
router.get ('/',                      protect, authorise('admin'), getAllPayments);

module.exports = router;