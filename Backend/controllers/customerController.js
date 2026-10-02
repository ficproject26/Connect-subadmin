const { db, filterByLocation } = require('../config/db');

// Pincode to location dictionary for enriching customer data
const PIN_MAP = {
  '641666': { state: 'Tamil Nadu', district: 'Tirupur', division: 'Palladam' },
  '635305': { state: 'Tamil Nadu', district: 'Dharmapuri', division: 'Harur Division' },
  '635002': { state: 'Tamil Nadu', district: 'Krishnagiri', division: 'Krishnagiri Division' },
  '635001': { state: 'Tamil Nadu', district: 'Krishnagiri', division: 'Krishnagiri Division' },
  '635109': { state: 'Tamil Nadu', district: 'Krishnagiri', division: 'Hosur Division' },
  '635110': { state: 'Tamil Nadu', district: 'Krishnagiri', division: 'Hosur Division' },
  '636112': { state: 'Tamil Nadu', district: 'Salem', division: 'Attur Division' },
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
  const geo = PIN_MAP[rawPin] || {};

  let state = c.state || geo.state || addr0.state || '';
  let district = c.district || geo.district || addr0.city || c.city || '';
  let division = c.division || geo.division || '';
  let street = addr0.address || c.address || '';
  let locality = addr0.locality || '';
  let city = addr0.city || c.city || district || '';

  const DISTRICT_STATE_MAP = {
    'krishnagiri': 'Tamil Nadu',
    'dharmapuri': 'Tamil Nadu',
    'salem': 'Tamil Nadu',
    'erode': 'Tamil Nadu',
    'tirupur': 'Tamil Nadu',
    'tiruppur': 'Tamil Nadu',
    'coimbatore': 'Tamil Nadu',
    'dindigul': 'Tamil Nadu',
    'chennai': 'Tamil Nadu',
    'namakkal': 'Tamil Nadu',
    'madurai': 'Tamil Nadu',
    'thiruvarur': 'Tamil Nadu',
    'bengaluru urban': 'Karnataka',
    'bangalore': 'Karnataka',
    'thrissur': 'Kerala',
    'ntr district': 'Andhra Pradesh',
    'vijayawada': 'Andhra Pradesh'
  };

  const dLow = (district || '').toLowerCase().trim();
  if (dLow && DISTRICT_STATE_MAP[dLow]) {
    state = DISTRICT_STATE_MAP[dLow];
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

async function getCustomers(req, res) {
  try {
    const allCardholders = Array.from(db.cardholders || []);
    const rawCustomers = Array.from(db.customers || []);

    // Build O(1) indices for fast cardholder lookups
    const cardholderIndices = buildCardholderIndices(allCardholders);

    // Enrich all customers with verified coordinates & membership tier
    const enriched = rawCustomers.map(c => enrichCustomer(c, cardholderIndices));

    // Apply strict location filtering
    let scoped = filterByLocation(enriched, req.user);

    // Apply query filters
    const { search, tier, status, pincode, page, limit } = req.query;
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
    if (pincode && req.user.role !== 'Pincode Admin') {
      scoped = scoped.filter(c => c.pincode === pincode);
    }

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
        const geo = PIN_MAP[rawPin] || {};

        let state = ch.state || (cust && cust.state) || geo.state || 'Tamil Nadu';
        let district = ch.district || (cust && (cust.district || cust.city)) || geo.district || 'Salem';
        let division = ch.division || (cust && cust.division) || geo.division || 'Attur Division';
        let pincode = rawPin || (cust && cust.pincode) || '636112';

        if (district && district.toLowerCase() === 'salem') state = 'Tamil Nadu';
        if (district && district.toLowerCase() === 'krishnagiri') state = 'Tamil Nadu';
        if (district && district.toLowerCase() === 'dharmapuri') state = 'Tamil Nadu';

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
        const geo = PIN_MAP[rawPin] || {};
        let state = cust.state || geo.state || 'Tamil Nadu';
        let district = cust.district || cust.city || geo.district || 'Salem';
        let division = cust.division || geo.division || 'Attur Division';
        let pincode = rawPin || '636112';

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
    const scopedCards = filterByLocation(combinedList, req.user);

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

module.exports = {
  getCustomers,
  getMembershipCards,
  upgradeMembership
};
