const express = require('express');
const router = express.Router();
const qcTaskController = require('../controllers/qcTaskController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// ─── QC ISSUE ROUTES ─────────────────────────────────────────────────────────
// QC Team raises an issue
router.post('/issues', qcTaskController.raiseQCIssue);

// Admin / QC Team views issues (scoped to their jurisdiction)
router.get('/issues', qcTaskController.getQCIssues);
router.get('/issues/:id', qcTaskController.getQCIssueById);

// Admin reviews issue resolution (accept / rework)
router.patch('/issues/:id/review', qcTaskController.reviewIssueResolution);

// ─── TASK ROUTES ──────────────────────────────────────────────────────────────
// Admin creates & assigns a task
router.post('/tasks', qcTaskController.createTask);

// Get tasks (Admin = hierarchy-scoped, Manager = own tasks only, QC Team = linked tasks)
router.get('/tasks', qcTaskController.getTasks);
router.get('/tasks/:id', qcTaskController.getTaskById);

// Manager updates task status (accept / start / complete)
router.patch('/tasks/:id/status', qcTaskController.updateTaskStatus);

// Manager submits suspend request
router.post('/tasks/:id/suspend', qcTaskController.submitSuspendRequest);

// Admin reviews suspend request (approve / reject)
router.patch('/tasks/:id/suspend/review', qcTaskController.reviewSuspendRequest);

// Admin reviews task completion (accept / rework)
router.patch('/tasks/:id/review', qcTaskController.reviewTaskResolution);

// ─── UTILITY ──────────────────────────────────────────────────────────────────
// Admin fetches managers within their scope for the assignment dropdown
router.get('/managers', qcTaskController.getManagersForScope);

module.exports = router;
