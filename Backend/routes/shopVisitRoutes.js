const express = require('express');
const router = express.Router();
const shopVisitController = require('../controllers/shopVisitController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/', shopVisitController.createShopVisit);
router.get('/', shopVisitController.getShopVisits);
router.put('/:id', shopVisitController.updateShopVisit);

module.exports = router;