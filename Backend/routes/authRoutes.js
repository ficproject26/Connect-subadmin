const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Public auth endpoints
router.post('/login', authController.login);
router.post('/register', authController.register);
router.get('/locations', authController.getRegistrationLocations);
router.get('/check-capacity', authController.checkCapacity);
router.post('/upload-avatar', upload.single('avatar'), authController.uploadAvatar);
router.post('/upload-document', upload.single('document'), authController.uploadDocument);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Demo accounts for Sub-Admin testing
router.get('/demo-admins', authController.getDemoAdmins);

// Protected endpoints
router.get('/me', authMiddleware, authController.getMe);
router.put('/change-password', authMiddleware, authController.changePassword);

module.exports = router;
