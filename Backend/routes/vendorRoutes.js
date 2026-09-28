const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const vendorSubscriptionController = require('../controllers/vendorSubscriptionController');
const authMiddleware = require('../middleware/authMiddleware');
const { validateVendorCreationScope } = require('../middleware/scopeMiddleware');

router.use(authMiddleware);

// List vendors
router.get('/', vendorController.getVendors);

// Vendor Subscriptions (must be before /:id)
router.get('/subscriptions', vendorSubscriptionController.getVendorSubscriptions);
router.post('/subscriptions/:id/record-payment', vendorSubscriptionController.recordSubscriptionPayment);

// Create vendor (supports both Sub-Admin and Field Manager)
router.post('/', validateVendorCreationScope, vendorController.createVendor);

// Lookup pincode hierarchy for automatic location autofill
router.get('/lookup-pincode/:pincode', vendorController.lookupPincode);

// Vendor by ID
router.get('/:id', vendorController.getVendorById);

// Update vendor profile
router.put('/:id', vendorController.updateVendor);

// Update vendor status
router.patch('/:id/status', vendorController.updateVendorStatus);

// Sub-Admin Stage 1 verification
router.post('/:id/pincode-verify', vendorController.pincodeAdminVerifyVendor);

// Sub-Admin Stage 2 KYC verification
router.post('/:id/kyc-verify', vendorController.kycVerifyVendor);

module.exports = router;
