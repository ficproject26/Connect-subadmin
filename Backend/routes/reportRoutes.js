const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Sub-Admin Dashboard & Business Reports
router.get('/dashboard-summary', reportController.getDashboardSummary);
router.get('/business-reports', reportController.getBusinessReports);

// Manager Portal Dashboard stats
router.get('/dashboard', reportController.getDashboardStats);

// Performance leaderboard
router.get('/leaderboard', reportController.getLeaderboardData);

// Scoped vendor reports data
router.get('/vendors', reportController.getVendorReportData);

// Hierarchical Field Manager Period Reports
router.post('/submit', reportController.submitManagerReport);
router.get('/submitted', reportController.getSubmittedReports);
router.get('/submitted/:id', reportController.getSubmittedReportById);

// Report Approval Workflow (Pincode Admin / higher admins)
router.patch('/submitted/:id/approve', reportController.approveManagerReport);
router.patch('/submitted/:id/reject', reportController.rejectManagerReport);

module.exports = router;
