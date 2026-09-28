const { db, filterByLocation } = require('../config/db');
const { resolvePincodeHierarchy } = require('../utils/pincodeMapping');

/**
 * Helper: compute end date (1 month safe from start date)
 * E.g. 28 Sept 2026 -> 28 Oct 2026
 */
function calculateNextMonthDate(startDateStr) {
  const start = startDateStr ? new Date(startDateStr) : new Date();
  const d = new Date(start);
  const curMonth = d.getMonth();
  d.setMonth(curMonth + 1);
  // Handle month boundary edge case (e.g., Jan 31 -> Feb 28)
  if (d.getMonth() !== (curMonth + 1) % 12) {
    d.setDate(0);
  }
  return d.toISOString();
}

/**
 * Format date nicely or return empty
 */
function formatDate(dStr) {
  if (!dStr) return '';
  try {
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    return d.toISOString().split('T')[0];
  } catch (e) {
    return dStr;
  }
}

/**
 * GET /api/vendors/subscriptions
 * Scope-enforced dynamic vendor subscriptions
 */
const getVendorSubscriptions = async (req, res) => {
  try {
    const user = req.user;
    const allSubs = Array.from(db.subscriptions);
    const allVendors = Array.from(db.vendors);

    // Build vendor lookup map
    const vendorMap = new Map();
    allVendors.forEach(v => {
      const vid = String(v._id || v.id);
      vendorMap.set(vid, v);
    });

    // Enrich subscriptions with vendor profile and location if missing
    const enrichedSubs = allSubs.map(s => {
      const vid = String(s.vendorId || s.businessId);
      const vendor = vendorMap.get(vid);

      const rawPincode = s.pincode || vendor?.pincode || '';
      const resolvedGeo = rawPincode ? resolvePincodeHierarchy(rawPincode) : null;

      const state = s.state || vendor?.state || resolvedGeo?.stateName || '';
      const district = s.district || vendor?.district || resolvedGeo?.districtName || '';
      const division = s.division || vendor?.division || resolvedGeo?.divisionName || '';
      const pincode = rawPincode || resolvedGeo?.pincode || '';

      const stateId = s.stateId || vendor?.stateId || resolvedGeo?.stateId || null;
      const districtId = s.districtId || vendor?.districtId || resolvedGeo?.districtId || null;
      const divisionId = s.divisionId || vendor?.divisionId || resolvedGeo?.divisionId || null;
      const pincodeId = s.pincodeId || vendor?.pincodeId || resolvedGeo?.pincodeId || null;

      const vendorName = s.vendorName || vendor?.businessName || vendor?.name || s.businessName || 'Merchant Store';
      const businessName = s.businessName || vendor?.businessName || vendorName;
      const businessType = s.businessType || vendor?.category || 'Services';
      const owner = vendor?.contactPerson || vendor?.name || vendorName;
      const phone = vendor?.phone || vendor?.mobile || '';
      const email = vendor?.email || '';

      const amount = Number(s.amount) || 1000;
      const startDate = s.startDate || s.createdAt || new Date().toISOString();
      const endDate = s.endDate || s.nextDueDate || calculateNextMonthDate(startDate);
      const nextDueDate = s.nextDueDate || endDate;
      const paymentDate = s.paymentDate || s.lastPaymentDate || startDate;

      const now = new Date();
      const end = new Date(endDate);
      const daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));

      let status = s.status || 'Active';
      if (end < now) {
        status = 'Expired';
      } else if (daysRemaining <= 5) {
        status = 'Due for Renewal';
      } else if (status === 'Active') {
        status = 'Active & Paid';
      }

      const approverInfo = s.approvedBy || (vendor?.addedBy?.name ? `${vendor.addedBy.role || 'Admin'} – ${vendor.addedBy.name}` : 'Not assigned');

      return {
        id: String(s._id || s.id || s.subscriptionId),
        _id: String(s._id || s.id || s.subscriptionId),
        subscriptionId: s.subscriptionId || `SUB-${s._id}`,
        vendorId: s.vendorId,
        vendorName,
        owner,
        phone,
        email,
        businessId: s.businessId,
        businessName,
        businessType,
        category: businessType,
        planName: `${businessType} Monthly Plan`,
        planTier: 'Growth',
        monthlyFee: amount,
        amount,
        currency: s.currency || 'INR',
        billingCycle: s.billingCycle || 'Monthly',
        paymentStatus: s.paymentStatus || 'PAID',
        status,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        nextDueDate: formatDate(nextDueDate),
        lastPaymentDate: formatDate(paymentDate),
        lastPaymentMode: s.lastPaymentMode || (s.latestPaymentId ? 'Razorpay Online' : 'UPI / Online'),
        lastTransactionId: s.latestPaymentId || s.paymentId || s.razorpayOrderId || s.subscriptionId,
        razorpayOrderId: s.razorpayOrderId || null,
        razorpayPaymentId: s.razorpayPaymentId || s.latestPaymentId || null,
        daysRemaining,
        invoiceNumber: `INV-${(s.subscriptionId || String(s._id)).replace(/[^0-9]/g, '').slice(-6) || '202601'}`,
        state,
        stateId,
        district,
        districtId,
        division,
        divisionId,
        pincode,
        pincodeId,
        approvedBy: approverInfo
      };
    });

    // Filter strictly by the caller's territory hierarchy
    const scoped = filterByLocation(enrichedSubs, user);

    // Apply query filters
    const { search, status: queryStatus } = req.query;
    let filtered = scoped;

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(item =>
        item.vendorName.toLowerCase().includes(q) ||
        item.businessName.toLowerCase().includes(q) ||
        item.businessType.toLowerCase().includes(q) ||
        item.pincode.toLowerCase().includes(q) ||
        item.subscriptionId.toLowerCase().includes(q) ||
        (item.phone && item.phone.toLowerCase().includes(q)) ||
        (item.lastTransactionId && item.lastTransactionId.toLowerCase().includes(q))
      );
    }

    if (queryStatus && queryStatus !== 'All') {
      filtered = filtered.filter(item => item.status === queryStatus);
    }

    // Calculate real KPI statistics across all scoped records
    const total = scoped.length;
    const active = scoped.filter(s => s.status === 'Active & Paid' || s.status === 'Active').length;
    const dueSoon = scoped.filter(s => s.status === 'Due for Renewal').length;
    const totalMonthlyRecurring = scoped.reduce((sum, s) => sum + (s.monthlyFee || 0), 0);
    const totalCollectedThisMonth = scoped
      .filter(s => s.status === 'Active & Paid' || s.status === 'Active')
      .reduce((sum, s) => sum + (s.monthlyFee || 0), 0);

    return res.status(200).json({
      success: true,
      count: filtered.length,
      summary: {
        total,
        active,
        dueSoon,
        totalMonthlyRecurring,
        totalCollectedThisMonth
      },
      subscriptions: filtered
    });
  } catch (error) {
    console.error('[vendorSubscriptionController.getVendorSubscriptions] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve vendor subscriptions',
      error: error.message
    });
  }
};

