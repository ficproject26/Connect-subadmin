const { db, filterByLocation } = require('../config/db');

// --- AGENT PAYMENTS ---

function getAgentPayments(req, res) {
  try {
    let scoped = filterByLocation(db.agentPayments, req.user);
    const { status, search } = req.query;

    if (status) {
      scoped = scoped.filter(p => p.status.toLowerCase() === status.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      scoped = scoped.filter(p =>
        p.agentName.toLowerCase().includes(q) ||
        p.pincode.includes(q) ||
        (p.transactionRef && p.transactionRef.toLowerCase().includes(q))
      );
    }

    const summary = {
      total: scoped.length,
      pendingCount: scoped.filter(p => p.status === 'Pending').length,
      pendingAmount: scoped.filter(p => p.status === 'Pending').reduce((s, p) => s + p.amount, 0),
      approvedCount: scoped.filter(p => p.status === 'Approved').length,
      paidCount: scoped.filter(p => p.status === 'Paid').length,
      totalPaidAmount: scoped.filter(p => p.status === 'Paid').reduce((s, p) => s + p.amount, 0)
    };

    return res.json({ success: true, summary, payments: scoped });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch agent payments', error: error.message });
  }
}

async function processAgentPayment(req, res) {
  try {
    const { id } = req.params;
    const { action, transactionRef, notes } = req.body; // action: 'approve' | 'pay' | 'reject'

    const payment = await db.agentPayments.findOne({
      $or: [{ _id: id }, { id: id }]
    });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment request not found' });
    }

    const scoped = filterByLocation([payment], req.user);
    if (scoped.length === 0) {
      return res.status(403).json({ success: false, message: 'Payment outside your jurisdiction' });
    }

    const currentDate = new Date().toISOString().split('T')[0];
    const updates = { updatedAt: new Date().toISOString() };

    if (action === 'approve') {
      updates.status = 'Approved';
      updates.approvedBy = `${req.user.name} (${req.user.role})`;
      updates.approvalDate = currentDate;
      if (notes) updates.notes = notes;
    } else if (action === 'pay') {
      updates.status = 'Paid';
      updates.paidBy = `${req.user.name} (${req.user.role})`;
      updates.paidDate = currentDate;
      updates.transactionRef = transactionRef || `TXN-REF-${Date.now()}`;
      if (notes) updates.notes = notes;
    } else if (action === 'reject') {
      updates.status = 'Rejected';
      updates.rejectedBy = `${req.user.name} (${req.user.role})`;
      updates.rejectionReason = notes || 'Rejected during administrative review';
    } else {
      return res.status(400).json({ success: false, message: 'Invalid action. Must be approve, pay, or reject' });
    }

    const updated = await db.agentPayments.findByIdAndUpdate(payment._id || payment.id, updates);

    return res.json({
      success: true,
      message: `Payment request marked as ${updates.status}`,
      payment: updated || { ...payment, ...updates }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to process payment', error: error.message });
  }
}

async function requestAgentPayment(req, res) {
  try {
    const { agentId, agentName, amount, paymentDetails, notes } = req.body;
    if (!agentName || !amount) {
      return res.status(400).json({ success: false, message: 'Agent name and amount are required' });
    }

    const newPayment = {
      id: `APAY-${Date.now().toString().slice(-4)}`,
      agentId: agentId || 'AGT-MANUAL',
      agentName,
      amount: Number(amount),
      state: req.user.state || 'Tamil Nadu',
      district: req.user.district || 'Salem',
      division: req.user.division || 'Salem North',
      pincode: req.user.pincode || '636001',
      paymentDetails: paymentDetails || 'UPI / Bank Transfer',
      requestDate: new Date().toISOString().split('T')[0],
      status: 'Pending',
      notes: notes || 'Direct Commission Settlement Request',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const inserted = await db.agentPayments.insertOne(newPayment);

    return res.status(201).json({
      success: true,
      message: 'Payment request submitted successfully',
      payment: inserted || newPayment
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to submit payment request', error: error.message });
  }
}

// --- VENDOR PAYMENTS ---

function getVendorPayments(req, res) {
  try {
    let scoped = filterByLocation(db.vendorPayments, req.user);
    const { status, search } = req.query;

    if (status) {
      scoped = scoped.filter(p => p.status.toLowerCase() === status.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      scoped = scoped.filter(p =>
        p.vendorName.toLowerCase().includes(q) ||
        p.invoiceNumber.toLowerCase().includes(q) ||
        p.pincode.includes(q)
      );
    }

    return res.json({ success: true, count: scoped.length, payments: scoped });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch vendor payments', error: error.message });
  }
}

async function processVendorPayment(req, res) {
  try {
    const { id } = req.params;
    const { action, transactionRef, notes } = req.body;

    const payment = await db.vendorPayments.findOne({
      $or: [{ _id: id }, { id: id }]
    });
    if (!payment) return res.status(404).json({ success: false, message: 'Vendor payment not found' });

    const scoped = filterByLocation([payment], req.user);
    if (scoped.length === 0) {
      return res.status(403).json({ success: false, message: 'Payment outside your jurisdiction' });
    }

    const currentDate = new Date().toISOString().split('T')[0];
    const updates = { updatedAt: new Date().toISOString() };

    if (action === 'approve') {
      updates.status = 'Approved';
      updates.approvedBy = `${req.user.name} (${req.user.role})`;
      updates.approvalDate = currentDate;
    } else if (action === 'pay') {
      updates.status = 'Paid';
      updates.paidDate = currentDate;
      updates.transactionRef = transactionRef || `UTR-${Date.now()}`;
    }

    if (notes) updates.notes = notes;

    const updated = await db.vendorPayments.findByIdAndUpdate(payment._id || payment.id, updates);

    return res.json({
      success: true,
      message: `Vendor payment marked as ${updates.status || payment.status}`,
      payment: updated || { ...payment, ...updates }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to process vendor payment', error: error.message });
  }
}

module.exports = {
  getAgentPayments,
  processAgentPayment,
  requestAgentPayment,
  getVendorPayments,
  processVendorPayment
};
