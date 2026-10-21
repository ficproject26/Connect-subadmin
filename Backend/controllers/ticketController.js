/**
 * ticketController.js
 *
 * Manages agent support tickets (My Issues) integrated with the Admin Queries tab.
 * Uses the existing `db.supportTeam` collection (MongoDB: supportteams) as the
 * single source of truth for all ticket records.
 */

const { v4: uuidv4 } = require('uuid');
const { db, filterByLocation } = require('../config/db');

// --- Helpers ----------------------------------------------------------------

function generateTicketId() {
  const now = new Date();
  const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TKT-${yyyymmdd}-${suffix}`;
}

function computeSlaDate(from) {
  const date = from ? new Date(from) : new Date();
  let added = 0;
  while (added < 3) {
    date.setDate(date.getDate() + 1);
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return date.toISOString().slice(0, 10);
}

function normalizeTicket(raw) {
  const now = new Date().toISOString();
  const id = raw.id || raw._id || uuidv4();
  return {
    ...raw,
    id,
    _id: id,
    ticketId: raw.ticketId || generateTicketId(),
    subject: raw.subject || raw.title || 'No Subject',
    description: raw.description || raw.message || '',
    category: raw.category || 'General',
    priority: raw.priority || 'Normal',
    status: raw.status || 'Pending',
    raisedBy: raw.raisedBy || raw.agentName || raw.name || 'Unknown Agent',
    agentId: raw.agentId || raw.registrationId || raw.employeeCode || '',
    agentPhone: raw.agentPhone || raw.phone || raw.mobile || '',
    userRole: raw.userRole || raw.agentRole || 'Agent',
    agentLevel: raw.agentLevel || raw.level || '',
    state: raw.state || raw.assignedState || '',
    district: raw.district || raw.assignedDistrict || '',
    division: raw.division || raw.assignedDivision || '',
    pincode: raw.pincode || raw.assignedPincode || '',
    stateId: raw.stateId || null,
    districtId: raw.districtId || null,
    divisionId: raw.divisionId || null,
    pincodeId: raw.pincodeId || null,
    assignedTo: raw.assignedTo || '',
    assignedAdminId: raw.assignedAdminId || null,
    attachments: raw.attachments || [],
    slaDate: raw.slaDate || computeSlaDate(raw.createdAt),
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now
  };
}

// --- Public: Agent submits a support ticket ----------------------------------

async function submitTicket(req, res) {
  try {
    const body = req.body || {};

    if (!body.subject && !body.title) {
      return res.status(400).json({ success: false, message: 'Ticket subject is required.' });
    }
    if (!body.raisedBy && !body.agentName && !body.name) {
      return res.status(400).json({ success: false, message: 'Agent name (raisedBy) is required.' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const ticket = normalizeTicket({ id, _id: id, ...body, createdAt: now, updatedAt: now });
    const saved = await db.supportTeam.insertOne(ticket);

    return res.status(201).json({ success: true, message: 'Ticket submitted successfully.', ticket: saved || ticket });
  } catch (err) {
    console.error('[ticketController.submitTicket]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to submit ticket.', error: err.message });
  }
}

// --- Admin: List tickets scoped to admin territory ---------------------------

async function getTickets(req, res) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: 'Authentication required.' });

    await db.supportTeam.reloadFromMongo(true);
    let allTickets = Array.from(db.supportTeam);
    let scoped = filterByLocation(allTickets, user);

    const { status, limit = 500, skip = 0 } = req.query;
    if (status && status !== 'All') {
      scoped = scoped.filter(t => (t.status || '').toLowerCase() === status.toLowerCase());
    }

    scoped.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const total = scoped.length;
    const paginated = scoped.slice(Number(skip), Number(skip) + Number(limit));

    return res.json({ success: true, total, count: paginated.length, tickets: paginated, data: paginated });
  } catch (err) {
    console.error('[ticketController.getTickets]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch tickets.', error: err.message });
  }
}

// --- Admin: Get single ticket ------------------------------------------------

async function getTicket(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    const ticket = await db.supportTeam.findById(id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    const scoped = filterByLocation([ticket], user);
    if (scoped.length === 0) return res.status(403).json({ success: false, message: 'Ticket is outside your jurisdiction.' });

    return res.json({ success: true, ticket });
  } catch (err) {
    console.error('[ticketController.getTicket]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch ticket.', error: err.message });
  }
}

// --- Admin: Update ticket status / assign ------------------------------------

async function updateTicket(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;
    const { status, assignedTo, resolution } = req.body || {};

    const ticket = await db.supportTeam.findById(id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    const scoped = filterByLocation([ticket], user);
    if (scoped.length === 0) return res.status(403).json({ success: false, message: 'Ticket is outside your jurisdiction.' });

    const updates = { updatedAt: new Date().toISOString() };
    if (status) updates.status = status;
    if (assignedTo !== undefined) updates.assignedTo = assignedTo;
    if (resolution !== undefined) updates.resolution = resolution;

    const updated = await db.supportTeam.findByIdAndUpdate(ticket._id || ticket.id, updates);

    return res.json({ success: true, message: 'Ticket updated successfully.', ticket: updated || { ...ticket, ...updates } });
  } catch (err) {
    console.error('[ticketController.updateTicket]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to update ticket.', error: err.message });
  }
}

// --- Admin: Ticket statistics ------------------------------------------------

async function getTicketStats(req, res) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: 'Authentication required.' });

    const allTickets = Array.from(db.supportTeam);
    const scoped = filterByLocation(allTickets, user);

    const stats = {
      total: scoped.length,
      pending: scoped.filter(t => (t.status || '').toLowerCase() === 'pending').length,
      inReview: scoped.filter(t => (t.status || '').toLowerCase() === 'in review').length,
      resolved: scoped.filter(t => (t.status || '').toLowerCase() === 'resolved').length,
      closed: scoped.filter(t => (t.status || '').toLowerCase() === 'closed').length,
      urgent: scoped.filter(t => (t.priority || '').toLowerCase() === 'urgent').length,
      high: scoped.filter(t => (t.priority || '').toLowerCase() === 'high').length
    };

    return res.json({ success: true, stats });
  } catch (err) {
    console.error('[ticketController.getTicketStats]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch ticket stats.', error: err.message });
  }
}

module.exports = { submitTicket, getTickets, getTicket, updateTicket, getTicketStats };
