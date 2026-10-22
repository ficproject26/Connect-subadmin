const { db, filterByLocation, resolveStateFromDistrict, DISTRICT_STATE_MAP } = require('../config/db');

const PIN_MAP = {
  '641666': { state: 'Tamil Nadu', district: 'Tirupur', division: 'Palladam' },
  '635305': { state: 'Tamil Nadu', district: 'Dharmapuri', division: 'Harur Division' },
  '636901': { state: 'Tamil Nadu', district: 'Dharmapuri', division: 'Harur Division' },
  '635002': { state: 'Tamil Nadu', district: 'Krishnagiri', division: 'Krishnagiri Division' },
  '635001': { state: 'Tamil Nadu', district: 'Krishnagiri', division: 'Krishnagiri Division' },
  '635109': { state: 'Tamil Nadu', district: 'Krishnagiri', division: 'Hosur Division' },
  '635110': { state: 'Tamil Nadu', district: 'Krishnagiri', division: 'Hosur Division' },
  '636112': { state: 'Tamil Nadu', district: 'Salem', division: 'Thalaivasal' },
  '636114': { state: 'Tamil Nadu', district: 'Salem', division: 'Attur Division' },
  '636001': { state: 'Tamil Nadu', district: 'Salem', division: 'Salem North' },
  '636002': { state: 'Tamil Nadu', district: 'Salem', division: 'Salem North' },
  '638001': { state: 'Tamil Nadu', district: 'Erode', division: 'Erode Division' },
  '638103': { state: 'Tamil Nadu', district: 'Tirupur', division: 'Avinasi' },
  '560068': { state: 'Karnataka', district: 'Bangalore', division: 'Bengaluru South' },
  '560072': { state: 'Karnataka', district: 'Bangalore', division: 'Bengaluru South' },
  '560087': { state: 'Karnataka', district: 'Bangalore', division: 'Bengaluru South' },
  '560034': { state: 'Karnataka', district: 'Bangalore', division: 'Bengaluru South' },
  '680001': { state: 'Kerala', district: 'Thrissur', division: 'Thrissur Division' },
  '680004': { state: 'Kerala', district: 'Thrissur', division: 'Thrissur West' },
  '680618': { state: 'Kerala', district: 'Thrissur', division: 'Thrissur South' },
  '520001': { state: 'Andhra Pradesh', district: 'NTR District', division: 'Vijayawada Central' }
};

function resolvePinGeo(rawPin) {
  const pin = String(rawPin || '').trim();
  if (pin && db.pincodes) {
    const found = (db.pincodeMap && db.pincodeMap.get(pin)) || Array.from(db.pincodes).find(p => String(p.code || p.pincode) === pin);
    if (found) {
      let state = found.state || found.stateName || '';
      let district = found.district || found.districtName || '';
      if (!state && district) {
        state = resolveStateFromDistrict(district) || '';
      }
      return {
        state: state ? state.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : (PIN_MAP[pin]?.state || ''),
        district: district || PIN_MAP[pin]?.district || '',
        division: found.division || found.divisionName || PIN_MAP[pin]?.division || '',
        pincode: pin
      };
    }
  }
  return PIN_MAP[pin] || {};
}

/**
 * Build fast O(1) hash maps for cardholders to avoid O(N*M) linear scans
 */
function buildCardholderIndices(allCardholders) {
  const phoneMap = new Map();
  const emailMap = new Map();
  const idMap = new Map();

  if (allCardholders && allCardholders.length > 0) {
    for (const ch of allCardholders) {
      if (!ch.cardNumber) continue;
      if (ch.phone) phoneMap.set(String(ch.phone).trim(), ch);
      if (ch.email) emailMap.set(String(ch.email).trim().toLowerCase(), ch);
      if (ch.customerId) idMap.set(String(ch.customerId).trim(), ch);
    }
  }
  return { phoneMap, emailMap, idMap };
}

/**
 * Find customer's active membership card from pre-indexed cardholders
 */