/**
 * POST /api/vendors/subscriptions/:id/record-payment
 * Record manual or verified renewal payment by authorized admin
 */
const recordSubscriptionPayment = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { amount, paymentMode, transactionId, paymentDate, notes } = req.body;

    const sub = db.subscriptions.find(s => String(s._id || s.id || s.subscriptionId) === String(id));
    if (!sub) {
      return res.status(404).json({
        success: false,
        message: 'Subscription record not found'
      });
    }

    // Verify geographical authority
    const authorized = filterByLocation([sub], user);
    if (!authorized.length) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to record payments for subscriptions outside your territory'
      });
    }

    const payDate = paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString();
    const newEndDate = calculateNextMonthDate(payDate);
    const txnId = transactionId || `TXN-OFFLINE-${Date.now()}`;
    const payAmount = Number(amount) || sub.amount || 1000;

    // Update subscription
    const updated = await db.subscriptions.findByIdAndUpdate(sub._id || sub.id, {
      status: 'Active',
      amount: payAmount,
      startDate: payDate,
      endDate: newEndDate,
      nextDueDate: newEndDate,
      paymentDate: payDate,
      lastPaymentDate: payDate,
      lastPaymentMode: paymentMode || 'UPI (Manual Record)',
      latestPaymentId: txnId,
      paymentStatus: 'PAID',
      renewalCount: (sub.renewalCount || 0) + 1,
      updatedAt: new Date().toISOString()
    });

    // Insert record in subscription payments
    const paymentRecord = {
      paymentId: txnId,
      subscriptionId: sub.subscriptionId || `SUB-${sub._id}`,
      vendorId: sub.vendorId,
      vendorName: sub.vendorName || sub.businessName,
      businessId: sub.businessId,
      businessName: sub.businessName,
      businessType: sub.businessType,
      amount: payAmount,
      currency: 'INR',
      status: 'SUCCESS',
      paymentMode: paymentMode || 'UPI',
      notes: notes || 'Admin verified payment',
      paymentDate: payDate,
      state: sub.state,
      stateId: sub.stateId,
      district: sub.district,
      districtId: sub.districtId,
      division: sub.division,
      divisionId: sub.divisionId,
      pincode: sub.pincode,
      pincodeId: sub.pincodeId,
      approvedBy: sub.approvedBy,
      recordedByAdmin: `${user.role} – ${user.name} (${user.id})`,
      createdAt: new Date().toISOString()
    };
    await db.subscriptionPayments.create(paymentRecord);

    return res.status(200).json({
      success: true,
      message: 'Subscription payment recorded and renewed successfully',
      subscription: updated
    });
  } catch (error) {
    console.error('[vendorSubscriptionController.recordSubscriptionPayment] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to record subscription payment',
      error: error.message
    });
  }
};

module.exports = {
  getVendorSubscriptions,
  recordSubscriptionPayment
};
