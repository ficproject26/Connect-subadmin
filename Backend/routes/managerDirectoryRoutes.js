const express = require('express');
const router = express.Router();
const managerDirectoryController = require('../controllers/managerDirectoryController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// GET /api/managers - List lower level managers or all scoped managers
router.get('/', managerDirectoryController.getLowerLevelManagers);

// GET /api/managers/requests - Centralized manager registration requests across all levels
router.get('/requests', managerDirectoryController.getManagerRequests);

// POST /api/managers - Add new manager
router.post('/', managerDirectoryController.addManager);

// GET /api/managers/:id - Get manager details
router.get('/:id', managerDirectoryController.getManagerById);

// POST /api/managers/:id/approve - Approve manager registration
router.post('/:id/approve', managerDirectoryController.approveManager);

// POST /api/managers/:id/reject - Reject manager registration
router.post('/:id/reject', managerDirectoryController.rejectManager);

// POST /api/managers/:id/pending - Keep manager registration pending with mandatory reason
router.post('/:id/pending', managerDirectoryController.keepPendingManager);

// PATCH /api/managers/:id/documents - Update/replace manager identity & official documents
router.patch('/:id/documents', managerDirectoryController.updateManagerDocuments);

// PATCH /api/managers/:id/status - Suspend, activate, or soft-delete manager account
router.patch('/:id/status', managerDirectoryController.updateManagerStatus);

module.exports = router;
