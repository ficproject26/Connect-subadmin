const { db, filterByLocation } = require('../config/db');
const { getScopeFilter } = require('../middleware/scopeMiddleware');
const { getComprehensiveVendorDirectory } = require('../utils/vendorDirectory');
const {
  getHierarchicalScopedAgents,
  getAgentTerritory,
  normalizeLevel,
  getAgentLevel
} = require('./executiveController');

function getDashboardSummary(req, res) {
  try {
    const user = req.user || {};
    const scopedCustomers = filterByLocation(db.customers, user);
    const scopedVendors = filterByLocation(db.vendors, user);
    const scopedOrders = filterByLocation(db.orders, user);
    const scopedBookings = filterByLocation(db.bookings, user);
    const scopedJobs = filterByLocation(db.jobs, user);
    const scopedTechnicians = filterByLocation(db.technicians, user);
    const scopedExecutives = filterByLocation(db.executives, user);
    const scopedSupport = filterByLocation(db.supportTeam, user);
    const scopedAgents = filterByLocation(db.agents, user);
    const scopedKYC = filterByLocation(db.kycRecords, user);
    const scopedAgentPayments = filterByLocation(db.agentPayments, user);
    const scopedVendorPayments = filterByLocation(db.vendorPayments, user);
    const allUsers = Array.from(db.users || []);

    const isValidAdminStatus = (status) => {
      if (!status) return false;
      const s = String(status).trim().toLowerCase();
      return s === 'active' || s === 'approved' || s === 'verified';
    };

    const isRealAdminRecord = (u) => {
      if (!u) return false;
      const name = (u.name || '').trim();
      if (!name || name === 'Unassigned' || name === '-' || name === 'N/A') return false;
      return isValidAdminStatus(u.status);
    };

    // Fast admin hierarchy index for O(1) parent resolution
    let cachedSuperAdmin = null;
    const stateAdminMap = new Map();
    const distAdminMap = new Map();
    const divAdminMap = new Map();

    for (const u of allUsers) {
      if (!isValidAdminStatus(u.status)) continue;
      const r = (u.role || '').toLowerCase();
      const ar = (u.adminRole || '').toLowerCase();
      if (!cachedSuperAdmin && (r === 'super admin' || r === 'admin' || ar.includes('super'))) {
        cachedSuperAdmin = u;
      }
      if (r === 'state admin' || r.includes('state admin')) {
        const st = (u.state || '').trim().toLowerCase();
        if (st && !stateAdminMap.has(st)) stateAdminMap.set(st, u);
      } else if (r === 'district admin' || r.includes('district admin')) {
        const dt = (u.district || '').trim().toLowerCase();
        const st = (u.state || '').trim().toLowerCase();
        if (dt) {
          if (!distAdminMap.has(dt)) distAdminMap.set(dt, u);
          if (st) distAdminMap.set(`${st}:${dt}`, u);
        }
      } else if (r === 'division admin' || r === 'divisional admin' || r.includes('division admin')) {
        const dv = (u.division || '').trim().toLowerCase().replace(/\s+division/g, '');
        const dt = (u.district || '').trim().toLowerCase();
        if (dv) {
          if (!divAdminMap.has(dv)) divAdminMap.set(dv, u);
          if (dt) divAdminMap.set(`${dt}:${dv}`, u);
        }
      }
    }

    const getHierarchyParent = (admin) => {
      if (!admin) return null;
      const role = (admin.role || '').toLowerCase();
      const state = (admin.state || '').trim().toLowerCase();
      const district = (admin.district || '').trim().toLowerCase();
      const division = (admin.division || '').trim().toLowerCase();

      if (role === 'state admin' || role.includes('state admin')) {
        return cachedSuperAdmin || null;
      }
      if (role === 'district admin' || role.includes('district admin')) {
        return stateAdminMap.get(state) || cachedSuperAdmin || null;
      }
      if (role === 'division admin' || role === 'divisional admin' || role.includes('division admin') || role.includes('divisional admin')) {
        return distAdminMap.get(`${state}:${district}`) || distAdminMap.get(district) || null;
      }
      if (role === 'pincode admin' || role.includes('pincode admin')) {
        const targetDiv = division.replace(/\s+division/g, '');
        return divAdminMap.get(`${district}:${targetDiv}`) || divAdminMap.get(targetDiv) || null;
      }
      return null;
    };

    // Real onboarded admins by level
    const realStateAdmins = allUsers.filter(u => {
      const r = (u.role || '').toLowerCase();
      return (r === 'state admin' || r.includes('state admin')) && isRealAdminRecord(u) && Boolean(getHierarchyParent(u));
    });
    const realDistrictAdmins = allUsers.filter(u => {
      const r = (u.role || '').toLowerCase();
      return (r === 'district admin' || r.includes('district admin')) && isRealAdminRecord(u) && Boolean(getHierarchyParent(u));
    });
    const realDivisionalAdmins = allUsers.filter(u => {
      const r = (u.role || '').toLowerCase();
      return (r === 'division admin' || r === 'divisional admin' || r.includes('division admin')) && isRealAdminRecord(u) && Boolean(getHierarchyParent(u));
    });
    const realPincodeAdmins = allUsers.filter(u => {
      const r = (u.role || '').toLowerCase();
      return (r === 'pincode admin' || r.includes('pincode admin')) && isRealAdminRecord(u) && Boolean(getHierarchyParent(u));
    });

    const scopedStateAdmins = filterByLocation(realStateAdmins, user);
    const scopedDistrictAdmins = filterByLocation(realDistrictAdmins, user);
    const scopedDivisionalAdmins = filterByLocation(realDivisionalAdmins, user);
    const scopedPincodeAdmins = filterByLocation(realPincodeAdmins, user);

    const scopedDistricts = filterByLocation(db.districts || [], user);
    const scopedDivisions = filterByLocation(db.divisions || [], user);
    const scopedPincodesList = filterByLocation(db.pincodes || [], user);

    const totalRevenue = scopedOrders.reduce((sum, o) => sum + (o.netPayable || o.totalAmount || 0), 0);
    const pendingAgentPayouts = scopedAgentPayments
      .filter(p => p.status === 'Pending')
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingVendorPayouts = scopedVendorPayments
      .filter(p => p.status === 'Pending')
      .reduce((sum, p) => sum + p.amount, 0);

    const membershipDistribution = {
      Silver: scopedCustomers.filter(c => c.membership && c.membership.tier === 'Silver').length,
      Gold: scopedCustomers.filter(c => c.membership && c.membership.tier === 'Gold').length,
      Diamond: scopedCustomers.filter(c => c.membership && c.membership.tier === 'Diamond').length
    };

    // Build real monthly revenue trend from actual order timestamps using single-pass O(N) bucketing
    const revenueTrend = (() => {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const now = new Date();
      const result = [];
      const bucketMap = new Map();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const yr = d.getFullYear();
        const mo = d.getMonth();
        const key = `${yr}-${mo}`;
        const item = { month: monthNames[mo], revenue: 0, orders: 0 };
        result.push(item);
        bucketMap.set(key, item);
      }
      for (const o of scopedOrders) {
        const created = o.createdAt || o.orderDate || o.date;
        if (!created) continue;
        const od = new Date(created);
        if (isNaN(od.getTime())) continue;
        const k = `${od.getFullYear()}-${od.getMonth()}`;
        const bucket = bucketMap.get(k);
        if (bucket) {
          bucket.revenue += (o.netPayable || o.totalAmount || 0);
          bucket.orders += 1;
        }
      }
      result.forEach(r => { r.revenue = Math.round(r.revenue); });
      return result;
    })();

    const orderStatusBreakdown = [
      { status: 'Delivered', count: scopedOrders.filter(o => o.status === 'Delivered').length },
      { status: 'Shipped / Out for Delivery', count: scopedOrders.filter(o => ['Shipped', 'Out for Delivery'].includes(o.status)).length },
      { status: 'Processing', count: scopedOrders.filter(o => o.status === 'Processing').length }
    ];

    return res.json({
      success: true,
      role: user.role || '',
      scope: {
        state: user.state || '',
        district: user.district || '',
        division: user.division || '',
        pincode: user.pincode || ''
      },
      metrics: {
        totalDistricts: scopedDistricts.length,
        totalDivisions: scopedDivisions.length,
        totalPincodes: scopedPincodesList.length,
        totalStateAdmins: scopedStateAdmins.length,
        totalDistrictAdmins: scopedDistrictAdmins.length,
        totalDivisionalAdmins: scopedDivisionalAdmins.length,
        totalPincodeAdmins: scopedPincodeAdmins.length,
        totalAdmins: (scopedStateAdmins.length + scopedDistrictAdmins.length + scopedDivisionalAdmins.length + scopedPincodeAdmins.length),
        totalCustomers: scopedCustomers.length,
        totalVendors: scopedVendors.length,
        totalOrders: scopedOrders.length,
        totalBookings: scopedBookings.length,
        totalJobs: scopedJobs.length,
        totalTechnicians: scopedTechnicians.length,
        totalExecutives: scopedExecutives.length,
        totalSupportTickets: scopedSupport.length,
        totalAgents: scopedAgents.length,
        totalKYC: scopedKYC.length,
        totalRevenue,
        pendingAgentPayouts,
        pendingVendorPayouts
      },
      membershipDistribution,
      revenueTrend,
      orderStatusBreakdown
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to generate dashboard summary', error: error.message });
  }
}

async function getBusinessReports(req, res) {
  try {
    const user = req.user;
    const allScopedOrders = filterByLocation(db.orders || [], user);
    const scopedBookings = filterByLocation(db.bookings || [], user);
    const scopedSubscriptions = filterByLocation(db.subscriptions || [], user);
    const scopedSettlements = filterByLocation(db.settlements || [], user);
    const scopedCustomers = filterByLocation(db.customers || [], user);
    const scopedVendors = filterByLocation(db.vendors || [], user);
    const allCustomers = Array.from(db.customers || []);
    const vendorDir = typeof getComprehensiveVendorDirectory === 'function' ? getComprehensiveVendorDirectory() : null;

    // Fast customer index maps
    const custIdMap = new Map();
    const custPhoneMap = new Map();
    const custNameMap = new Map();
    for (const c of allCustomers) {
      if (c._id) custIdMap.set(String(c._id), c);
      if (c.id) custIdMap.set(String(c.id), c);
      if (c.customerId) custIdMap.set(String(c.customerId), c);
      if (c.registrationId) custIdMap.set(String(c.registrationId), c);
      if (c.phone) custPhoneMap.set(String(c.phone), c);
      if (c.mobile) custPhoneMap.set(String(c.mobile), c);
      if (c.name && c.name !== 'Customer Member' && c.name !== '-') custNameMap.set(String(c.name).toLowerCase(), c);
      if (c.fullName && c.fullName !== 'Customer Member' && c.fullName !== '-') custNameMap.set(String(c.fullName).toLowerCase(), c);
    }

    // Fast vendor index map
    const vendorMap = new Map();
    for (const v of (db.vendors || [])) {
      if (v._id) vendorMap.set(String(v._id), v);
      if (v.id) vendorMap.set(String(v.id), v);
      if (v.vendorId) vendorMap.set(String(v.vendorId), v);
    }

    // Standardize all commerce orders & bookings into unified transaction rows
    const normalizedOrders = allScopedOrders.map(o => {
      const orderNumber = o.order_number || o.orderNumber || o.orderId || o.order_id || o.transactionId || (o._id ? String(o._id).slice(-8) : '-');

      // Resolve Customer
      const custId = o.customer_id || o.customerId || o.customerDisplayId || (o.customer && (o.customer.id || o.customer._id));
      const custPhone = o.customer_phone || o.customerPhone || o.customerMobile || o.phone || o.mobile;
      const custName = o.customer_name || o.customerName || o.customer;
      let customer = null;
      if (custId) customer = custIdMap.get(String(custId));
      if (!customer && custPhone) customer = custPhoneMap.get(String(custPhone));
      if (!customer && custName && custName !== '-' && custName !== 'Customer Member') {
        customer = custNameMap.get(String(custName).toLowerCase());
      }

      const customerName = customer ? (customer.name || customer.fullName || customer.customerName || '-') : (custName || '-');
      const customerMobile = customer ? (customer.mobile || customer.phone || '-') : (custPhone || '-');
      const customerId = customer ? (customer.customerId || customer.registrationId || customer.id || customer._id || '-') : (custId || '-');

      // Resolve Vendor
      const vendorId = o.vendorId || o.vendor_id || (o.vendor && (o.vendor.id || o.vendor._id));
      let vendor = null;
      if (vendorId && vendorDir) vendor = vendorDir.findVendor(vendorId);
      if (!vendor && vendorId) vendor = vendorMap.get(String(vendorId));

      const vendorName = vendor ? (vendor.businessName || vendor.name || vendor.shopName || '-') : (o.vendorName || o.vendor_name || o.vendor || '-');

      // Financials
      const grossTotal = Number(o.totalAmount || o.grossTotal || o.amount || o.finalAmount || 0);
      const discount = Number(o.discountAmount || o.discount || 0);
      const fees = Number(o.fees || o.platformFee || o.serviceFee || 0);
      const commission = Number(o.commission || o.commissionAmount || Math.round(grossTotal * 0.05));
      const netPayable = Number(o.netPayable || o.netAmount || o.finalAmount || (grossTotal - discount) || grossTotal || 0);

      // Location
      const rawAddress = String(o.customer_address || o.address || o.delivery_address || (customer && (customer.fullAddress || customer.address)) || '');
      let pincode = o.pincode || o.deliveryPincode || o.customerPincode || (customer ? (customer.pincode || customer.assignedPincode) : null);
      if (!pincode && rawAddress) {
        const m = rawAddress.match(/\b\d{6}\b/);
        if (m) pincode = m[0];
      }

      let district = o.district || o.deliveryDistrict || (customer ? (customer.district || customer.city) : null);
      let division = o.division || o.deliveryDivision || (customer ? customer.division : null);
      let state = o.state || o.deliveryState || (customer ? customer.state : null) || user.state || '';

      if (pincode) {
        const pObj = (db.pincodeMap && db.pincodeMap.get(String(pincode))) || (db.pincodes && Array.from(db.pincodes).find(p => String(p.code || p.pincode) === String(pincode)));
        if (pObj) {
          if (!district) district = pObj.district;
          if (!division) division = pObj.division;
          if (!state) state = pObj.state;
        }
      }
      if (!district && /salem/i.test(rawAddress)) district = 'Salem';
      if (!division && /thalaivasal/i.test(rawAddress)) division = 'Thalaivasal';
      if (!state && /tamil\s*nadu/i.test(rawAddress)) state = 'Tamil Nadu';
      else if (!state && /karnataka/i.test(rawAddress)) state = 'Karnataka';
      if (!division && district && district.toLowerCase() === 'salem') division = 'Thalaivasal';
      if (!state && user.state) state = user.state;

      // Timestamps
      const rawDate = o.createdAt || o.orderDate || o.created_at || o.date;
      const parsedDate = rawDate ? new Date(rawDate) : new Date();
      const validDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
      const datePart = validDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const timePart = validDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

      const productName = o.product_details || o.productName || o.product_name || o.serviceName || o.itemName ||
        (Array.isArray(o.items) && o.items[0]?.name) || '-';

      const typeCategory = o.type || o.category || 'Products';
      const paymentStatus = o.paymentStatus || o.payment_status || 'Paid';
      const orderStatus = o.status || 'Order Received';

      return {
        id: String(o._id || o.id || orderNumber),
        orderNumber,
        reference: orderNumber,
        orderDate: datePart,
        orderTime: timePart,
        dateTime: `${datePart}, ${timePart}`,
        rawTimestamp: validDate.getTime(),
        createdAt: validDate.toISOString(),
        // Customer
        customerName,
        customerMobile,
        customerId,
        // Vendor
        vendorName,
        vendorId: vendor ? (vendor.vendorId || vendor.id || vendor._id) : (vendorId || '-'),
        // Product / Service
        productName,
        category: typeCategory,
        type: typeCategory,
        quantity: o.quantity || o.qty || 1,
        // Financial
        totalAmount: grossTotal,
        grossTotal,
        discountAmount: discount,
        fees,
        commission,
        netPayable,
        paymentMethod: o.paymentMethod || o.payment_method || 'Connect Wallet',
        paymentStatus,
        // Location
        pincode: pincode || '-',
        district: district || '-',
        division: division || '-',
        state: state || '-',
        // Status
        status: orderStatus,
        orderStatus
      };
    });

    // Map vendor subscriptions into transactions
    const subscriptionTransactions = scopedSubscriptions.map(s => {
      const subId = s.subscriptionId || s._id || (s.id ? `SUB-${s.id}` : 'SUB-001');
      const rawDate = s.createdAt || s.startDate || s.paymentDate;
      const parsedDate = rawDate ? new Date(rawDate) : new Date();
      const validDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
      const datePart = validDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const timePart = validDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      const amount = Number(s.amount || 999);

      return {
        id: String(s._id || s.id || subId),
        orderNumber: subId,
        reference: subId,
        orderDate: datePart,
        orderTime: timePart,
        dateTime: `${datePart}, ${timePart}`,
        rawTimestamp: validDate.getTime(),
        createdAt: validDate.toISOString(),
        customerName: s.vendorName || s.businessName || 'Registered Merchant',
        customerMobile: '-',
        customerId: s.vendorId || '-',
        vendorName: s.vendorName || s.businessName || 'Registered Merchant',
        vendorId: s.vendorId || '-',
        productName: `Merchant Subscription (${s.billingCycle || 'Annual'})`,
        category: 'Vendor Subscription',
        type: 'Subscription',
        quantity: 1,
        totalAmount: amount,
        grossTotal: amount,
        discountAmount: 0,
        fees: 0,
        commission: amount,
        netPayable: amount,
        paymentMethod: s.paymentMethod || 'Razorpay / Bank',
        paymentStatus: s.paymentStatus || (s.status === 'Active' ? 'Paid' : 'Pending'),
        pincode: s.pincode || '-',
        district: s.district || '-',
        division: s.division || '-',
        state: s.state || user.state || 'Tamil Nadu',
        status: s.status || 'Active',
        orderStatus: s.status || 'Active'
      };
    });

    // Combine all business transactions into comprehensive chronological ledger
    const allTransactions = [...normalizedOrders, ...subscriptionTransactions]
      .sort((a, b) => b.rawTimestamp - a.rawTimestamp);

    // Financial Metrics Calculation
    const grossTransactionValue = allTransactions.reduce((acc, t) => acc + t.grossTotal, 0);
    const discountsGiven = allTransactions.reduce((acc, t) => acc + t.discountAmount, 0);

    // Successful incoming payments (Paid transactions)
    const paidTransactions = allTransactions.filter(t => (t.paymentStatus || '').toLowerCase() === 'paid');
    const successfulIncomingPayments = paidTransactions.reduce((acc, t) => acc + t.netPayable, 0);

    // Pending payments
    const pendingTransactions = allTransactions.filter(t => (t.paymentStatus || '').toLowerCase() === 'pending');
    const pendingPayments = pendingTransactions.reduce((acc, t) => acc + t.netPayable, 0);

    // Refunds, cancellations, and rejected transactions
    const refundStatuses = new Set(['cancelled', 'rejected', 'refunded', 'returned', 'application received']);
    const refundTransactions = allTransactions.filter(t => refundStatuses.has((t.status || '').toLowerCase()));
    const refundsAndReversals = refundTransactions.reduce((acc, t) => acc + (t.netPayable || t.grossTotal), 0);

    // Outgoing merchant payouts & settlements
    const outgoingPayments = scopedSettlements.reduce((acc, s) => acc + Number(s.netAmount || s.grossAmount || 0), 0);

    // Platform commissions & fees earned
    const commissionsAndFees = allTransactions.reduce((acc, t) => acc + (t.commission || 0) + (t.fees || 0), 0);

    // Net business inflow = incoming successful payments - refunds - outgoing payouts
    const netBusinessInflow = Math.max(0, successfulIncomingPayments - refundsAndReversals - outgoingPayments);

    // Category breakdown
    const categoryMap = new Map();
    for (const t of allTransactions) {
      const cat = t.category || 'Other';
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, { category: cat, count: 0, grossValue: 0, paidValue: 0, commissions: 0 });
      }
      const entry = categoryMap.get(cat);
      entry.count += 1;
      entry.grossValue += t.grossTotal;
      if ((t.paymentStatus || '').toLowerCase() === 'paid') {
        entry.paidValue += t.netPayable;
      }
      entry.commissions += (t.commission || 0);
    }
    const categoriesBreakdown = Array.from(categoryMap.values()).map(c => ({
      ...c,
      percentageContribution: grossTransactionValue > 0 ? Number(((c.grossValue / grossTransactionValue) * 100).toFixed(1)) : 0
    })).sort((a, b) => b.grossValue - a.grossValue);

    // Top Performing Vendors
    const vendorRankingMap = new Map();
    for (const t of allTransactions) {
      const vKey = t.vendorId !== '-' ? t.vendorId : t.vendorName;
      if (!vKey || vKey === '-') continue;
      if (!vendorRankingMap.has(vKey)) {
        vendorRankingMap.set(vKey, {
          vendorId: t.vendorId,
          vendorName: t.vendorName,
          category: t.category,
          district: t.district,
          pincode: t.pincode,
          count: 0,
          grossTotal: 0,
          successfulPaymentAmount: 0,
          commissions: 0
        });
      }
      const vEntry = vendorRankingMap.get(vKey);
      vEntry.count += 1;
      vEntry.grossTotal += t.grossTotal;
      if ((t.paymentStatus || '').toLowerCase() === 'paid') {
        vEntry.successfulPaymentAmount += t.netPayable;
      }
      vEntry.commissions += (t.commission || 0);
    }
    const topVendors = Array.from(vendorRankingMap.values())
      .sort((a, b) => b.grossTotal - a.grossTotal)
      .slice(0, 10);

    // Monthly & Yearly Comparisons
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    // 1. Month-to-Date Comparison
    const startOfCurrentMonth = new Date(currentYear, currentMonth, 1).getTime();
    const endOfCurrentMonthToDate = now.getTime();

    const startOfLastMonth = new Date(currentYear, currentMonth - 1, 1).getTime();
    const endOfLastMonthToDate = new Date(currentYear, currentMonth - 1, currentDay, 23, 59, 59).getTime();

    const currentMonthAmount = allTransactions
      .filter(t => t.rawTimestamp >= startOfCurrentMonth && t.rawTimestamp <= endOfCurrentMonthToDate)
      .reduce((acc, t) => acc + t.grossTotal, 0);

    const lastMonthAmount = allTransactions
      .filter(t => t.rawTimestamp >= startOfLastMonth && t.rawTimestamp <= endOfLastMonthToDate)
      .reduce((acc, t) => acc + t.grossTotal, 0);

    const monthDiff = currentMonthAmount - lastMonthAmount;
    const monthPercentageChange = lastMonthAmount > 0
      ? Number(((monthDiff / lastMonthAmount) * 100).toFixed(1))
      : (currentMonthAmount > 0 ? 100 : 0);

    // 2. Year-to-Date Comparison
    const startOfCurrentYear = new Date(currentYear, 0, 1).getTime();
    const startOfLastYear = new Date(currentYear - 1, 0, 1).getTime();
    const endOfLastYearToDate = new Date(currentYear - 1, currentMonth, currentDay, 23, 59, 59).getTime();

    const currentYearAmount = allTransactions
      .filter(t => t.rawTimestamp >= startOfCurrentYear && t.rawTimestamp <= endOfCurrentMonthToDate)
      .reduce((acc, t) => acc + t.grossTotal, 0);

    const lastYearAmount = allTransactions
      .filter(t => t.rawTimestamp >= startOfLastYear && t.rawTimestamp <= endOfLastYearToDate)
      .reduce((acc, t) => acc + t.grossTotal, 0);

    const yearDiff = currentYearAmount - lastYearAmount;
    const yearPercentageChange = lastYearAmount > 0
      ? Number(((yearDiff / lastYearAmount) * 100).toFixed(1))
      : (currentYearAmount > 0 ? 100 : 0);

    const comparisons = {
      monthly: {
        currentPeriodLabel: 'This Month',
        previousPeriodLabel: 'Last Month (Same Period)',
        currentAmount: currentMonthAmount,
        previousAmount: lastMonthAmount,
        difference: monthDiff,
        percentageChange: monthPercentageChange,
        trend: monthDiff >= 0 ? 'up' : 'down'
      },
      yearly: {
        currentPeriodLabel: 'This Year',
        previousPeriodLabel: 'Last Year (Same Period)',
        currentAmount: currentYearAmount,
        previousAmount: lastYearAmount,
        difference: yearDiff,
        percentageChange: yearPercentageChange,
        trend: yearDiff >= 0 ? 'up' : 'down'
      }
    };

    const report = {
      generatedAt: new Date().toISOString(),
      adminScope: `${user.role || 'Admin'} - ${user.district || user.state || 'Tamil Nadu'}`,
      summary: {
        totalSalesVolume: allTransactions.length,
        grossSalesValue: grossTransactionValue,
        grossTransactionValue,
        discountsGiven,
        netRevenue: successfulIncomingPayments,
        successfulIncomingPayments,
        pendingPayments,
        refundsAndReversals,
        outgoingPayments,
        commissionsAndFees,
        netBusinessInflow,
        totalServiceBookings: allTransactions.filter(t => t.type === 'Services').length,
        activeCustomerBase: scopedCustomers.length,
        activeMerchants: scopedVendors.length
      },
      comparisons,
      categoriesBreakdown,
      topVendors,
      ordersList: allTransactions,
      bookingsList: scopedBookings
    };

    return res.json({ success: true, report });
  } catch (error) {
    console.error('getBusinessReports error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate business reports', error: error.message });
  }
}


