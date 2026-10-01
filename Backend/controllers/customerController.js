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
 * Find customer's active membership card from db.cardholders
 */
function findCustomerCard(customer, allCardholders) {
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
function enrichCustomer(c, allCardholders) {
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

  // Find membership card from db.cardholders or customer.membership
  const card = findCustomerCard(c, allCardholders);
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
    if (db.customers && typeof db.customers.reloadFromMongo === 'function') {
      await db.customers.reloadFromMongo();
    }
    if (db.cardholders && typeof db.cardholders.reloadFromMongo === 'function') {
      await db.cardholders.reloadFromMongo();
    }

    const allCardholders = Array.from(db.cardholders || []);
    const rawCustomers = Array.from(db.customers || []);

    // Enrich all customers with verified coordinates & membership tier
    const enriched = rawCustomers.map(c => enrichCustomer(c, allCardholders));

    // Apply strict location filtering
    let scoped = filterByLocation(enriched, req.user);

    // Apply query filters
    const { search, tier, status, pincode } = req.query;
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

    return res.json({ success: true, count: scoped.length, customers: scoped });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch customers', error: error.message });
  }
}

async function getMembershipCards(req, res) {
  try {
    if (db.cardholders && typeof db.cardholders.reloadFromMongo === 'function') {
      await db.cardholders.reloadFromMongo();
    }
    if (db.customers && typeof db.customers.reloadFromMongo === 'function') {
      await db.customers.reloadFromMongo();
    }

    const rawCardholders = Array.from(db.cardholders || []);
    const rawCustomers = Array.from(db.customers || []);

    const allCards = rawCardholders
      .filter(ch => ch.cardNumber && ch.cardNumber.startsWith('FIC-'))
      .map(ch => {
        const cust = rawCustomers.find(c => 
          (ch.phone && c.phone === ch.phone) || 
          (ch.email && c.email && c.email.toLowerCase() === ch.email.toLowerCase()) ||
          (ch.name && c.name && ch.name.toLowerCase() === c.name.toLowerCase() && ch.name !== 'Customer Member')
        );

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
          customerId: cust ? (cust.id || cust.customerId || cust._id) : (ch.customerId || '-'),
          customerName: cust ? cust.name : ch.name,
          customerPhone: cust ? cust.phone : ch.phone,
          customerEmail: cust ? cust.email : ch.email,
          cardNumber: ch.cardNumber,
          tier,
          cardType: tier,
          // Prefer actual stored values from the cardholder record
          amount: ch.amount || ch.cardAmount || amountMap[tier] || 15000,
          paymentAmount: ch.paymentAmount || ch.amount || amountMap[tier] || 15000,
          paymentStatus: ch.paymentStatus || 'PAID',
          paymentDate: ch.paymentDate || ch.createdAt,
          issueDate: ch.createdAt ? new Date(ch.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
          validFrom: ch.validFrom || ch.createdAt,
          validUntil: ch.expiryDate || ch.validUntil,
          status: (ch.status === 'active' ? 'Active' : (ch.status === 'expired' ? 'Expired' : (ch.status || 'Active'))),
          discountPercent: ch.discountPercent || discountMap[tier] || 10,
          points: ch.points || ch.rewardPoints || pointsMap[tier] || 1000,
          state,
          district,
          division,
          pincode
        };
      });

    // Enforce territorial access control
    const scopedCards = filterByLocation(allCards, req.user);

    // Tier counts strictly for scoped territory
    const counts = {
      total: scopedCards.length,
      silver: scopedCards.filter(c => c.tier === 'Silver').length,
      gold: scopedCards.filter(c => c.tier === 'Gold').length,
      diamond: scopedCards.filter(c => c.tier === 'Diamond').length
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
