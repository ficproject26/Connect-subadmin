const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/authMiddleware');

// Real-time SSE Stream (supports both query token and bearer header)
router.get('/stream', notificationController.streamNotifications);

// REST endpoints (allow optional or enforced auth; extractUserFromRequest handles fallback)
router.get('/', (req, res, next) => {
  // If authorization header present, use authMiddleware, else allow extraction in controller
  if (req.headers.authorization) {
    return authMiddleware(req, res, next);
  }
  next();
}, notificationController.getNotifications);

router.get('/unread-count', (req, res, next) => {
  if (req.headers.authorization) {
    return authMiddleware(req, res, next);
  }
  next();
}, notificationController.getUnreadCount);

router.patch('/:id/read', (req, res, next) => {
  if (req.headers.authorization) {
    return authMiddleware(req, res, next);
  }
  next();
}, notificationController.markAsRead);

router.post('/mark-all-read', (req, res, next) => {
  if (req.headers.authorization) {
    return authMiddleware(req, res, next);
  }
  next();
}, notificationController.markAllAsRead);

router.delete('/:id', (req, res, next) => {
  if (req.headers.authorization) {
    return authMiddleware(req, res, next);
  }
  next();
}, notificationController.deleteNotification);

module.exports = router;
