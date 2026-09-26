const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const { optionalAuth, authMiddleware } = require('../middleware/authMiddleware');
const { blockManagersFromAdminEndpoints } = require('../middleware/roleMiddleware');

// Centralized Territory & Hierarchy read endpoints (Supports both public dropdowns & authenticated role-scoping)
router.get('/hierarchy', optionalAuth, locationController.getHierarchy);
router.get('/territory/hierarchy', optionalAuth, locationController.getHierarchy);
router.get('/states', optionalAuth, locationController.getStates);
router.get('/districts', optionalAuth, locationController.getDistricts);
router.get('/divisions', optionalAuth, locationController.getDivisions);
router.get('/pincodes', optionalAuth, locationController.getPincodes);

// Mutating location routes blocked for field managers and restricted to admins
router.post('/states', authMiddleware, blockManagersFromAdminEndpoints);
router.post('/districts', authMiddleware, blockManagersFromAdminEndpoints);
router.post('/divisions', authMiddleware, blockManagersFromAdminEndpoints);
router.post('/pincodes', authMiddleware, blockManagersFromAdminEndpoints);

module.exports = router;
