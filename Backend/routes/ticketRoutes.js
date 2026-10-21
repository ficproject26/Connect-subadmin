const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const authMiddleware = require('../middleware/authMiddleware');

// Public: agents submit tickets (no sub-admin auth required)
router.post('/', ticketController.submitTicket);

// Protected: admin reads/updates tickets
router.get('/stats', authMiddleware, ticketController.getTicketStats);
router.get('/', authMiddleware, ticketController.getTickets);
router.get('/:id', authMiddleware, ticketController.getTicket);
router.patch('/:id', authMiddleware, ticketController.updateTicket);

module.exports = router;
