const { db, filterByLocation } = require('../config/db');

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
  const matchedVendor = matchedVendorArg || (vendorKey ? (vendorMap instanceof Map ? vendorMap.get(vendorKey) : null) : null);

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

  // Geographic coordinates
  const customerAddress = item.customer_address || item.customerAddress || item.address || '';
  let pincode = String(item.pincode || item.deliveryPincode || vendorPincode || '').trim();
  if (!pincode && customerAddress) {
    const pinMatch = customerAddress.match(/\b\d{6}\b/);
    if (pinMatch) pincode = pinMatch[0];
  }

  const pinGeo = pinMap.get(pincode) || {};
  let state = item.state || item.stateName || pinGeo.state || vendorState || '';
  let district = item.district || item.districtName || pinGeo.district || vendorDistrict || '';
  let division = item.division || item.divisionName || pinGeo.division || vendorDivision || '';

  if (!district && customerAddress) {
    const addrUpper = customerAddress.toUpperCase();
    if (addrUpper.includes('SALEM')) district = 'Salem';
    else if (addrUpper.includes('DINDIGUL')) district = 'Dindigul';
    else if (addrUpper.includes('ERODE')) district = 'Erode';
    else if (addrUpper.includes('KRISHNAGIRI')) district = 'Krishnagiri';
    else if (addrUpper.includes('DHARMAPURI')) district = 'Dharmapuri';
    else if (addrUpper.includes('NAMAKKAL')) district = 'Namakkal';
    else if (addrUpper.includes('TIRUPPUR') || addrUpper.includes('TIRUPUR')) district = 'Tiruppur';
    else if (addrUpper.includes('COIMBATORE')) district = 'Coimbatore';
    else if (addrUpper.includes('BANGALORE') || addrUpper.includes('BENGALURU')) district = 'Bengaluru Urban';
  }

  if (!division && customerAddress) {
    const addrUpper = customerAddress.toUpperCase();
    if (addrUpper.includes('THALAIVASAL')) division = 'Thalaivasal';
    else if (addrUpper.includes('ATTUR')) division = 'Attur';
    else if (addrUpper.includes('SALEM NORTH')) division = 'Salem North';
    else if (addrUpper.includes('BOMMANAHALLI')) division = 'Bengaluru South';
    else if (addrUpper.includes('HOSUR')) division = 'Hosur';
  }

  if (!state) {
    if (customerAddress.toLowerCase().includes('karnataka') && !district.includes('salem') && !district.includes('dindigul')) {
      state = 'Karnataka';
    } else {
      state = vendorState || 'Tamil Nadu';
    }
  }

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
    // Vendor location fields (used for territory-based filtering fallback)
    vendorState,
    vendorDistrict,
    vendorDivision,
    vendorPincode,
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
    const rawBookings = Array.from(db.bookings || []);
    const orderBookings = Array.from(db.orders || []).filter(o => {
      const t = String(o.type || o.category || '').toLowerCase();
      const isBookingType = t === 'stay' || t === 'services' || t === 'service' || t === 'travel';
      const isBookingId = String(o.id || o.order_number || '').toUpperCase().startsWith('BKG');
      const isProductOrFood = t === 'products' || t === 'food' || t === 'daily needs' || t === 'job';
      return (isBookingType || isBookingId) && !isProductOrFood;
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

    // 2. Normalize and enrich all bookings with full vendor & territory data FIRST
    const normalizedBookings = combined.map(b => {
      const vendorKey = String(b.vendor_id || b.vendorId || '').trim();
      const matchedVendor = vendorDir.findVendor(vendorKey);
      return normalizeBooking(b, pinMap, vendorDir.vendorMap, historyMap, matchedVendor);
    }).filter(Boolean);

    // 3. Strictly enforce territory-based access control based on user jurisdiction
    let scoped = filterByLocation(normalizedBookings, req.user);

    // Also support vendor territory match for State / District / Division admins
    if (req.user && req.user.role) {
      const uRole = String(req.user.role).toLowerCase();
      const uState = (req.user.state || '').trim().toLowerCase();
      const uDist = (req.user.district || '').trim().toLowerCase();
      const uDiv = (req.user.division || '').trim().toLowerCase().replace(/\s+division$/i, '');
      const uPin = (req.user.pincode || '').trim();

      if (!uRole.includes('super admin') && !uRole.includes('admin') && uState && uState !== 'all india') {
        scoped = normalizedBookings.filter(b => {
          // Record belongs to user territory if either service/customer location OR vendor location matches
          const bState = String(b.state || '').trim().toLowerCase();
          const vState = String(b.vendorState || '').trim().toLowerCase();
          const stateMatch = bState === uState || vState === uState;

          if (uRole.includes('state')) return stateMatch;

          const bDist = String(b.district || '').trim().toLowerCase();
          const vDist = String(b.vendorDistrict || '').trim().toLowerCase();
          const distMatch = stateMatch && (bDist === uDist || vDist === uDist);

          if (uRole.includes('district')) return distMatch;

          const bDiv = String(b.division || '').trim().toLowerCase().replace(/\s+division$/i, '');
          const vDiv = String(b.vendorDivision || '').trim().toLowerCase().replace(/\s+division$/i, '');
          const divMatch = distMatch && (bDiv === uDiv || vDiv === uDiv);

          if (uRole.includes('division') || uRole.includes('divisional')) return divMatch;

          const bPin = String(b.pincode || '').trim();
          const vPin = String(b.vendorPincode || '').trim();
          return divMatch && (bPin === uPin || vPin === uPin);
        });
      }
    }

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
        (b.district && b.district.toLowerCase().includes(q))
      );
    }

    if (status && status !== 'all') {
      filtered = filtered.filter(b => (b.status || '').toLowerCase() === status.toLowerCase());
    }

    if (type && type !== 'all') {
      filtered = filtered.filter(b => (b.bookingType || b.type || '').toLowerCase() === type.toLowerCase());
    }

    return res.json({
      success: true,
      count: filtered.length,
      total: filtered.length,
      bookings: filtered,
      data: filtered
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