function findCustomerCard(customer, indicesOrArray) {
  if (!customer) return null;
  // If passed indices object
  if (indicesOrArray && indicesOrArray.phoneMap) {
    const cPhone = String(customer.phone || '').trim();
    if (cPhone && indicesOrArray.phoneMap.has(cPhone)) return indicesOrArray.phoneMap.get(cPhone);

    const cEmail = String(customer.email || '').trim().toLowerCase();
    if (cEmail && indicesOrArray.emailMap.has(cEmail)) return indicesOrArray.emailMap.get(cEmail);

    const cId = String(customer.id || customer._id || customer.customerId || '').trim();
    if (cId && indicesOrArray.idMap.has(cId)) return indicesOrArray.idMap.get(cId);

    return null;
  }

  // Fallback if raw array passed
  const allCardholders = indicesOrArray;
  if (!allCardholders || allCardholders.length === 0) return null;
  const cPhone = String(customer.phone || '').trim();
  const cEmail = String(customer.email || '').trim().toLowerCase();
  const cId = String(customer.id || customer._id || customer.customerId || '').trim();

  return allCardholders.find(ch => {
    if (!ch.cardNumber) return false;
    if (cPhone && ch.phone && String(ch.phone).trim() === cPhone) return true;
    if (cEmail && ch.email && String(ch.email).trim().toLowerCase() === cEmail) return true;
    if (cId && ch.customerId && String(ch.customerId).trim() === cId) return true;
    return false;
  }) || null;
}

/**
 * Enrich customer record with resolved geographical coordinates and membership
 */