// GET /api/reports/dashboard - Manager Portal KPI widgets and analytics by role
const getDashboardStats = async (req, res) => {
  try {
    const user = req.user;
    const allVendors = Array.from(db.vendors);
    const vendors = filterByLocation(allVendors, user);

    const statusCounts = {
      total: vendors.length,
      active: vendors.filter(v => v.status === 'Active').length,
      pending: vendors.filter(v => v.status === 'Pending' || v.status === 'Under Review' || v.status === 'Pending Verification').length,
      underReview: vendors.filter(v => v.status === 'Under Review' || v.status === 'Pending KYC Review').length,
      rejected: vendors.filter(v => v.status === 'Rejected' || v.status === 'KYC Rejected').length,
      inactive: vendors.filter(v => v.status === 'Inactive').length
    };

    const categoryCounts = {};
    vendors.forEach(v => {
      const cat = v.category || 'Services';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    const allUsers = Array.from(db.users);
    let scopedManagers = allUsers;
    let managersBreakdownText = 'Active Managers';

    const rawRole = user.role || '';
    if (rawRole.includes('state') || rawRole === 'State Admin') {
      scopedManagers = allUsers.filter(u => u.stateId === user.stateId || u.state === user.state);
      const dCount = scopedManagers.filter(u => u.role === 'district_manager' || u.role === 'District Admin').length;
      const vCount = scopedManagers.filter(u => u.role === 'division_manager' || u.role === 'Divisional Admin').length;
      const pCount = scopedManagers.filter(u => u.role === 'pincode_manager' || u.role === 'Pincode Admin').length;
      managersBreakdownText = `${dCount} District | ${vCount} Division | ${pCount} Pincode`;
    } else if (rawRole.includes('district') || rawRole === 'District Admin') {
      scopedManagers = allUsers.filter(u => u.districtId === user.districtId || u.district === user.district);
      const vCount = scopedManagers.filter(u => u.role === 'division_manager' || u.role === 'Divisional Admin').length;
      const pCount = scopedManagers.filter(u => u.role === 'pincode_manager' || u.role === 'Pincode Admin').length;
      managersBreakdownText = `${vCount} Division | ${pCount} Pincode`;
    } else {
      scopedManagers = allUsers.filter(u => u.pincodeId === user.pincodeId || u.pincode === user.pincode);
      managersBreakdownText = `${scopedManagers.length} Pincode Managers`;
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());

    const todayTieups = vendors.filter(v => v.status === 'Active' && new Date(v.createdAt) >= startOfToday).length;
    const weekTieups = vendors.filter(v => v.status === 'Active' && new Date(v.createdAt) >= startOfWeek).length;

    const kpiMetrics = {
      totalManagers: scopedManagers.length,
      managersBreakdown: managersBreakdownText,
      totalVendors: vendors.length,
      activeVendors: statusCounts.active,
      pendingVendors: statusCounts.pending,
      totalShops: vendors.length,
      activeShops: statusCounts.active,
      inactiveShops: statusCounts.inactive + statusCounts.rejected,
      totalTieups: statusCounts.active,
      todayTieups,
      weekTieups,
      verifiedVendors: statusCounts.active,
      openIssues: (() => {
        const issues = filterByLocation(Array.from(db.qcIssues || []), user);
        return issues.filter(i => (i.status || '').toLowerCase() === 'open').length;
      })(),
      kycPending: statusCounts.pending,
      vendorRequests: statusCounts.pending
    };

    const recentVendors = [...vendors]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5);

    const scopedIssues = filterByLocation(Array.from(db.qcIssues || []), user);
    const issueCounts = {
      total: scopedIssues.length,
      open: scopedIssues.filter(i => (i.status || '').toLowerCase() === 'open').length,
      inProgress: scopedIssues.filter(i => ['in_progress', 'in progress', 'inprogress'].includes((i.status || '').toLowerCase())).length,
      escalated: scopedIssues.filter(i => (i.status || '').toLowerCase() === 'escalated').length,
      resolved: scopedIssues.filter(i => (i.status || '').toLowerCase() === 'resolved').length
    };

    res.json({
      success: true,
      role: user.role,
      statusCounts,
      issueCounts,
      categoryCounts,
      kpiMetrics,
      recentVendors
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ success: false, message: 'Failed to compile dashboard metrics' });
  }
};

// GET /api/reports/vendors - Report data export
const getVendorReportData = async (req, res) => {
  try {
    const user = req.user;
    const allVendors = Array.from(db.vendors);
    const vendors = filterByLocation(allVendors, user);

    const detailedList = vendors.map(v => ({
      id: v._id || v.id,
      name: v.name || v.businessName,
      mobile: v.mobile || v.phone,
      email: v.email,
      businessName: v.businessName || v.name,
      category: v.category,
      subCategory: v.subCategory || 'General',
      status: v.status,
      state: v.state,
      district: v.district,
      division: v.division,
      pincode: v.pincode,
      area: v.address || '',
      createdAt: v.createdAt
    }));

    res.json({
      success: true,
      total: detailedList.length,
      data: detailedList
    });
  } catch (err) {
    console.error('Vendor report error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
};

// GET /api/reports/leaderboard
const getLeaderboardData = async (req, res) => {
  try {
    const user = req.user;
    const allUsers = Array.from(db.users);
    const allVendors = Array.from(db.vendors);

    const managers = allUsers.filter(u => 
      ['state_manager', 'district_manager', 'division_manager', 'pincode_manager'].includes(u.role)
    );

    const formatRoleLabel = (role) => {
      switch (role) {
        case 'state_manager': return 'State Manager';
        case 'district_manager': return 'District Manager';
        case 'division_manager': return 'Division Manager';
        case 'pincode_manager': return 'Pincode Manager';
        default: return role;
      }
    };

    const colorPalette = ['#0284c7', '#8b5cf6', '#f59e0b', '#0d9488', '#ea580c', '#d97706', '#6366f1', '#ec4899'];

    const rankedList = managers.map((m, idx) => {
      const managerVendors = allVendors.filter(v => 
        v.createdBy === m._id || v.createdBy === m.id
      );

      const totalVendors = managerVendors.length;
      const activeVendors = managerVendors.filter(v => v.status === 'Active').length;
      const pendingVendors = managerVendors.filter(v => v.status === 'Pending' || v.status === 'Under Review').length;

      const basePoints = (activeVendors * 250) + (totalVendors * 80) + 120;
      const target = Math.max(totalVendors + 2, 5);
      const slaRate = totalVendors > 0 
        ? `${Math.min(99, Math.round((activeVendors / totalVendors) * 100))}%`
        : '95.0%';

      let territoryText = m.state || 'Assigned State';
      if (m.pincode) {
        territoryText = `PIN ${m.pincode}`;
      } else if (m.division) {
        territoryText = `${m.division}, ${m.district || ''}`;
      } else if (m.district) {
        territoryText = `${m.district}, ${m.state || ''}`;
      }

      const isSelf = String(m._id || m.id) === String(user.id || user._id);

      return {
        id: m._id || m.id,
        name: m.name,
        role: m.role,
        roleLabel: formatRoleLabel(m.role),
        level: `Level ${m.level || 1}`,
        territory: territoryText,
        stateId: m.stateId,
        stateName: m.state,
        vendorsOnboarded: totalVendors,
        activeVendors,
        pendingVendors,
        target,
        slaRate,
        points: basePoints,
        isSelf,
        rating: activeVendors > 0 ? 'Excellent' : 'Good',
        avatarBg: colorPalette[idx % colorPalette.length]
      };
    });

    rankedList.sort((a, b) => b.points - a.points || b.activeVendors - a.activeVendors);

    const rankedWithPosition = rankedList.map((item, index) => ({
      ...item,
      rank: index + 1
    }));

    res.json({
      success: true,
      count: rankedWithPosition.length,
      data: rankedWithPosition,
      top3: rankedWithPosition.slice(0, 3)
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate leaderboard' });
  }
};


// Submit a manager period report
const submitManagerReport = async (req, res) => {
  try {
    const user = req.user;
    const {
      periodLabel,
      dateRange,
      startDate,
      endDate,
      summary,
      shopVisits = [],
      tasks = []
    } = req.body;

    if (!periodLabel) {
      return res.status(400).json({ success: false, message: 'Report period is required.' });
    }

    const reportId = `rpt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const pinPart = (user.pincode || user.division || user.district || 'GEN').replace(/\s+/g, '').toUpperCase();
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const reportNumber = `RPT-${pinPart}-${datePart}-${Math.floor(100 + Math.random() * 900)}`;

    const newReport = {
      _id: reportId,
      id: reportId,
      reportNumber,
      periodLabel,
      dateRange: dateRange || periodLabel,
      startDate: startDate || new Date().toISOString(),
      endDate: endDate || new Date().toISOString(),
      managerId: user._id || user.id,
      managerName: user.name || 'Field Manager',
      managerRole: user.role || 'pincode_manager',
      managerEmail: user.email || '',
      managerPhone: user.phone || user.mobile || '',
      state: user.state || 'Tamil Nadu',
      district: user.district || '',
      division: user.division || '',
      pincode: user.pincode || '',
      stateId: user.stateId || null,
      districtId: user.districtId || null,
      divisionId: user.divisionId || null,
      pincodeId: user.pincodeId || null,
      summary: summary || {
        totalVisits: shopVisits.length,
        interested: shopVisits.filter(v => v.interestedStatus === 'YES').length,
        notInterested: shopVisits.filter(v => v.interestedStatus === 'NO').length,
        newTieups: shopVisits.filter(v => v.vendorId).length,
        tasksAssigned: tasks.length,
        tasksCompleted: tasks.filter(t => t.status === 'Completed').length,
        tasksPending: tasks.filter(t => t.status !== 'Completed').length
      },
      shopVisits,
      tasks,
      status: 'Submitted',
      submittedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    if (db.submittedReports) {
      await db.submittedReports.insertOne(newReport);
    }

    return res.status(201).json({
      success: true,
      message: 'Report submitted successfully and forwarded to supervisory managers.',
      data: newReport
    });
  } catch (err) {
    console.error('Submit report error:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit report', error: err.message });
  }
};

function enrichReportWithTerritory(rpt) {
  if (!rpt) return rpt;
  if (!rpt.state || !rpt.district || !rpt.division || !rpt.pincode) {
    const mgrId = String(rpt.managerId || '').trim();
    const mgrName = String(rpt.managerName || '').trim().toLowerCase();
    const mgr = Array.from(db.users || []).find(u => (mgrId && String(u._id || u.id) === mgrId) || (mgrName && u.name && u.name.trim().toLowerCase() === mgrName)) ||
                Array.from(db.managers || []).find(m => (mgrId && String(m._id || m.id) === mgrId) || (mgrName && m.name && m.name.trim().toLowerCase() === mgrName));
    if (mgr) {
      if (!rpt.state) rpt.state = mgr.state || mgr.assignedState || '';
      if (!rpt.district) rpt.district = mgr.district || mgr.assignedDistrict || '';
      if (!rpt.division) rpt.division = mgr.division || mgr.assignedDivision || '';
      if (!rpt.pincode) rpt.pincode = mgr.pincode || mgr.assignedPincode || '';
    }
  }

  // Construct territory display field if not present or placeholder
  if (!rpt.territory || rpt.territory === '—' || rpt.territory === '-') {
    const parts = [
      rpt.pincode ? `PIN: ${rpt.pincode}` : null,
      rpt.division ? `${rpt.division} Division` : null,
      rpt.district ? `${rpt.district} District` : null,
      rpt.state || null
    ].filter(Boolean);
    rpt.territory = parts.length > 0 ? parts.join(', ') : '—';
  }
  return rpt;
}

function isReportInTerritoryScope(rpt, user) {
  if (!user || !rpt) return false;
  enrichReportWithTerritory(rpt);

  const rawRole = (user.role || '').toLowerCase();
  const userAdminRole = (user.adminRole || '').toLowerCase();
  const isSuper = (rawRole.includes('super admin') || rawRole === 'superadmin' || user.role === 'Super Admin' || (rawRole === 'admin' && !userAdminRole.includes('state') && !userAdminRole.includes('district') && !userAdminRole.includes('division') && !userAdminRole.includes('pincode'))) && (!user.state || user.state.toLowerCase() === 'all india');
  if (isSuper) return true;

  const clean = (val) => String(val || '').trim().toLowerCase().replace(/\s+(district|division|state)$/, '').trim();

  const userState = clean(user.state || user.assignedState || user.scope?.stateName);
  const rptState = clean(rpt.state);
  const userDist = clean(user.district || user.assignedDistrict || user.scope?.districtName);
  const rptDist = clean(rpt.district);
  const userDiv = clean(user.division || user.assignedDivision || user.scope?.divisionName);
  const rptDiv = clean(rpt.division);
  const userPin = String(user.pincode || user.assignedPincode || user.pincodeCode || user.scope?.pincodeCode || '').trim();
  const rptPin = String(rpt.pincode || '').trim();

  // State Admin / State Manager (or admin scoped to state)
  if (rawRole.includes('state') || (rawRole === 'admin' && userState)) {
    if (!userState || userState === 'all india') return true;
    return Boolean(rptState && rptState === userState);
  }

  // District Admin / District Manager
  if (rawRole.includes('district')) {
    if (userState && userState !== 'all india' && rptState && rptState !== userState) return false;
    if (!userDist || userDist === 'all districts') return true;
    return Boolean(rptDist && rptDist === userDist);
  }

  // Divisional Admin / Division Manager
  if (rawRole.includes('division') || rawRole.includes('divisional')) {
    if (userState && userState !== 'all india' && rptState && rptState !== userState) return false;
    if (userDist && userDist !== 'all districts' && rptDist && rptDist !== userDist) return false;
    if (!userDiv || userDiv === 'all divisions') return true;
    return Boolean(rptDiv && rptDiv === userDiv);
  }

  // Pincode Admin / Pincode Manager
  if (rawRole.includes('pincode')) {
    const isSelf = rpt.managerId === user._id || rpt.managerId === user.id;
    const isPin = Boolean(userPin && rptPin && rptPin === userPin);
    return isPin || isSelf;
  }

  return false;
}

// Get hierarchical submitted reports
const getSubmittedReports = async (req, res) => {
  try {
    const user = req.user;
    const allReports = Array.from(db.submittedReports || []).map(r => enrichReportWithTerritory({ ...r }));
    const { district, division, pincode, managerRole, period, search } = req.query;

    // 1. RBAC Hierarchy Filter (Strict Territory Cascading)
    let filtered = allReports.filter(rpt => isReportInTerritoryScope(rpt, user));

    // Dynamic dependent hierarchy: available districts based on authorized scope
    const availableDistricts = Array.from(new Set(filtered.map(r => r.district).filter(Boolean)));

    // 2. Query Filters
    if (district && district !== 'All' && district !== 'All Districts') {
      const cleanDist = String(district).trim().toLowerCase().replace(/\s+district$/, '');
      filtered = filtered.filter(r => {
        const rd = String(r.district || '').trim().toLowerCase().replace(/\s+district$/, '');
        return rd === cleanDist || r.districtId === district;
      });
    }

    // Dynamic dependent divisions based on selected district
    const availableDivisions = Array.from(new Set(filtered.map(r => r.division).filter(Boolean)));

    if (division && division !== 'All' && division !== 'All Divisions') {
      const cleanDiv = String(division).trim().toLowerCase().replace(/\s+division$/, '');
      filtered = filtered.filter(r => {
        const rv = String(r.division || '').trim().toLowerCase().replace(/\s+division$/, '');
        return rv === cleanDiv || r.divisionId === division;
      });
    }

    // Dynamic dependent pincodes based on selected division
    const availablePincodes = Array.from(new Set(filtered.map(r => r.pincode).filter(Boolean)));

    if (pincode && pincode !== 'All' && pincode !== 'All Pincodes') {
      filtered = filtered.filter(r => String(r.pincode).trim() === String(pincode).trim() || r.pincodeId === pincode);
    }
    if (managerRole && managerRole !== 'All' && managerRole !== 'All Manager Tiers') {
      filtered = filtered.filter(r => (r.managerRole || '').toLowerCase().includes(managerRole.toLowerCase()));
    }
    if (period && period !== 'All') {
      filtered = filtered.filter(r => (r.periodLabel || '').toLowerCase().includes(period.toLowerCase()));
    }
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(r =>
        (r.managerName && r.managerName.toLowerCase().includes(q)) ||
        (r.reportNumber && r.reportNumber.toLowerCase().includes(q)) ||
        (r.pincode && r.pincode.toLowerCase().includes(q)) ||
        (r.district && r.district.toLowerCase().includes(q)) ||
        (r.division && r.division.toLowerCase().includes(q))
      );
    }

    // Sort newest first
    filtered.sort((a, b) => new Date(b.submittedAt || b.createdAt) - new Date(a.submittedAt || a.createdAt));

    return res.json({
      success: true,
      data: filtered,
      count: filtered.length,
      hierarchy: {
        districts: availableDistricts,
        divisions: availableDivisions,
        pincodes: availablePincodes
      }
    });
  } catch (err) {
    console.error('Get submitted reports error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve submitted reports', error: err.message });
  }
};

// Get single submitted report by ID
const getSubmittedReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const allReports = Array.from(db.submittedReports || []);
    const report = allReports.find(r => r._id === id || r.id === id || r.reportNumber === id);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Submitted report not found.' });
    }

    // Enforce territorial authorization check
    if (!isReportInTerritoryScope(report, req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to view reports outside your authorized territory.' });
    }

    // Enrich shop visits with live vendor approval & kyc info if applicable
    const enrichedVisits = (report.shopVisits || []).map(v => {
      if (v.vendorId) {
        const found = Array.from(db.vendors || []).find(vend => vend.id === v.vendorId || vend._id === v.vendorId);
        if (found) {
          return {
            ...v,
            vendor: {
              id: found.id || found._id,
              businessName: found.businessName || found.name,
              contactPerson: found.contactPerson || found.ownerName,
              phone: found.phone || found.mobile,
              approvalStatus: found.approvalStatus || 'Pending Pincode Admin Approval',
              kycStatus: found.kycStatus || 'Pending Verification',
              status: found.status || 'Under Review',
              adminApprovedBy: found.adminApprovedBy || null,
              documents: found.documents || []
            }
          };
        }
      }
      return v;
    });

    return res.json({
      success: true,
      data: {
        ...report,
        shopVisits: enrichedVisits
      }
    });
  } catch (err) {
    console.error('Get report by ID error:', err);
    return res.status(500).json({ success: false, message: 'Failed to get report details', error: err.message });
  }
};

// Approve a submitted manager report (Pincode Admin only, for pincode_manager reports)
const approveManagerReport = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { remarks } = req.body;

    const rawRole = (user?.role || '').toLowerCase();
    // Only Pincode Admin (and higher roles) can approve reports
    const canApprove = rawRole.includes('pincode') || rawRole.includes('district') ||
                       rawRole.includes('division') || rawRole.includes('state') ||
                       rawRole.includes('super') || rawRole === 'admin';

    if (!canApprove) {
      return res.status(403).json({ success: false, message: 'You do not have permission to approve reports.' });
    }

    const allReports = Array.from(db.submittedReports || []);
    const reportIndex = allReports.findIndex(r => r._id === id || r.id === id || r.reportNumber === id);

    if (reportIndex === -1) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    const report = allReports[reportIndex];

    // Scope check: Pincode Admin can only approve reports in their pincode
    if (rawRole.includes('pincode admin') || rawRole === 'pincode_admin') {
      const userPin = String(user.pincode || user.pincodeCode || '').trim();
      const rptPin = String(report.pincode || '').trim();
      if (userPin && rptPin !== userPin) {
        return res.status(403).json({ success: false, message: 'You can only approve reports from your assigned pincode.' });
      }
    }

    // Update approval status
    const updatedReport = {
      ...report,
      approvalStatus: 'Approved',
      status: 'Approved',
      approvedBy: user.name || user.username || 'Admin',
      approvedByRole: user.role,
      approvedByUserId: user._id || user.id,
      approvedAt: new Date().toISOString(),
      approvalRemarks: remarks || ''
    };

    await db.submittedReports.findByIdAndUpdate(report._id || report.id, updatedReport);

    return res.json({
      success: true,
      message: `Report ${report.reportNumber} approved successfully.`,
      data: updatedReport
    });
  } catch (err) {
    console.error('Approve report error:', err);
    return res.status(500).json({ success: false, message: 'Failed to approve report', error: err.message });
  }
};

// Reject a submitted manager report with remarks
const rejectManagerReport = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { remarks } = req.body;

    const rawRole = (user?.role || '').toLowerCase();
    const canReject = rawRole.includes('pincode') || rawRole.includes('district') ||
                      rawRole.includes('division') || rawRole.includes('state') ||
                      rawRole.includes('super') || rawRole === 'admin';

    if (!canReject) {
      return res.status(403).json({ success: false, message: 'You do not have permission to reject reports.' });
    }

    const allReports = Array.from(db.submittedReports || []);
    const reportIndex = allReports.findIndex(r => r._id === id || r.id === id || r.reportNumber === id);

    if (reportIndex === -1) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    const report = allReports[reportIndex];

    // Scope check
    if (rawRole.includes('pincode admin') || rawRole === 'pincode_admin') {
      const userPin = String(user.pincode || user.pincodeCode || '').trim();
      const rptPin = String(report.pincode || '').trim();
      if (userPin && rptPin !== userPin) {
        return res.status(403).json({ success: false, message: 'You can only reject reports from your assigned pincode.' });
      }
    }

    const updatedReport = {
      ...report,
      approvalStatus: 'Rejected',
      status: 'Rejected',
      rejectedBy: user.name || user.username || 'Admin',
      rejectedByRole: user.role,
      rejectedByUserId: user._id || user.id,
      rejectedAt: new Date().toISOString(),
      rejectionRemarks: remarks || 'Report rejected by supervisor.'
    };

    await db.submittedReports.findByIdAndUpdate(report._id || report.id, updatedReport);

    return res.json({
      success: true,
      message: `Report ${report.reportNumber} rejected.`,
      data: updatedReport
    });
  } catch (err) {
    console.error('Reject report error:', err);
    return res.status(500).json({ success: false, message: 'Failed to reject report', error: err.message });
  }
};

/**
 * Get Territory-Scoped Agent Reports for Business Reports
 */
const getAgentReports = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const allAgents = Array.from(db.agents || []);
    const scopedAgents = getHierarchicalScopedAgents(allAgents, user);

    const {
      level,
      status,
      search,
      state,
      district,
      division,
      pincode,
      startDate,
      endDate
    } = req.query;

    const allVendors = Array.from(db.vendors || []);
    const allVisits = Array.from(db.shopVisits || []);

    let reports = scopedAgents.map((agent) => {
      const aId = String(agent._id || agent.id || '');
      const t = getAgentTerritory(agent);
      const agentLevel = normalizeLevel(getAgentLevel(agent));

      // Real vendor referrals
      const referredVendors = allVendors.filter(v => {
        const vAgentId = String(v.agentId || v.submittedByAgentId || v.referredByAgentId || '');
        return vAgentId && (vAgentId === aId || vAgentId === String(agent.id) || vAgentId === String(agent._id));
      });

      const successfulOnboardings = referredVendors.filter(v => {
        const s = String(v.status || v.approvalStatus || '').toLowerCase();
        return s === 'approved' || s === 'active' || s.includes('approved');
      });

      // Field visits
      const agentVisits = allVisits.filter(v => {
        const vId = String(v.agentId || v.executiveId || v.userId || '');
        return vId && (vId === aId || vId === String(agent.id) || vId === String(agent._id));
      });

      const totalReferrals = referredVendors.length || Number(agent.referralCount || agent.referrals || 0);
      const totalOnboarded = successfulOnboardings.length || Number(agent.vendorsOnboarded || agent.onboarded || 0);
      const totalVisits = agentVisits.length || Number(agent.shopVisitsCount || 0);

      // Performance score calculation
      let performanceScore = Math.min(100, Math.round(totalOnboarded * 25 + totalVisits * 5 + (totalReferrals > totalOnboarded ? 10 : 0)));
      if (performanceScore === 0 && (agent.status === 'Active' || agent.status === 'approved')) {
        performanceScore = 50; // default baseline for active agents
      }

      const regDate = agent.createdAt || agent.registrationDate || agent.joinedDate || agent.date || null;

      return {
        id: aId,
        _id: aId,
        agentId: agent.agentId || agent.agentCode || `AGT-${aId.slice(-6).toUpperCase()}`,
        name: agent.name || agent.fullName || 'Unknown Agent',
        mobile: agent.mobile || agent.phone || 'N/A',
        email: agent.email || 'N/A',
        level: agentLevel || 'pincode',
        role: agent.role || agentLevel,
        status: (agent.status && agent.status.toLowerCase() === 'approved') ? 'Active' : (agent.status || 'Active'),
        state: t.state || agent.state || 'N/A',
        district: t.district || agent.district || 'N/A',
        division: t.division || agent.division || 'N/A',
        pincode: t.pincode || agent.pincode || 'N/A',
        registrationDate: regDate,
        createdAt: regDate,
        vendorReferrals: totalReferrals,
        vendorsOnboarded: totalOnboarded,
        fieldVisits: totalVisits,
        performanceScore,
        walletBalance: agent.walletBalance || 0,
        referredVendorsList: referredVendors.map(v => ({
          id: v._id || v.id,
          businessName: v.businessName || v.name,
          status: v.status || v.approvalStatus || 'Pending',
          category: v.category || v.businessCategory || 'Retail',
          createdAt: v.createdAt || v.date
        }))
      };
    });

    // Apply level filter
    if (level && level !== 'All') {
      const targetLvl = normalizeLevel(level);
      reports = reports.filter(r => r.level === targetLvl);
    }

    // Apply status filter
    if (status && status !== 'All') {
      reports = reports.filter(r => r.status.toLowerCase() === status.toLowerCase());
    }

    // Apply territory filters
    if (state && state.trim()) {
      reports = reports.filter(r => (r.state || '').toLowerCase() === state.trim().toLowerCase());
    }
    if (district && district.trim()) {
      reports = reports.filter(r => (r.district || '').toLowerCase() === district.trim().toLowerCase());
    }
    if (division && division.trim()) {
      reports = reports.filter(r => (r.division || '').toLowerCase().includes(division.trim().toLowerCase()));
    }
    if (pincode && pincode.trim()) {
      reports = reports.filter(r => String(r.pincode || '').trim() === pincode.trim());
    }

    // Apply date range filter
    if (startDate) {
      const start = new Date(startDate).getTime();
      reports = reports.filter(r => !r.registrationDate || new Date(r.registrationDate).getTime() >= start);
    }
    if (endDate) {
      const end = new Date(endDate).getTime() + (24 * 60 * 60 * 1000);
      reports = reports.filter(r => !r.registrationDate || new Date(r.registrationDate).getTime() <= end);
    }

    // Apply search filter
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      reports = reports.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.agentId.toLowerCase().includes(q) ||
        r.mobile.includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.pincode.includes(q) ||
        r.district.toLowerCase().includes(q) ||
        r.division.toLowerCase().includes(q)
      );
    }

    // Sort: newest registration first
    reports.sort((a, b) => new Date(b.registrationDate || 0) - new Date(a.registrationDate || 0));

    // Summary KPIs
    const totalAgents = reports.length;
    const activeAgents = reports.filter(r => r.status === 'Active').length;
    const totalReferrals = reports.reduce((acc, r) => acc + (r.vendorReferrals || 0), 0);
    const totalOnboarded = reports.reduce((acc, r) => acc + (r.vendorsOnboarded || 0), 0);
    const avgScore = totalAgents > 0 ? Math.round(reports.reduce((acc, r) => acc + r.performanceScore, 0) / totalAgents) : 0;

    return res.json({
      success: true,
      data: reports,
      count: totalAgents,
      summary: {
        totalAgents,
        activeAgents,
        totalReferrals,
        totalOnboarded,
        avgScore
      }
    });
  } catch (err) {
    console.error('Get agent reports error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve agent reports', error: err.message });
  }
};

module.exports = {
  getDashboardSummary,
  getBusinessReports,
  getDashboardStats,
  getVendorReportData,
  getLeaderboardData,
  submitManagerReport,
  getSubmittedReports,
  getSubmittedReportById,
  approveManagerReport,
  rejectManagerReport,
  getAgentReports
};

