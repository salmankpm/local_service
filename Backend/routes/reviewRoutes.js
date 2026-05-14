const router = require('express').Router();
const {
  createReview, getWorkerReviews, getMyReviews, deleteReview,
} = require('../controllers/reviewController');
const { protect }   = require('../middleware/authMiddleware');
const { authorise } = require('../middleware/roleMiddleware');

router.post('/',                   protect,                    createReview);
router.get ('/my',                 protect,                    getMyReviews);
router.get ('/worker/:workerId',                               getWorkerReviews);
router.delete('/:id',              protect, authorise('admin'), deleteReview);

module.exports = router;