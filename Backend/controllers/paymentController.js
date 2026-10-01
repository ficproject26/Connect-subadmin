const { db, filterByLocation } = require('../config/db');

// --- AGENT PAYMENTS ---

function normalizeAgentPayment(item) {
  if (!item) return null;
  const id = String(item.id || item._id || '');
  const agentName = item.agentName || item.employeeName || item.name || 'Agent Staff';
  const amount = Number(item.amount ?? item.netSalary ?? item.salary ?? 0);
  const status = item.status || item.paymentStatus || 'Pending';
  const transactionRef = item.transactionRef || item.transactionReference || item.employeeCode || '-';
  const pincode = item.pincode ? String(item.pincode) : '';
  const date = item.paymentDate || item.date || item.createdAt || '-';

  return {
    ...item,
    id,
    _id: id,
    agentName,
    amount,
    status,
    transactionRef,
    pincode,
    date,
    state: item.state || '',
    district: item.district || '',
    division: item.division || ''
  };
}

function getAgentPayments(req, res) {
  try {
    const rawPayments = Array.from(db.agentPayments || []);
    const normalized = rawPayments.map(normalizeAgentPayment).filter(Boolean);
    let scoped = filterByLocation(normalized, req.user);
    const { status, search } = req.query;

    if (status && status !== 'all') {
      scoped = scoped.filter(p => (p.status || '').toLowerCase() === status.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase().trim();
      scoped = scoped.filter(p =>
        (p.agentName && p.agentName.toLowerCase().includes(q)) ||
        (p.pincode && p.pincode.includes(q)) ||
        (p.transactionRef && p.transactionRef.toLowerCase().includes(q))
      );
    }

    const summary = {
      total: scoped.length,
      pendingCount: scoped.filter(p => (p.status || '').toLowerCase() === 'pending').length,
      pendingAmount: scoped.filter(p => (p.status || '').toLowerCase() === 'pending').reduce((s, p) => s + (p.amount || 0), 0),
      approvedCount: scoped.filter(p => (p.status || '').toLowerCase() === 'approved').length,
      paidCount: scoped.filter(p => (p.status || '').toLowerCase() === 'paid').length,
      totalPaidAmount: scoped.filter(p => (p.status || '').toLowerCase() === 'paid').reduce((s, p) => s + (p.amount || 0), 0)
    };

    return res.json({ success: true, count: scoped.length, summary, payments: scoped, data: scoped });
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

const { getComprehensiveVendorDirectory } = require('../utils/vendorDirectory');

function formatPaymentDate(dateVal) {
  if (!dateVal) return 'Not available';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toISOString().split('T')[0];
  } catch (e) {
    return String(dateVal);
  }
}

function formatPaymentTime(dateVal) {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
}

// --- VENDOR PAYMENTS ---

function getVendorPayments(req, res) {
  try {
    const vendorDir = getComprehensiveVendorDirectory();

    // Fast order index for resolving payments originating from customer orders
    const orderMap = new Map();
    Array.from(db.orders || []).forEach(o => {
      orderMap.set(String(o._id || o.id || o.order_number), o);
      if (o.order_number) orderMap.set(String(o.order_number), o);
      if (o.id) orderMap.set(String(o.id), o);
    });

    // 1. Gather all vendor payment and settlement records
    const rawPayments = Array.from(db.vendorPayments || []);
    const rawSettlements = Array.from(db.settlements || []);

    const combined = [...rawPayments];
    const existingIds = new Set(rawPayments.map(p => String(p.id || p._id || p.paymentId)));

    rawSettlements.forEach(s => {
      const sId = String(s.id || s._id || `SETTLE-${s.vendorId}`);
      if (!existingIds.has(sId)) {
        combined.push({
          ...s,
          id: sId,
          _id: sId,
          amount: s.netAmount || s.grossAmount || 0,
          status: s.status || 'PROCESSING',
          createdAt: s.settlementDate || s.createdAt,
          sourceModel: 'Settlement'
        });
        existingIds.add(sId);
      }
    });

    // 2. Enrich each record with real vendor details and territorial coordinates
    const enrichedPayments = combined.map(item => {
      const pId = String(item.id || item._id || item.paymentId || '');

      // Identify associated order if any
      let order = null;
      if (item.sourceId) {
        order = orderMap.get(String(item.sourceId));
      }
      if (!order && item.notes) {
        const m = item.notes.match(/Order #([a-zA-Z0-9]+)/i);
        if (m) {
          order = Array.from(orderMap.values()).find(o => String(o.id || o.order_number || o._id).includes(m[1]));
        }
      }

      // Vendor Candidate Resolution
      const candidateKeys = [
        item.vendorId,
        item.recipientId,
        order && (order.vendor_id || order.vendorId || (order.items && order.items[0] && order.items[0].vendorId)),
        item.vendorBusinessName,
        item.vendorName,
        item.recipientName
      ].filter(Boolean);

      let matchedVendor = null;
      for (const k of candidateKeys) {
        matchedVendor = vendorDir.findVendor(k);
        if (matchedVendor) break;
      }

      // Territory resolution
      const t = item.territory || {};
      let state = item.state || t.state || (matchedVendor && matchedVendor.state) || '';
      let district = item.district || t.district || (matchedVendor && matchedVendor.district) || '';
      let division = item.division || t.division || (matchedVendor && matchedVendor.division) || '';
      let pincode = String(item.pincode || t.pincode || (matchedVendor && matchedVendor.pincode) || '').trim();

      if (pincode && (!state || !district || !division)) {
        const pinGeo = vendorDir.pinLookup.get(pincode);
        if (pinGeo) {
          if (!state) state = pinGeo.state;
          if (!district) district = pinGeo.district;
          if (!division) division = pinGeo.division;
        }
      }

      if (!state) state = 'Tamil Nadu';

      const dateSource = item.createdAt || item.dueDate || item.settlementDate || item.paymentDate;
      const requestDate = formatPaymentDate(dateSource);
      const requestTime = formatPaymentTime(dateSource);
      const paymentDate = item.paymentDate ? formatPaymentDate(item.paymentDate) : null;
      const updatedDate = item.updatedAt ? formatPaymentDate(item.updatedAt) : null;

      // Real settlement reference without fake placeholder
      const settlementRef = (item.transactionReference && item.transactionReference.trim()) ||
        (item.transactionRef && item.transactionRef.trim()) ||
        (item.settlementId && item.settlementId.trim()) ||
        (item.paymentId && item.paymentId.trim()) ||
        'Not available';

      const invoiceNumber = item.invoiceNumber || item.paymentId || (item.transactionReference ? item.transactionReference : (item.id ? `INV-${String(item.id).slice(-6).toUpperCase()}` : 'Not available'));

      return {
        ...item,
        id: pId,
        _id: pId,
        paymentId: item.paymentId || pId,
        invoiceNumber,
        vendorName: (matchedVendor && matchedVendor.vendorName) || item.recipientName || item.vendorName || (item.recipientType === 'Vendor' ? 'Vendor Partner' : 'Merchant Partner'),
        businessName: (matchedVendor && matchedVendor.businessName) || item.vendorBusinessName || item.businessName || item.recipientName || 'Merchant Enterprise',
        vendorId: (matchedVendor && matchedVendor.vendorId) || item.vendorId || item.recipientId || (order ? (order.vendor_id || order.vendorId) : 'Not available'),
        businessType: (matchedVendor && matchedVendor.businessType) || item.paymentCategory || item.recipientType || 'Merchant',
        phone: (matchedVendor && matchedVendor.phone) || item.recipientPhone || item.phone || 'Not available',
        email: (matchedVendor && matchedVendor.email) || item.recipientEmail || item.email || 'Not available',
        address: (matchedVendor && matchedVendor.address) || item.address || 'Not available',
        fullAddress: (matchedVendor && matchedVendor.fullAddress) || item.address || 'Not available',
        area: (matchedVendor && matchedVendor.area) || '',
        state,
        district: district || 'Not available',
        division: division || 'Not available',
        pincode: pincode || 'Not available',
        territory: { state, district, division, pincode },
        amount: Number(item.netAmount || item.grossAmount || item.amount || 0),
        status: String(item.status || 'PENDING').toUpperCase(),
        requestDate,
        requestTime,
        paymentDate,
        updatedDate,
        settlementRef
      };
    });

    // 3. Strictly enforce territory-based scoping at the backend/database level
    let scoped = filterByLocation(enrichedPayments, req.user);

    const { status, search } = req.query;

    if (status && status !== 'all') {
      scoped = scoped.filter(p => (p.status || '').toLowerCase() === status.toLowerCase());
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      scoped = scoped.filter(p =>
        (p.vendorName && p.vendorName.toLowerCase().includes(q)) ||
        (p.businessName && p.businessName.toLowerCase().includes(q)) ||
        (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(q)) ||
        (p.vendorId && p.vendorId.toLowerCase().includes(q)) ||
        (p.settlementRef && p.settlementRef.toLowerCase().includes(q)) ||
        (p.pincode && p.pincode.includes(q)) ||
        (p.district && p.district.toLowerCase().includes(q))
      );
    }

    return res.json({ success: true, count: scoped.length, payments: scoped, data: scoped });
  } catch (error) {
    console.error('[getVendorPayments] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch vendor payments', error: error.message });
  }
}

async function processVendorPayment(req, res) {
  try {
    const { id } = req.params;
    const { action, transactionRef, notes } = req.body;

    let targetCollection = db.vendorPayments;
    let payment = await db.vendorPayments.findOne({
      $or: [{ _id: id }, { id: id }, { paymentId: id }]
    });

    if (!payment) {
      payment = await db.settlements.findOne({
        $or: [{ _id: id }, { id: id }]
      });
      targetCollection = db.settlements;
    }

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
      updates.transactionReference = transactionRef || `UTR-${Date.now()}`;
      updates.transactionRef = updates.transactionReference;
    }

    if (notes) updates.notes = notes;

    const updated = await targetCollection.findByIdAndUpdate(payment._id || payment.id, updates);

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

