const router  = require('express').Router();
const multer  = require('multer');
const path    = require('path');
const {
  getWorkers, getWorkerById, registerAsWorker,
  updateWorkerProfile, setAvailability,
  approveWorker, suspendWorker, uploadDocument, adminCreateWorker
} = require('../controllers/workerController');
const { protect }   = require('../middleware/authMiddleware');
const { authorise } = require('../middleware/roleMiddleware');

// Multer config for document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({
  storage,
  limits: { fileSize: Number(process.env.MAX_FILE_SIZE) || 5_000_000 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|pdf/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error('Only images and PDFs allowed'), ok);
  },
});

// Public
router.get ('/',              getWorkers);
router.get ('/:id',           getWorkerById);

// Worker
router.post('/register',       protect, registerAsWorker);
router.put ('/profile',        protect, authorise('worker','admin'), updateWorkerProfile);
router.put ('/availability',   protect, authorise('worker','admin'), setAvailability);
router.post('/upload-doc',     protect, authorise('worker','admin'), upload.single('document'), uploadDocument);

// Admin
router.put ('/:id/approve',    protect, authorise('admin'), approveWorker);
router.put ('/:id/suspend',    protect, authorise('admin'), suspendWorker);
router.post('/admin-create',   protect, authorise('admin'), adminCreateWorker);

module.exports = router;