function enrichCustomer(c, indicesOrArray) {
  const addr0 = (c.addresses && c.addresses[0]) || {};
  const rawPin = String(c.pincode || addr0.pincode || '').trim();
  const geo = resolvePinGeo(rawPin);

  let district = c.district || geo.district || addr0.city || c.city || '';
  let division = c.division || geo.division || '';
  let street = addr0.address || c.address || '';
  let locality = addr0.locality || '';
  let city = addr0.city || c.city || district || '';

  let state = geo.state || '';
  if (!state && district) {
    const derived = resolveStateFromDistrict(district);
    if (derived) {
      state = derived.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  if (!state) {
    state = c.state || addr0.state || '';
  }

  if (!state && street) {
    if (/tamil\s*nadu/i.test(street)) state = 'Tamil Nadu';
    else if (/karnataka/i.test(street)) state = 'Karnataka';
    else if (/kerala/i.test(street)) state = 'Kerala';
    else if (/andhra\s*pradesh/i.test(street)) state = 'Andhra Pradesh';
  }

  // Find membership card from indices or array
  const card = findCustomerCard(c, indicesOrArray);
  let membership = c.membership || null;
  if (card) {
    const rawTier = card.cardType || card.tier || 'Silver';
    const tier = rawTier === 'Platinum' ? 'Diamond' : rawTier;
    const isExpired = card.expiryDate && new Date(card.expiryDate) < new Date();
    const isActive = (card.status || '').toLowerCase() === 'active' && !isExpired;

    const discountMap = { Silver: 5, Gold: 12, Diamond: 20 };
    const pointsMap = { Silver: 500, Gold: 1200, Diamond: 2500 };

    membership = {
      tier,
      cardNumber: card.cardNumber,
      status: isActive ? 'Active' : (isExpired ? 'Expired' : (card.status || 'Expired')),
      validUntil: card.expiryDate || new Date(Date.now() + 365 * 86400000).toISOString(),
      issueDate: card.createdAt || new Date().toISOString(),
      discountPercent: card.discountPercent || discountMap[tier] || 10,
      points: card.points || card.rewardPoints || pointsMap[tier] || 1000
    };
  } else if (membership && membership.tier) {
    const isExpired = membership.validUntil && new Date(membership.validUntil) < new Date();
    const isActive = (membership.status || '').toLowerCase() === 'active' && !isExpired;
    membership = {
      ...membership,
      tier: membership.tier === 'Platinum' ? 'Diamond' : membership.tier,
      status: isActive ? 'Active' : (isExpired ? 'Expired' : (membership.status || 'Expired'))
    };
  }

  // Build clean registered address string without '/' or null
  const addressParts = [street, locality, city, district, state, rawPin].filter(Boolean);
  const cleanFullAddress = addressParts.filter((val, idx) => addressParts.indexOf(val) === idx).join(', ');

  return {
    ...c,
    state,
    district,
    division,
    pincode: rawPin,
    street,
    locality,
    city,
    fullAddress: cleanFullAddress,
    membership
  };
}

// Helper to calculate customer transaction metrics across orders and bookings
function calculateCustomerTransactionMetrics(customers, allOrders, allBookings) {
  const combinedTx = [...allOrders];
  const seenIds = new Set(allOrders.map(o => String(o._id || o.id || o.order_number || o.bookingNumber || '')));
  allBookings.forEach(b => {
    const bId = String(b._id || b.id || b.order_number || b.bookingNumber || '');
    if (bId && !seenIds.has(bId)) {
      combinedTx.push(b);
      seenIds.add(bId);
    }
  });

  const isBooking = (o) => {
    const cat = String(o.category || o.type || o.bookingType || '').toLowerCase().trim();
    const id = String(o.id || o.order_number || o._id || o.bookingNumber || '').toUpperCase();
    return cat === 'stay' || cat === 'service' || cat === 'services' || cat === 'travel' || id.startsWith('BKG');
  };

  const isEligiblePaid = (o) => {
    const p = String(o.paymentStatus || o.payment_status || o.payment || '').toLowerCase().trim();
    const s = String(o.status || '').toLowerCase().trim();
    if (p === 'failed' || p === 'refunded' || p === 'cancelled' || p === 'unpaid') return false;
    if (s === 'cancelled' || s === 'failed' || s === 'refunded') return false;
    return p === 'paid' || p === 'completed' || p === 'success' || p === 'successful' || s === 'delivered' || s === 'completed';
  };

  const byCustId = new Map();
  const byPhone = new Map();
  const byEmail = new Map();
  const byName = new Map();

  const addMap = (map, key, val) => {
    if (!key) return;
    const k = String(key).trim().toLowerCase();
    if (!k || k === 'not provided' || k === 'customer' || k === 'null' || k === 'undefined') return;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(val);
  };

  combinedTx.forEach(t => {
    [t.customerId, t.customer_id, t.memberId].forEach(id => addMap(byCustId, id, t));
    [t.customerPhone, t.phone].forEach(p => addMap(byPhone, p, t));
    [t.customerEmail, t.email].forEach(e => addMap(byEmail, e, t));
    [t.customerName, t.customer_name].forEach(n => addMap(byName, n, t));
  });

  return customers.map(c => {
    const cIds = [c._id, c.id, c.customerId].filter(Boolean).map(x => String(x).trim().toLowerCase());
    const cPhone = String(c.phone || '').trim().toLowerCase();
    const cEmail = String(c.email || '').trim().toLowerCase();
    const cName = String(c.name || '').trim().toLowerCase();

    const matchedSet = new Set();
    const addMatches = (list) => {
      if (list && Array.isArray(list)) list.forEach(item => matchedSet.add(item));
    };

    cIds.forEach(id => addMatches(byCustId.get(id)));
    if (cPhone) addMatches(byPhone.get(cPhone));
    if (cEmail) addMatches(byEmail.get(cEmail));
    if (matchedSet.size === 0 && cName) {
      addMatches(byName.get(cName));
    }

    const matchedList = Array.from(matchedSet);
    const orders = matchedList.filter(m => !isBooking(m));
    const bookings = matchedList.filter(m => isBooking(m));
    const paidList = matchedList.filter(isEligiblePaid);
    const totalSpent = paidList.reduce((sum, m) => sum + Number(m.amount || m.totalAmount || m.finalAmount || 0), 0);

    return {
      ...c,
      totalOrders: orders.length,
      ordersCount: orders.length,
      totalBookings: bookings.length,
      bookingsCount: bookings.length,
      totalSpent: Math.round(totalSpent),
      totalSpend: Math.round(totalSpent),
      formattedSpend: `₹${Math.round(totalSpent).toLocaleString('en-IN')}`
    };
  });
}

async function getCustomers(req, res) {
  try {
    const allCardholders = Array.from(db.cardholders || []);
    const rawCustomers = Array.from(db.customers || []);
    const allOrders = Array.from(db.orders || []);
    const allBookings = Array.from(db.bookings || []);

    // Build O(1) indices for fast cardholder lookups
    const cardholderIndices = buildCardholderIndices(allCardholders);

    // Enrich all customers with verified coordinates, membership tier & order/spend metrics
    const enriched = rawCustomers.map(c => enrichCustomer(c, cardholderIndices));
    const withMetrics = calculateCustomerTransactionMetrics(enriched, allOrders, allBookings);

    // Apply strict location filtering
    let scoped = filterByLocation(withMetrics, req.user);

    // Apply query filters
    const { search, tier, status, state, district, division, pincode, page, limit } = req.query;

    // Apply territory filters
    if (state && state.trim() && state !== 'All') {
      scoped = scoped.filter(c => (c.state || '').toLowerCase() === state.trim().toLowerCase());
    }
    if (district && district.trim() && district !== 'All') {
      scoped = scoped.filter(c => (c.district || '').toLowerCase() === district.trim().toLowerCase());
    }
    if (division && division.trim() && division !== 'All') {
      scoped = scoped.filter(c => 
        (c.division || '').toLowerCase().includes(division.trim().toLowerCase()) ||
        division.trim().toLowerCase().includes((c.division || '').toLowerCase())
      );
    }
    if (pincode && pincode.trim() && pincode !== 'All') {
      scoped = scoped.filter(c => String(c.pincode || '').trim() === pincode.trim());
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      scoped = scoped.filter(c => 
        (c.name && c.name.toLowerCase().includes(q)) || 
        (c.email && c.email.toLowerCase().includes(q)) || 
        (c.phone && c.phone.includes(q)) ||
        (c.pincode && c.pincode.includes(q)) ||
        (c.district && c.district.toLowerCase().includes(q)) ||
        (c.division && c.division.toLowerCase().includes(q)) ||
        (c.fullAddress && c.fullAddress.toLowerCase().includes(q)) ||
        (c.membership && c.membership.cardNumber && c.membership.cardNumber.toLowerCase().includes(q))
      );
    }
    if (tier && tier.trim()) {
      const tLow = tier.trim().toLowerCase();
      if (['customer', 'customers', 'none', 'no card', 'no_card', 'nocard', 'without card'].includes(tLow)) {
        // Show ONLY customers who do NOT have a valid ACTIVE membership card
        scoped = scoped.filter(c => !c.membership || c.membership.status !== 'Active' || !c.membership.tier);
      } else if (tLow === 'diamond' || tLow === 'platinum') {
        scoped = scoped.filter(c => c.membership && c.membership.status === 'Active' && 
          (c.membership.tier?.toLowerCase() === 'diamond' || c.membership.tier?.toLowerCase() === 'platinum')
        );
      } else {
        scoped = scoped.filter(c => c.membership && c.membership.status === 'Active' && 
          c.membership.tier?.toLowerCase() === tLow
        );
      }
    }
    if (status) {
      scoped = scoped.filter(c => (c.status || 'Active').toLowerCase() === status.toLowerCase());
    }

    // Sort customer registrations by creation/registration timestamp in descending order (newest first).
    // Stable secondary sort by ID when timestamps are equal.
    scoped.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.registrationDate || a.date || 0).getTime();
      const timeB = new Date(b.createdAt || b.registrationDate || b.date || 0).getTime();
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      const idA = String(a._id || a.id || '');
      const idB = String(b._id || b.id || '');
      return idB.localeCompare(idA);
    });

    const total = scoped.length;
    let pagedCustomers = scoped;
    let currentPage = 1;
    let pageSize = total;

    if (page || limit) {
      currentPage = parseInt(page, 10) || 1;
      pageSize = parseInt(limit, 10) || 20;
      const startIndex = (currentPage - 1) * pageSize;
      pagedCustomers = scoped.slice(startIndex, startIndex + pageSize);
    }

    const totalPages = Math.ceil(total / (pageSize || 1)) || 1;

    return res.json({
      success: true,
      count: pagedCustomers.length,
      total,
      customers: pagedCustomers,
      data: pagedCustomers,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total,
        totalPages
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch customers', error: error.message });
  }
}

async function getMembershipCards(req, res) {
  try {
    const rawCardholders = Array.from(db.cardholders || []);
    const rawCustomers = Array.from(db.customers || []);

    // Build O(1) Customer lookup maps
    const custPhoneMap = new Map();
    const custEmailMap = new Map();
    const custNameMap = new Map();
    for (const c of rawCustomers) {
      if (c.phone) custPhoneMap.set(String(c.phone).trim(), c);
      if (c.email) custEmailMap.set(String(c.email).trim().toLowerCase(), c);
      if (c.name && c.name !== 'Customer Member') custNameMap.set(String(c.name).trim().toLowerCase(), c);
    }

    // Build O(1) Cardholder matching sets
    const cardholderPhones = new Set();
    const cardholderEmails = new Set();
    const cardholderNames = new Set();

    const allCards = rawCardholders
      .filter(ch => ch.cardNumber && ch.cardNumber.startsWith('FIC-'))
      .map(ch => {
        const chPhone = ch.phone ? String(ch.phone).trim() : '';
        const chEmail = ch.email ? String(ch.email).trim().toLowerCase() : '';
        const chName = ch.name ? String(ch.name).trim().toLowerCase() : '';

        if (chPhone) cardholderPhones.add(chPhone);
        if (chEmail) cardholderEmails.add(chEmail);
        if (chName && chName !== 'customer member') cardholderNames.add(chName);

        const cust = (chPhone && custPhoneMap.get(chPhone)) ||
                     (chEmail && custEmailMap.get(chEmail)) ||
                     (chName && custNameMap.get(chName)) || null;

        const rawPin = String(ch.pincode || (cust && cust.pincode) || '').trim();
        const geo = resolvePinGeo(rawPin);

        let district = ch.district || (cust && (cust.district || cust.city)) || geo.district || '';
        let division = ch.division || (cust && cust.division) || geo.division || '';
        let pincode = rawPin || (cust && cust.pincode) || '';
        let state = geo.state || '';

        if (!state && district) {
          const derived = resolveStateFromDistrict(district);
          if (derived) {
            state = derived.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          }
        }
        if (!state) {
          state = ch.state || (cust && cust.state) || '';
        }

        const rawTier = ch.cardType || ch.tier || 'Silver';
        const tier = rawTier === 'Platinum' ? 'Diamond' : rawTier;
        // Default tier maps — used ONLY when actual DB fields are absent
        const discountMap = { Silver: 5, Gold: 12, Diamond: 20 };
        const pointsMap = { Silver: 500, Gold: 1200, Diamond: 2500 };
        const amountMap = { Silver: 8000, Gold: 15000, Diamond: 35000 };

        return {
          id: ch._id || ch.id,
          _id: ch._id || ch.id,
          customerId: cust ? (cust.customerId || cust.id || cust._id) : (ch.customerId || '-'),
          customerName: cust ? (cust.name || cust.fullName) : ch.name,
          customerMobile: cust ? (cust.phone || cust.mobile) : (ch.phone || ch.mobile),
          mobile: cust ? (cust.phone || cust.mobile) : (ch.phone || ch.mobile),
          customerEmail: cust ? cust.email : ch.email,
          cardNumber: ch.cardNumber,
          tier,
          cardType: tier,
          amount: ch.amount || ch.cardAmount || amountMap[tier] || 15000,
          paymentAmount: ch.paymentAmount || ch.amount || amountMap[tier] || 15000,
          paymentStatus: ch.paymentStatus || 'PAID',
          paymentDate: ch.paymentDate || ch.createdAt,
          issueDate: ch.createdAt || ch.validFrom || ch.issueDate || null,
          expiryDate: ch.expiryDate || ch.validUntil || ch.expiry || null,
          expiry: ch.expiryDate || ch.validUntil || ch.expiry || null,
          validFrom: ch.validFrom || ch.createdAt,
          validUntil: ch.expiryDate || ch.validUntil,
          status: (ch.status === 'active' ? 'Active' : (ch.status === 'expired' ? 'Expired' : (ch.status || 'Active'))),
          discountPercent: ch.discountPercent || discountMap[tier] || 10,
          points: ch.points || ch.rewardPoints || pointsMap[tier] || 1000,
          purchaseType: ch.purchaseType || ch.transactionType || ch.action || 'New Purchase',
          previousTier: ch.previousTier || ch.fromTier || ch.upgradedFrom || null,
          hasCard: true,
          state,
          district,
          division,
          pincode
        };
      });

    // Also include real customers without active card
    const customersWithoutCard = rawCustomers
      .filter(cust => {
        const cPhone = cust.phone ? String(cust.phone).trim() : '';
        const cEmail = cust.email ? String(cust.email).trim().toLowerCase() : '';
        const cName = cust.name ? String(cust.name).trim().toLowerCase() : '';
        const hasCard = (cPhone && cardholderPhones.has(cPhone)) ||
                        (cEmail && cardholderEmails.has(cEmail)) ||
                        (cName && cardholderNames.has(cName));
        return !hasCard;
      })
      .map(cust => {
        const rawPin = String(cust.pincode || cust.assignedPincode || '').trim();
        const geo = resolvePinGeo(rawPin);
        let state = cust.state || geo.state || 'Tamil Nadu';
        let district = cust.district || cust.city || geo.district || '';
        let division = cust.division || geo.division || '';
        let pincode = rawPin || '';

        return {
          id: cust._id || cust.id,
          _id: cust._id || cust.id,
          customerId: cust.customerId || cust.id || cust._id || '-',
          customerName: cust.name || cust.fullName || 'Customer',
          customerMobile: cust.phone || cust.mobile || '-',
          mobile: cust.phone || cust.mobile || '-',
          customerEmail: cust.email || '-',
          cardNumber: 'No Card',
          tier: 'No Card',
          cardType: 'No Card',
          hasCard: false,
          amount: 0,
          paymentAmount: 0,
          paymentStatus: '-',
          paymentDate: null,
          issueDate: null,
          expiryDate: null,
          expiry: null,
          validFrom: null,
          validUntil: null,
          status: 'No Active Card',
          discountPercent: 0,
          points: 0,
          purchaseType: 'No Card',
          previousTier: null,
          state,
          district,
          division,
          pincode
        };
      });

    const combinedList = [...allCards, ...customersWithoutCard];

    // Enforce territorial access control
    let scopedCards = filterByLocation(combinedList, req.user);

    // Apply query filters
    const { search, tier, status, state, district, division, pincode } = req.query;

    if (state && state.trim() && state !== 'All') {
      scopedCards = scopedCards.filter(c => (c.state || '').toLowerCase() === state.trim().toLowerCase());
    }
    if (district && district.trim() && district !== 'All') {
      scopedCards = scopedCards.filter(c => (c.district || '').toLowerCase() === district.trim().toLowerCase());
    }
    if (division && division.trim() && division !== 'All') {
      scopedCards = scopedCards.filter(c =>
        (c.division || '').toLowerCase().includes(division.trim().toLowerCase()) ||
        division.trim().toLowerCase().includes((c.division || '').toLowerCase())
      );
    }
    if (pincode && pincode.trim() && pincode !== 'All') {
      scopedCards = scopedCards.filter(c => String(c.pincode || '').trim() === pincode.trim());
    }

    if (tier && tier.trim() && tier !== 'All') {
      scopedCards = scopedCards.filter(c => (c.tier || '').toLowerCase() === tier.trim().toLowerCase());
    }
    if (status && status.trim() && status !== 'All') {
      scopedCards = scopedCards.filter(c => (c.status || '').toLowerCase() === status.trim().toLowerCase());
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      scopedCards = scopedCards.filter(c =>
        (c.customerName && c.customerName.toLowerCase().includes(q)) ||
        (c.customerMobile && c.customerMobile.includes(q)) ||
        (c.customerEmail && c.customerEmail.toLowerCase().includes(q)) ||
        (c.cardNumber && c.cardNumber.toLowerCase().includes(q)) ||
        (c.pincode && c.pincode.includes(q)) ||
        (c.district && c.district.toLowerCase().includes(q)) ||
        (c.division && c.division.toLowerCase().includes(q))
      );
    }

    // Sort newest first, stable secondary sort by ID
    scopedCards.sort((a, b) => {
      const timeA = new Date(a.issueDate || a.createdAt || a.paymentDate || 0).getTime();
      const timeB = new Date(b.issueDate || b.createdAt || b.paymentDate || 0).getTime();
      if (timeB !== timeA) return timeB - timeA;
      const idA = String(a._id || a.id || '');
      const idB = String(b._id || b.id || '');
      return idB.localeCompare(idA);
    });

    // Tier counts strictly for scoped territory
    const activeScopedCards = scopedCards.filter(c => c.tier !== 'No Card');
    const counts = {
      total: activeScopedCards.length,
      silver: scopedCards.filter(c => c.tier === 'Silver').length,
      gold: scopedCards.filter(c => c.tier === 'Gold').length,
      diamond: scopedCards.filter(c => c.tier === 'Diamond').length,
      noCard: scopedCards.filter(c => c.tier === 'No Card').length
    };

    return res.json({ success: true, counts, cards: scopedCards });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch membership cards', error: error.message });
  }
}

async function upgradeMembership(req, res) {
  try {
    const { customerId, tier, pointsBonus } = req.body;
    if (!['Silver', 'Gold', 'Diamond'].includes(tier)) {
      return res.status(400).json({ success: false, message: 'Invalid tier. Must be Silver, Gold, or Diamond.' });
    }

    const customer = await db.customers.findOne({
      $or: [{ _id: customerId }, { id: customerId }]
    });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Verify user has access to customer location
    const accessible = filterByLocation([customer], req.user);
    if (accessible.length === 0) {
      return res.status(403).json({ success: false, message: 'Customer outside your jurisdiction' });
    }

    const discountMap = { Silver: 5, Gold: 12, Diamond: 20 };
    const membership = {
      ...(customer.membership || {}),
      tier,
      discountPercent: discountMap[tier],
      points: (customer.membership?.points || 0) + (pointsBonus ? Number(pointsBonus) : 0),
      updatedAt: new Date().toISOString()
    };

    const updated = await db.customers.findByIdAndUpdate(customer._id || customer.id, {
      membership,
      updatedAt: new Date().toISOString()
    });

    return res.json({
      success: true,
      message: `Customer ${customer.name} upgraded to ${tier} membership.`,
      customer: updated || { ...customer, membership }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to upgrade membership', error: error.message });
  }
}

async function getCustomerHistory(req, res) {
  try {
    const { id } = req.params;
    const rawCustomers = Array.from(db.customers || []);
    const customer = rawCustomers.find(c => String(c._id || c.id || c.customerId).toLowerCase() === String(id).toLowerCase());
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const allCardholders = Array.from(db.cardholders || []);
    const cardIndices = buildCardholderIndices(allCardholders);
    const enrichedCustomer = enrichCustomer(customer, cardIndices);

    const allOrders = Array.from(db.orders || []);
    const allBookings = Array.from(db.bookings || []);

    const combinedTx = [...allOrders];
    const seenIds = new Set(allOrders.map(o => String(o._id || o.id || o.order_number || o.bookingNumber || '')));
    allBookings.forEach(b => {
      const bId = String(b._id || b.id || b.order_number || b.bookingNumber || '');
      if (bId && !seenIds.has(bId)) {
        combinedTx.push(b);
        seenIds.add(bId);
      }
    });

    const isBooking = (o) => {
      const cat = String(o.category || o.type || o.bookingType || '').toLowerCase().trim();
      const oId = String(o.id || o.order_number || o._id || o.bookingNumber || '').toUpperCase();
      return cat === 'stay' || cat === 'service' || cat === 'services' || cat === 'travel' || oId.startsWith('BKG');
    };

    const isEligiblePaid = (o) => {
      const p = String(o.paymentStatus || o.payment_status || o.payment || '').toLowerCase().trim();
      const s = String(o.status || '').toLowerCase().trim();
      if (p === 'failed' || p === 'refunded' || p === 'cancelled' || p === 'unpaid') return false;
      if (s === 'cancelled' || s === 'failed' || s === 'refunded') return false;
      return p === 'paid' || p === 'completed' || p === 'success' || p === 'successful' || s === 'delivered' || s === 'completed';
    };

    const cIds = new Set([
      String(customer._id || '').trim().toLowerCase(),
      String(customer.id || '').trim().toLowerCase(),
      String(customer.customerId || '').trim().toLowerCase()
    ].filter(Boolean));
    const cPhone = String(customer.phone || '').trim().toLowerCase();
    const cEmail = String(customer.email || '').trim().toLowerCase();
    const cName = String(customer.name || '').trim().toLowerCase();

    const matchedTx = combinedTx.filter(t => {
      const tIds = [
        String(t.customerId || '').trim().toLowerCase(),
        String(t.customer_id || '').trim().toLowerCase(),
        String(t.memberId || '').trim().toLowerCase()
      ].filter(Boolean);
      for (const tid of tIds) {
        if (cIds.has(tid)) return true;
      }
      const tPhone = String(t.customerPhone || t.phone || '').trim().toLowerCase();
      if (cPhone && tPhone && cPhone === tPhone) return true;
      const tEmail = String(t.customerEmail || t.email || '').trim().toLowerCase();
      if (cEmail && tEmail && cEmail === tEmail) return true;
      const tName = String(t.customerName || t.customer_name || '').trim().toLowerCase();
      if (cName && tName && cName === tName) return true;
      return false;
    });

    const orderRecords = matchedTx.filter(m => !isBooking(m)).map(o => {
      const rawDate = o.created_at || o.createdAt || o.orderDate || o.date;
      const amount = Number(o.amount || o.totalAmount || o.finalAmount || 0);
      const items = Array.isArray(o.items) && o.items.length > 0 ? o.items : [];
      const productName = items.length > 0 ? items.map(i => i.name || i.productName || 'Item').join(', ') : (o.product_details || o.productName || 'Product Item');
      const category = (items[0]?.category) || o.category || o.type || 'Products';
      const quantity = items.reduce((acc, it) => acc + Number(it.quantity || it.qty || 1), 0) || Number(o.quantity || o.qty || 1);

      return {
        orderId: o.order_number || o.orderNumber || o.orderId || o.id || o._id,
        orderDate: rawDate ? new Date(rawDate).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent',
        createdAt: rawDate,
        productName,
        category,
        quantity,
        amount,
        paymentStatus: o.paymentStatus || o.payment_status || (isEligiblePaid(o) ? 'Paid' : 'Pending'),
        status: o.status || 'Order Received'
      };
    });

    const bookingRecords = matchedTx.filter(m => isBooking(m)).map(b => {
      const rawDate = b.created_at || b.createdAt || b.bookingDate || b.date;
      const schedule = b.appointmentDate || b.checkInDate || (rawDate ? new Date(rawDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Scheduled');
      const amount = Number(b.amount || b.totalAmount || b.finalAmount || b.charge || 0);
      
      const rawType = String(b.type || b.bookingType || b.category || '').toLowerCase();
      const isStay = rawType.includes('stay') || (b.product_details && /hotel|room|deluxe|resort/i.test(b.product_details));
      const isTravel = rawType.includes('travel') || (b.product_details && /travel|cab|tour/i.test(b.product_details));
      const category = isStay ? 'Stay' : (isTravel ? 'Travel' : 'Service');

      const serviceName = b.product_details || (b.items && b.items[0]?.name) || b.service || (isStay ? 'Deluxe Room' : (isTravel ? 'Travel Service' : 'Specialized Service'));

      return {
        bookingId: b.bookingNumber || b.order_number || b.bookingId || b.id || b._id,
        bookingDate: rawDate ? new Date(rawDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent',
        createdAt: rawDate,
        category,
        serviceName,
        schedule,
        amount,
        paymentStatus: b.paymentStatus || b.payment_status || (isEligiblePaid(b) ? 'Paid' : 'Pending'),
        status: b.status || 'Booking Confirmed'
      };
    });

    const paidList = matchedTx.filter(isEligiblePaid);
    const totalSpent = paidList.reduce((sum, m) => sum + Number(m.amount || m.totalAmount || m.finalAmount || 0), 0);

    return res.json({
      success: true,
      customer: {
        ...enrichedCustomer,
        totalOrders: orderRecords.length,
        totalBookings: bookingRecords.length,
        totalSpent: Math.round(totalSpent),
        formattedSpend: `₹${Math.round(totalSpent).toLocaleString('en-IN')}`
      },
      orders: orderRecords,
      bookings: bookingRecords
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch customer history', error: error.message });
  }
}

module.exports = {
  getCustomers,
  getMembershipCards,
  upgradeMembership,
  getCustomerHistory,
  getCustomerDetails: getCustomerHistory
};
