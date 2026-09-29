const { db, filterByLocation } = require('../config/db');

// Helper to format ISO date string into readable order date
function formatOrderDate(dateVal) {
  if (!dateVal) return '-';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return String(dateVal);
  }
}

// Build index of pincodes for fast location hierarchy enrichment
function getPincodeDirectory() {
  const pinMap = new Map();
  Array.from(db.pincodes || []).forEach(p => {
    const code = String(p.code || p.pincode || '').trim();
    if (code && !pinMap.has(code)) {
      pinMap.set(code, {
        state: p.state || p.stateName || 'Tamil Nadu',
        district: p.district || p.districtName || '',
        division: p.division || p.divisionName || '',
        pincode: code,
        area: p.name || p.area || p.areaName || ''
      });
    }
  });
  return pinMap;
}

function normalizeOrder(order, pinMap, vendorMap, historyMap) {
  if (!order) return null;

  const orderId = String(order.id || order._id || '');
  const orderNumber = order.order_number || order.orderNumber || order.id || order._id || '-';

  // Extract address and pincode
  const customerAddress = order.customer_address || order.customerAddress || order.deliveryAddress || order.address || '';
  let pincode = String(order.pincode || order.deliveryPincode || '').trim();
  if (!pincode && customerAddress) {
    const pinMatch = customerAddress.match(/\b\d{6}\b/);
    if (pinMatch) pincode = pinMatch[0];
  }

  // Resolve geographic hierarchy from pincode or customer address
  const pinGeo = pinMap.get(pincode) || {};
  let state = order.state || order.stateName || pinGeo.state || '';
  let district = order.district || order.districtName || order.deliveryDistrict || pinGeo.district || '';
  let division = order.division || order.divisionName || order.deliveryDivision || pinGeo.division || '';

  // Extract from address string if still missing
  if (!district && customerAddress) {
    const addrUpper = customerAddress.toUpperCase();
    if (addrUpper.includes('SALEM')) district = 'Salem';
    else if (addrUpper.includes('ERODE')) district = 'Erode';
    else if (addrUpper.includes('KRISHNAGIRI')) district = 'Krishnagiri';
    else if (addrUpper.includes('DHARMAPURI')) district = 'Dharmapuri';
    else if (addrUpper.includes('NAMAKKAL')) district = 'Namakkal';
    else if (addrUpper.includes('TIRUPPUR') || addrUpper.includes('TIRUPUR')) district = 'Tiruppur';
    else if (addrUpper.includes('COIMBATORE')) district = 'Coimbatore';
  }

  if (!division && customerAddress) {
    const addrUpper = customerAddress.toUpperCase();
    if (addrUpper.includes('THALAIVASAL')) division = 'Thalaivasal';
    else if (addrUpper.includes('ATTUR')) division = 'Attur';
    else if (addrUpper.includes('SALEM NORTH')) division = 'Salem North';
    else if (addrUpper.includes('SALEM SOUTH')) division = 'Salem South';
    else if (addrUpper.includes('HOSUR')) division = 'Hosur';
  }

  if (!state) {
    state = customerAddress.toLowerCase().includes('karnataka') ? 'Karnataka' : 'Tamil Nadu';
  }

  // Items normalization
  let items = Array.isArray(order.items) && order.items.length > 0 ? order.items : [];
  if (items.length === 0 && order.product_details) {
    items = [{
      productId: order.productId || 'PRD-01',
      name: order.product_details,
      quantity: 1,
      qty: 1,
      price: order.amount || order.totalAmount || 0,
      category: order.type || 'Products'
    }];
  }

  const normalizedItems = items.map(item => {
    const qty = Number(item.quantity || item.qty || 1);
    const price = Number(item.price || item.unitPrice || 0);
    return {
      productId: item.productId || item.id || '-',
      name: item.name || item.productName || item.title || order.product_details || 'Product Item',
      quantity: qty,
      qty: qty,
      price: price,
      unitPrice: price,
      category: item.category || order.type || 'Products',
      variant: item.variant || item.variantName || null,
      image: item.image || item.imageUrl || null
    };
  });

  // Calculate financials
  const rawSubtotal = Number(order.amount || order.subtotal || 0);
  const rawTotal = Number(order.totalAmount || order.finalAmount || order.amount || 0);
  const discountAmount = Number(order.discountAmount || order.discount || 0);
  const deliveryFee = Number(order.deliveryFee || order.delivery_fee || order.shippingFee || 0);
  const tax = Number(order.tax || order.taxAmount || 0);
  const netPayable = rawTotal || (rawSubtotal - discountAmount + deliveryFee + tax);

  // Vendor Enrichment from vendors and settlements
  const vendorKey = String(order.vendor_id || order.vendorId || '').trim();
  const matchedVendor = vendorKey ? vendorMap.get(vendorKey) : null;
  const vendorName = matchedVendor ? (matchedVendor.businessName || matchedVendor.name || matchedVendor.vendorBusinessName) : (order.vendorName || 'Not provided');
  const vendorBusinessName = matchedVendor ? (matchedVendor.businessName || matchedVendor.vendorBusinessName || matchedVendor.name) : (order.vendorBusinessName || vendorName);
  const vendorId = matchedVendor ? (matchedVendor._id || matchedVendor.id || matchedVendor.vendorId) : (vendorKey || 'Not provided');
  const vendorCategory = matchedVendor ? (matchedVendor.category || matchedVendor.subCategory || '-') : (order.vendorCategory || 'Not provided');
  const vendorContact = matchedVendor ? (matchedVendor.contactPerson || matchedVendor.phone || matchedVendor.mobile || '-') : (order.vendorContact || order.vendorPhone || 'Not provided');
  const vendorPhone = matchedVendor ? (matchedVendor.phone || matchedVendor.mobile) : (order.vendorPhone || 'Not provided');
  const vendorEmail = matchedVendor ? matchedVendor.email : (order.vendorEmail || 'Not provided');
  const vendorLocation = matchedVendor ? (matchedVendor.address || (matchedVendor.district ? `${matchedVendor.district}${matchedVendor.division ? `, ${matchedVendor.division}` : ''}` : 'Not provided')) : (order.vendorLocation || (district ? `${district}${division ? `, ${division}` : ''}` : 'Not provided'));

  // Build Real Timeline from delivery_status_history
  const rawHist = (historyMap && (historyMap.get(orderId) || historyMap.get(orderNumber) || historyMap.get(String(order._id)))) || [];
  const sortedHist = [...rawHist].sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

  const timeline = sortedHist.map(h => ({
    status: h.status,
    time: formatOrderDate(h.timestamp),
    timestamp: h.timestamp,
    desc: h.notes || `Order ${h.status}`,
    updatedBy: h.updated_by || 'System'
  }));

  // Ensure initial order placed timestamp is present
  const orderCreatedTime = order.created_at || order.createdAt || order.orderDate;
  if (!timeline.some(t => (t.status || '').toLowerCase() === 'order placed' || (t.status || '').toLowerCase() === 'order received')) {
    timeline.unshift({
      status: 'Order Placed',
      time: formatOrderDate(orderCreatedTime),
      timestamp: orderCreatedTime,
      desc: 'Customer placed order through catalog',
      updatedBy: 'Customer'
    });
  }

  return {
    ...order,
    id: orderId,
    _id: orderId,
    orderId: orderId,
    orderNumber,
    order_number: orderNumber,
    orderDate: formatOrderDate(orderCreatedTime),
    orderTime: orderCreatedTime ? new Date(orderCreatedTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'Not provided',
    created_at: orderCreatedTime,
    customerName: order.customer_name || order.customerName || order.memberName || 'Customer',
    customer_name: order.customer_name || order.customerName || order.memberName || 'Customer',
    customerId: order.customerId || order.customerDisplayId || order.memberId || 'Not provided',
    customerPhone: order.customer_phone || order.customerPhone || order.phone || 'Not provided',
    customerEmail: order.customerEmail || order.email || order.candidateEmail || 'Not provided',
    customerAddress: customerAddress || 'Not provided',
    customer_address: customerAddress || 'Not provided',
    state,
    district,
    division,
    pincode,
    deliveryDistrict: district,
    deliveryDivision: division,
    deliveryPincode: pincode,
    items: normalizedItems,
    itemsCount: normalizedItems.reduce((acc, it) => acc + (it.qty || 1), 0),
    amount: rawSubtotal || netPayable,
    subtotal: rawSubtotal || netPayable,
    totalAmount: netPayable,
    finalAmount: netPayable,
    netPayable: netPayable,
    discountAmount,
    deliveryFee,
    tax,
    paymentMode: order.payment_method || order.paymentMethod || 'Online',
    paymentStatus: order.payment_status || order.paymentStatus || 'Paid',
    status: order.status || order.orderStatus || 'Unknown',
    membershipTier: order.membershipTier || order.tier || 'standard',
    vendorId,
    vendor_id: vendorId,
    vendorName,
    vendorBusinessName,
    vendorCategory,
    vendorContact,
    vendorPhone,
    vendorEmail,
    vendorLocation,
    deliveryPartnerName: order.deliveryPartnerName || order.deliveryPartner?.name || 'Not provided',
    deliveryPartnerId: order.deliveryPartnerId || order.deliveryPartner?.id || 'Not provided',
    deliveryPartnerPhone: order.deliveryPartnerPhone || order.deliveryPartner?.phone || 'Not provided',
    deliveryStatus: order.deliveryStatus || order.status || 'Not provided',
    deliveryAssignedAt: order.deliveryAssignedAt ? formatOrderDate(order.deliveryAssignedAt) : 'Not provided',
    timeline
  };
}

function getOrders(req, res) {
  try {
    const rawOrders = Array.from(db.orders || []);
    // Scope geographically according to user role
    let scoped = filterByLocation(rawOrders, req.user);

    // Keep commerce orders for the Orders ledger
    const { type } = req.query;
    if (type) {
      scoped = scoped.filter(o => (o.type || '').toLowerCase() === type.toLowerCase());
    } else {
      scoped = scoped.filter(o => o.type !== 'Job');
    }

    const pinMap = getPincodeDirectory();

    // Fast vendor map from db.vendors and db.settlements
    const vendorMap = new Map();
    Array.from(db.vendors || []).forEach(v => {
      const vId = String(v._id || v.id || '').trim();
      if (vId) vendorMap.set(vId, v);
    });

    // Augment with settlements for business name mapping
    Array.from(db.settlements || []).forEach(s => {
      const vId = String(s.vendorId || s._id || s.id || '').trim();
      if (vId) {
        const existing = vendorMap.get(vId) || {};
        vendorMap.set(vId, {
          ...existing,
          businessName: existing.businessName || existing.name || s.vendorBusinessName,
          vendorBusinessName: s.vendorBusinessName || existing.businessName,
          _id: vId,
          id: vId
        });
      }
    });

    // Build status history lookup map
    const historyMap = new Map();
    Array.from(db.deliveryStatusHistory || []).forEach(h => {
      const oId = String(h.order_id || h.order_number || '');
      if (oId) {
        if (!historyMap.has(oId)) historyMap.set(oId, []);
        historyMap.get(oId).push(h);
      }
    });

    const normalizedOrders = scoped.map(o => normalizeOrder(o, pinMap, vendorMap, historyMap)).filter(Boolean);

    const { search, status, pincode, district, division } = req.query;
    let filtered = normalizedOrders;

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(o =>
        (o.orderNumber && o.orderNumber.toLowerCase().includes(q)) ||
        (o.customerName && o.customerName.toLowerCase().includes(q)) ||
        (o.pincode && o.pincode.includes(q)) ||
        (o.district && o.district.toLowerCase().includes(q)) ||
        (o.division && o.division.toLowerCase().includes(q)) ||
        (o.items && o.items.some(i => i.name && i.name.toLowerCase().includes(q)))
      );
    }

    if (status && status !== 'all') {
      filtered = filtered.filter(o => (o.status || '').toLowerCase() === status.toLowerCase());
    }

    if (pincode && req.user.role !== 'Pincode Admin') {
      filtered = filtered.filter(o => o.pincode === pincode);
    }

    if (district && district !== 'all') {
      filtered = filtered.filter(o => (o.district || '').toLowerCase() === district.toLowerCase());
    }

    if (division && division !== 'all') {
      filtered = filtered.filter(o => (o.division || '').toLowerCase() === division.toLowerCase());
    }

    return res.json({
      success: true,
      count: filtered.length,
      total: filtered.length,
      orders: filtered,
      data: filtered
    });
  } catch (error) {
    console.error('[getOrders] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch orders', error: error.message });
  }
}

async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const order = await db.orders.findById(id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const scoped = filterByLocation([order], req.user);
    if (scoped.length === 0) {
      return res.status(403).json({ success: false, message: 'Order outside your jurisdiction' });
    }

    const updates = { status, updatedAt: new Date().toISOString() };
    const updatedOrder = await db.orders.findByIdAndUpdate(order._id || order.id, updates);

    return res.json({ success: true, message: `Order status updated to ${status}`, order: updatedOrder || { ...order, ...updates } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update order', error: error.message });
  }
}

module.exports = {
  getOrders,
  updateOrderStatus
};
