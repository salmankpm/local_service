const router = require('express').Router();
const {
  createBooking, getMyBookings, getAllBookings,
  getBookingById, updateBookingStatus, sendMessage,
} = require('../controllers/bookingController');
const { protect }   = require('../middleware/authMiddleware');
const { authorise } = require('../middleware/roleMiddleware');

router.post('/',               protect,                              createBooking);
router.get ('/',               protect,                              getMyBookings);
router.get ('/all',            protect, authorise('admin'),          getAllBookings);
router.get ('/:id',            protect,                              getBookingById);
router.put ('/:id/status',     protect, authorise('user','worker','admin'), updateBookingStatus);
router.post('/:id/message',    protect,                              sendMessage);

module.exports = router;