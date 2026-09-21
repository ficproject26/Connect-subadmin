const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');
const locationMiddleware = require('../middleware/locationMiddleware');
const { checkRole, blockManagersFromAdminEndpoints } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(blockManagersFromAdminEndpoints);
router.use(locationMiddleware);

router.get('/hierarchy', adminController.getHierarchy);
router.get('/subordinates', adminController.getSubordinateAdmins);

// State Sub-Admin Routes (Super Admin)
router.get('/states', adminController.getStates);
router.post('/states', checkRole(['Super Admin']), adminController.addStateAdmin);
router.patch('/states/:id/status', checkRole(['Super Admin']), adminController.updateStateStatus);

// District Sub-Admin Routes
router.get('/districts', adminController.getDistricts);
router.post('/districts', checkRole(['State Admin', 'Super Admin']), adminController.addDistrictAdmin);
router.patch('/districts/:id/status', checkRole(['State Admin', 'Super Admin']), adminController.updateDistrictStatus);

// Division Sub-Admin Routes
router.get('/divisions', adminController.getDivisions);
router.post('/divisions', checkRole(['State Admin', 'District Admin', 'Super Admin']), adminController.addDivisionAdmin);
router.patch('/divisions/:id/status', checkRole(['State Admin', 'District Admin', 'Super Admin']), adminController.updateDivisionStatus);

// Pincode Sub-Admin Routes
router.get('/pincodes', adminController.getPincodes);
router.post('/pincodes', checkRole(['Division Admin', 'Divisional Admin', 'District Admin', 'State Admin', 'Super Admin']), adminController.addPincodeAdmin);
router.patch('/pincodes/:id/status', checkRole(['Division Admin', 'Divisional Admin', 'District Admin', 'State Admin', 'Super Admin']), adminController.updatePincodeStatus);

module.exports = router;
