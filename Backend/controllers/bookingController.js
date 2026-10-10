const { db, filterByLocation } = require('../config/db');
const { resolveAdminTerritory, isEntityInAdminTerritory } = require('../utils/permissions');

// Helper to format ISO date string into readable date
function formatBookingDate(dateVal) {
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

function normalizeBooking(item, pinMap, vendorMap, historyMap, matchedVendorArg) {
  if (!item) return null;

  const bId = String(item.id || item._id || item.bookingNumber || '');
  const bookingNumber = item.order_number || item.bookingNumber || item.id || item._id || '-';

  // Vendor Lookup
  const vendorKey = String(item.vendor_id || item.vendorId || '').trim();
  const matchedVendor = matchedVendorArg || (vendorKey ? (vendorMap instanceof Map ? (vendorMap.get(vendorKey) || vendorMap.get(vendorKey.toLowerCase())) : null) : null);

  const vendorBusinessName = matchedVendor ? (matchedVendor.businessName || matchedVendor.name || matchedVendor.vendorBusinessName) : (item.vendorBusinessName || item.vendorName || item.hotelName || item.businessName || 'Merchant Enterprise');
  const vendorName = matchedVendor ? (matchedVendor.vendorName || matchedVendor.name || vendorBusinessName) : (item.vendorName || vendorBusinessName);
  const vendorId = matchedVendor ? (matchedVendor.vendorId || matchedVendor.registrationId || matchedVendor._id || matchedVendor.id) : (vendorKey || 'Not provided');
  const vendorPhone = matchedVendor ? matchedVendor.phone : (item.vendorPhone || '');
  const vendorEmail = matchedVendor ? matchedVendor.email : (item.vendorEmail || '');
  const vendorLocation = matchedVendor ? (matchedVendor.fullAddress || matchedVendor.address || `${matchedVendor.district || ''}, ${matchedVendor.state || ''}`) : (item.vendorLocation || 'Not provided');
  const vendorState = matchedVendor ? matchedVendor.state : '';
  const vendorDistrict = matchedVendor ? matchedVendor.district : '';
  const vendorDivision = matchedVendor ? matchedVendor.division : '';
  const vendorPincode = matchedVendor ? matchedVendor.pincode : '';
  const vendorStateId = matchedVendor?.stateId || item.vendorStateId || null;
  const vendorDistrictId = matchedVendor?.districtId || item.vendorDistrictId || null;
  const vendorDivisionId = matchedVendor?.divisionId || item.vendorDivisionId || null;
  const vendorPincodeId = matchedVendor?.pincodeId || item.vendorPincodeId || null;

  // Geographic coordinates - VENDOR / BUSINESS TERRITORY IS SOURCE OF TRUTH (Part 10)
  let state = vendorState || '';
  let district = vendorDistrict || '';
  let division = vendorDivision || '';
  let pincode = vendorPincode || '';

  // If vendor territory is incomplete, enrich from vendor's postal pincode
  if (pincode && (!state || !district || !division)) {
    const vPinGeo = pinMap.get(pincode) || {};
    if (!state) state = vPinGeo.state || '';
    if (!district) district = vPinGeo.district || '';
    if (!division) division = vPinGeo.division || '';
  }

  // Fallback to item territory if vendor was completely unassigned
  if (!state && item.state) state = item.state;
  if (!district && item.district) district = item.district;
  if (!division && item.division) division = item.division;
  if (!pincode && (item.pincode || item.deliveryPincode)) pincode = item.pincode || item.deliveryPincode;
  if (!state) state = 'Tamil Nadu';

  const customerAddress = item.customer_address || item.customerAddress || item.address || '';

  // Booking Type & Service / Room Specifications
  const rawType = item.type || item.bookingType || item.category || 'Stay';
  const isStay = rawType.toLowerCase() === 'stay' || (item.product_details && /hotel|room|deluxe|resort/i.test(item.product_details));
  const isTravel = rawType.toLowerCase() === 'travel' || (item.product_details && /travel|cab|tour/i.test(item.product_details));
  const bookingType = isStay ? 'Stay' : (isTravel ? 'Travel' : 'Services');
  const hotelName = vendorBusinessName;

  // Room / Service Details
  const roomName = item.product_details || (item.items && item.items[0]?.name) || item.service || (isStay ? 'Deluxe Room' : 'Service Appointment');
  const roomNumber = item.roomNumber || item.roomNo || 'Not assigned';

  // Room Count
  let numberOfRooms = 1;
  if (Array.isArray(item.items) && item.items.length > 0) {
    numberOfRooms = item.items.reduce((acc, i) => acc + Number(i.quantity || i.qty || 1), 0);
  } else if (item.numberOfRooms || item.rooms) {
    numberOfRooms = Number(item.numberOfRooms || item.rooms || 1);
  }

  // Real Guest Calculation (Do NOT default to "1 Person" when booking contains multiple guests)
  const guests = Array.isArray(item.guests) ? item.guests : [];
  let numberOfGuests = 0;
  if (guests.length > 0) {
    numberOfGuests = guests.length;
  } else if (item.numberOfGuests || item.guestsCount || item.guestCount) {
    numberOfGuests = Number(item.numberOfGuests || item.guestsCount || item.guestCount);
  } else if (item.adults !== undefined || item.children !== undefined) {
    numberOfGuests = Number(item.adults || 0) + Number(item.children || 0);
  } else {
    // Proportional to rooms booked (standard 2 guests per room)
    numberOfGuests = Math.max(1, numberOfRooms * 2);
  }

  const adults = item.adults !== undefined ? Number(item.adults) : (guests.length > 0 ? guests.filter(g => (g.age || 18) >= 12).length : Math.max(1, numberOfGuests));
  const children = item.children !== undefined ? Number(item.children) : (guests.length > 0 ? guests.filter(g => (g.age || 18) < 12).length : 0);

  // Dates
  const createdDateStr = item.created_at || item.createdAt || item.bookingDate || item.date;
  const checkInDate = item.checkInDate || item.appointmentDate || (createdDateStr ? formatBookingDate(createdDateStr).split(',')[0] : 'Not provided');
  const checkInTime = item.checkInTime || item.appointmentTimeSlot || '12:00 PM';
  const checkOutDate = item.checkOutDate || 'Next Day';
  const checkOutTime = item.checkOutTime || '11:00 AM';

  // Financials
  const charge = Number(item.amount || item.totalAmount || item.finalAmount || item.charge || 0);
  const totalAmount = charge;

  // Real Status Timeline from delivery_status_history
  const rawHist = (historyMap && (historyMap.get(bId) || historyMap.get(bookingNumber) || historyMap.get(String(item._id)))) || [];
  const sortedHist = [...rawHist].sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

  const timeline = sortedHist.map(h => ({
    status: h.status,
    time: formatBookingDate(h.timestamp),
    timestamp: h.timestamp,
    desc: h.notes || `Booking ${h.status}`,
    updatedBy: h.updated_by || 'System'
  }));

  if (!timeline.some(t => (t.status || '').toLowerCase().includes('placed') || (t.status || '').toLowerCase().includes('create') || (t.status || '').toLowerCase().includes('receive'))) {
    timeline.unshift({
      status: isStay ? 'Booking Requested' : 'Booking Created',
      time: formatBookingDate(createdDateStr),
      timestamp: createdDateStr,
      desc: isStay ? 'Customer requested hotel/room stay' : 'Customer placed appointment request',
      updatedBy: 'Customer'
    });
  }

  return {
    ...item,
    id: bId,
    _id: bId,
    bookingId: bId,
    bookingNumber,
    customerName: item.customer_name || item.customerName || item.memberName || 'Customer',
    customerId: item.customerId || item.customerDisplayId || item.memberId || 'Not provided',
    customerPhone: item.customer_phone || item.customerPhone || item.phone || 'Not provided',
    customerEmail: item.customerEmail || item.email || item.candidateEmail || 'Not provided',
    customerAddress: customerAddress || 'Not provided',
    state,
    district,
    division,
    pincode,
    stateId: item.stateId || vendorStateId || null,
    districtId: item.districtId || vendorDistrictId || null,
    divisionId: item.divisionId || vendorDivisionId || null,
    pincodeId: item.pincodeId || vendorPincodeId || null,
    // Vendor location fields (used for territory-based filtering)
    vendorState,
    vendorDistrict,
    vendorDivision,
    vendorPincode,
    vendorStateId,
    vendorDistrictId,
    vendorDivisionId,
    vendorPincodeId,
    vendorLocation,
    vendorPhone,
    vendorEmail,
    bookingType,
    type: bookingType,
    service: roomName,
    roomName,
    roomNumber,
    hotelName,
    propertyName: hotelName,
    vendorName,
    businessName: hotelName,
    vendorId,
    numberOfRooms,
    numberOfGuests,
    adults,
    children,
    guests,
    checkInDate,
    checkInTime,
    checkOutDate,
    checkOutTime,
    bookingDate: formatBookingDate(createdDateStr),
    scheduledDate: item.appointmentDate ? `${item.appointmentDate} ${item.appointmentTimeSlot || ''}`.trim() : formatBookingDate(createdDateStr),
    createdAtRaw: createdDateStr || item.appointmentDate || item.created_at || item.createdAt || item.date || item.orderDate || '',
    charge,
    totalAmount,
    finalAmount: totalAmount,
    paymentMode: item.payment_method || item.paymentMethod || 'Online',
    paymentStatus: item.payment_status || item.paymentStatus || 'Paid',
    status: item.status || 'Confirmed',
    membershipTier: item.membershipTier || item.tier || 'standard',
    timeline
  };
}

const { getComprehensiveVendorDirectory } = require('../utils/vendorDirectory');

function getBookings(req, res) {
  try {
    const vendorDir = getComprehensiveVendorDirectory();
    const pinMap = getPincodeDirectory();

    // Fast status history lookup map
    const historyMap = new Map();
    Array.from(db.deliveryStatusHistory || []).forEach(h => {
      const oId = String(h.order_id || h.order_number || '');
      if (oId) {
        if (!historyMap.has(oId)) historyMap.set(oId, []);
        historyMap.get(oId).push(h);
      }
    });

    // 1. Gather all legitimate booking records from db.bookings and db.orders
    // Strictly restrict to SERVICE, STAY, TRAVEL (never product orders)
    // 1. Territory Data Validation & Authentication Check (Part 16)
    const territory = resolveAdminTerritory(req.user);
    if (!territory.isValid) {
      return res.json({
        success: true,
        count: 0,
        total: 0,
        bookings: [],
        data: [],
        message: territory.message
      });
    }

    // 2. Gather all legitimate booking records from db.bookings and db.orders
    // Strictly restrict to SERVICES, STAY, TRAVEL (never Products, Food, Daily Needs, Job - Part 7)
    const rawBookings = Array.from(db.bookings || []).filter(b => {
      const t = String(b.type || b.category || b.bookingType || '').toLowerCase();
      const isProductOrFoodOrJob = t.includes('product') || t.includes('food') || t.includes('daily needs') || t.includes('job');
      return !isProductOrFoodOrJob;
    });

    const orderBookings = Array.from(db.orders || []).filter(o => {
      const t = String(o.type || o.category || '').toLowerCase();
      const isBookingType = t === 'stay' || t === 'services' || t === 'service' || t === 'travel';
      const isBookingId = String(o.id || o.order_number || o._id || '').toUpperCase().startsWith('BKG');
      const isProductOrFoodOrJob = t.includes('product') || t.includes('food') || t.includes('daily needs') || t.includes('job');
      return (isBookingType || isBookingId) && !isProductOrFoodOrJob;
    });

    const combined = [...rawBookings];
    const existingIds = new Set(rawBookings.map(b => String(b.id || b._id || b.bookingNumber || b.order_number)));
    orderBookings.forEach(o => {
      const oId = String(o.id || o._id || o.order_number);
      if (!existingIds.has(oId)) {
        combined.push(o);
        existingIds.add(oId);
      }
    });

    // 3. Normalize and enrich all bookings with full vendor & territory data
    const normalizedBookings = combined.map(b => {
      const vendorKey = String(b.vendor_id || b.vendorId || '').trim();
      const matchedVendor = vendorDir.findVendor(vendorKey);
      return normalizeBooking(b, pinMap, vendorDir.vendorMap, historyMap, matchedVendor);
    }).filter(Boolean);

    // 4. Strictly enforce territory-based access control based on user jurisdiction (Part 9, 10)
    let scoped = normalizedBookings.filter(b => isEntityInAdminTerritory(b, territory));

    const { search, status, type } = req.query;
    let filtered = scoped;

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(b =>
        (b.bookingNumber && b.bookingNumber.toLowerCase().includes(q)) ||
        (b.customerName && b.customerName.toLowerCase().includes(q)) ||
        (b.vendorName && b.vendorName.toLowerCase().includes(q)) ||
        (b.service && b.service.toLowerCase().includes(q)) ||
        (b.pincode && b.pincode.includes(q)) ||
        (b.district && b.district.toLowerCase().includes(q)) ||
        (b.division && b.division.toLowerCase().includes(q))
      );
    }

    if (status && status !== 'all') {
      filtered = filtered.filter(b => (b.status || '').toLowerCase() === status.toLowerCase());
    }

    if (type && type !== 'all') {
      filtered = filtered.filter(b => (b.bookingType || b.type || '').toLowerCase() === type.toLowerCase());
    }

    // 5. Stable newest-first sorting by creation/booking date with secondary sort on identifier
    filtered.sort((a, b) => {
      const getTimestamp = (item) => {
        const raw = item.createdAtRaw || item.createdAt || item.created_at || item.appointmentDate || item.date || item.bookingDate || 0;
        const t = new Date(raw).getTime();
        return isNaN(t) ? 0 : t;
      };
      const diff = getTimestamp(b) - getTimestamp(a);
      if (diff !== 0) return diff;
      return String(b.bookingNumber || b.id || '').localeCompare(String(a.bookingNumber || a.id || ''));
    });

    const pageNum = parseInt(req.query.page, 10);
    const limitNum = parseInt(req.query.limit, 10);
    let pagedBookings = filtered;
    let pagination = null;

    if (!isNaN(pageNum) && !isNaN(limitNum) && limitNum > 0) {
      const startIndex = (pageNum - 1) * limitNum;
      pagedBookings = filtered.slice(startIndex, startIndex + limitNum);
      pagination = {
        page: pageNum,
        limit: limitNum,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / limitNum) || 1
      };
    }

    return res.json({
      success: true,
      count: pagedBookings.length,
      total: filtered.length,
      bookings: pagedBookings,
      data: pagedBookings,
      pagination: pagination || {
        page: 1,
        limit: filtered.length,
        total: filtered.length,
        totalPages: 1
      }
    });
  } catch (error) {
    console.error('[getBookings] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch bookings', error: error.message });
  }
}

async function updateBookingStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, technicianAssigned, roomNumber } = req.body;

    let targetCollection = db.bookings;
    let booking = await db.bookings.findById(id);
    if (!booking) {
      booking = await db.orders.findById(id);
      targetCollection = db.orders;
    }

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const scoped = filterByLocation([booking], req.user);
    if (scoped.length === 0) {
      return res.status(403).json({ success: false, message: 'Booking outside your jurisdiction' });
    }

    const updates = { updatedAt: new Date().toISOString() };
    if (status) updates.status = status;
    if (technicianAssigned) updates.technicianAssigned = technicianAssigned;
    if (roomNumber) updates.roomNumber = roomNumber;

    const updatedBooking = await targetCollection.findByIdAndUpdate(booking._id || booking.id, updates);

    return res.json({ success: true, message: 'Booking updated successfully', booking: updatedBooking || { ...booking, ...updates } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update booking', error: error.message });
  }
}

module.exports = {
  getBookings,
  updateBookingStatus
};
