
const express  = require('express');
const router   = express.Router();
const { uploadDocument, getDocuments, downloadDocument, deleteDocument } =
  require('../Controllers/documentController');
const { protect, authorise } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(protect);

// Upload: multer parses the multipart form and sets req.file
router.post(
  '/',
  authorise('student', 'admin'),
  upload.single('file'),   // ← this was missing
  uploadDocument
);

// List documents (controller filters by role internally)
router.get('/', getDocuments);

// Download a document as a binary stream
router.get('/:id/download', downloadDocument);

// Delete (owner or admin — enforced in controller)
router.delete('/:id', deleteDocument);

module.exports = router;