const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const authMiddleware = require('../middleware/authMiddleware');
const locationMiddleware = require('../middleware/locationMiddleware');

router.use(authMiddleware);
router.use(locationMiddleware);

router.get('/', jobController.getJobs);
router.get('/categories', jobController.getJobCategories);
router.get('/technicians', jobController.getTechnicians);
router.patch('/:id', jobController.updateJobStatus);

module.exports = router;
