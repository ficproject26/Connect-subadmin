const express = require('express');
const router = express.Router();
const multer = require('multer');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadToS3 } = require('../config/s3');

// Configure memory storage for direct S3 upload
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});

router.use(authMiddleware);

// POST /api/uploads/document — Upload document directly to AWS S3
router.post('/document', memoryUpload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const s3Result = await uploadToS3(req.file.buffer, 'subadmin_docs', req.file.originalname);

    res.json({
      success: true,
      message: 'File uploaded successfully to AWS S3',
      file: {
        name: req.file.originalname,
        key: s3Result.key,
        url: s3Result.url,
        secure_url: s3Result.secure_url,
        size: req.file.size,
        type: req.file.mimetype
      }
    });
  } catch (err) {
    console.error('File upload to S3 error:', err);
    res.status(500).json({ success: false, message: err.message || 'File upload failed' });
  }
});

module.exports = router;
