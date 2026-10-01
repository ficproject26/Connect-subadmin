const { db } = require('../config/db');

/**
 * Builds a fast, comprehensive in-memory vendor directory.
 * Unifies records from:
 * 1. db.vendors
 * 2. db.users (vendors and their sub-businesses in `businesses` array)
 * 3. db.settlements
 * 4. Postal directory from db.pincodes
 */
function getComprehensiveVendorDirectory() {
  const pinLookup = new Map();
  Array.from(db.pincodes || []).forEach(p => {
    const code = String(p.code || p.pincode || '').trim();
    if (code && !pinLookup.has(code)) {
      pinLookup.set(code, {
        state: p.state || p.stateName || 'Tamil Nadu',
        district: p.district || p.districtName || '',
        division: p.division || p.divisionName || '',
        area: p.name || p.area || p.areaName || ''
      });
    }
  });

  const vendorMap = new Map();

  function register(key, entry) {
    if (!key) return;
    const sKey = String(key).trim();
    if (!sKey) return;
    const existing = vendorMap.get(sKey) || {};
    vendorMap.set(sKey, { ...existing, ...entry });
  }

  // 1. Index db.vendors
  Array.from(db.vendors || []).forEach(v => {
    const vPin = String(v.pincode || v.assignedPincode || '').trim();
    const pinInfo = pinLookup.get(vPin) || {};

    const entry = {
      vendorId: String(v._id || v.id || v.registrationId || ''),
      registrationId: v.registrationId || String(v._id || v.id || ''),
      vendorName: v.ownerName || v.name || v.contactPerson || v.businessName || 'Vendor Merchant',
      businessName: v.businessName || v.name || 'Merchant Enterprise',
      businessType: v.category || v.subCategory || 'Commercial Partner',
      phone: v.phone || v.mobile || '',
      email: v.email || '',
      address: v.address || (v.location && v.location.address) || '',
      fullAddress: v.address || (v.location && v.location.address) || '',
      state: v.state || v.assignedState || pinInfo.state || 'Tamil Nadu',
      district: v.district || v.assignedDistrict || pinInfo.district || '',
      division: v.division || v.assignedDivision || pinInfo.division || '',
      pincode: vPin,
      area: pinInfo.area || '',
      stateId: v.stateId || null,
      districtId: v.districtId || null,
      divisionId: v.divisionId || null,
      pincodeId: v.pincodeId || null
    };

    register(v._id, entry);
    register(v.id, entry);
    register(v.registrationId, entry);
    if (v.businessName) register(v.businessName.toLowerCase(), entry);
    if (v.name) register(v.name.toLowerCase(), entry);
  });

  // 2. Index db.users (vendors with nested businesses)
  Array.from(db.users || []).forEach(u => {
    const isVendor = String(u.role || '').toLowerCase() === 'vendor' || Array.isArray(u.businesses);
    if (!isVendor) return;

    const uPin = String(u.pincode || u.postalCode || (u.addresses && u.addresses[0] && u.addresses[0].pincode) || '').trim();
    const pinInfo = pinLookup.get(uPin) || {};

    const baseEntry = {
      vendorId: String(u.vendorId || u.registrationId || u._id || u.id || ''),
      registrationId: u.registrationId || u.vendorId || String(u._id || u.id || ''),
      vendorName: u.name || u.contactPerson || u.businessName || 'Vendor Partner',
      businessName: u.businessName || u.name || 'Merchant Partner',
      businessType: u.category || u.vendorType || 'Commercial Partner',
      phone: u.phone || u.mobileNumber || '',
      email: u.email || '',
      address: u.address || u.street || (u.addresses && u.addresses[0] && u.addresses[0].address) || '',
      fullAddress: u.address || u.street || '',
      state: u.state || pinInfo.state || 'Tamil Nadu',
      district: u.district || u.city || pinInfo.district || '',
      division: u.division || pinInfo.division || '',
      pincode: uPin,
      area: pinInfo.area || '',
      stateId: u.stateId || null,
      districtId: u.districtId || null,
      divisionId: u.divisionId || null,
      pincodeId: u.pincodeId || null
    };

    register(u._id, baseEntry);
    register(u.id, baseEntry);
    register(u.vendorId, baseEntry);
    register(u.registrationId, baseEntry);
    if (u.businessName) register(u.businessName.toLowerCase(), baseEntry);
    if (u.name) register(u.name.toLowerCase(), baseEntry);

    if (Array.isArray(u.businesses)) {
      u.businesses.forEach(b => {
        const bPin = String(b.pincode || uPin).trim();
        const bPinInfo = pinLookup.get(bPin) || {};
        const bEntry = {
          vendorId: String(b._id || b.id || baseEntry.vendorId),
          registrationId: baseEntry.registrationId,
          vendorName: baseEntry.vendorName,
          businessName: b.businessName || baseEntry.businessName,
          businessType: b.vendorType || b.category || baseEntry.businessType,
          phone: b.phone || baseEntry.phone,
          email: baseEntry.email,
          address: b.address || baseEntry.address,
          fullAddress: b.address || baseEntry.address,
          state: b.state || bPinInfo.state || baseEntry.state,
          district: b.district || bPinInfo.district || baseEntry.district,
          division: b.division || bPinInfo.division || baseEntry.division,
          pincode: bPin,
          area: bPinInfo.area || '',
          stateId: b.stateId || baseEntry.stateId,
          districtId: b.districtId || baseEntry.districtId,
          divisionId: b.divisionId || baseEntry.divisionId,
          pincodeId: b.pincodeId || baseEntry.pincodeId
        };
        register(b._id, bEntry);
        register(b.id, bEntry);
        if (b.businessName) register(b.businessName.toLowerCase(), bEntry);
      });
    }
  });

  // 3. Index db.settlements
  Array.from(db.settlements || []).forEach(s => {
    const sId = String(s.vendorId || s._id || s.id || '').trim();
    if (sId && !vendorMap.has(sId)) {
      const entry = {
        vendorId: sId,
        registrationId: sId,
        vendorName: s.vendorBusinessName || 'Vendor Merchant',
        businessName: s.vendorBusinessName || 'Merchant Enterprise',
        businessType: 'Merchant',
        phone: '',
        email: '',
        address: '',
        fullAddress: '',
        state: 'Tamil Nadu',
        district: '',
        division: '',
        pincode: '',
        area: ''
      };
      register(sId, entry);
      if (s.vendorBusinessName) register(s.vendorBusinessName.toLowerCase(), entry);
    }
  });

  return {
    vendorMap,
    pinLookup,
    findVendor: (identifier) => {
      if (!identifier) return null;
      const str = String(identifier).trim();
      return vendorMap.get(str) || vendorMap.get(str.toLowerCase()) || null;
    }
  };
}

module.exports = {
  getComprehensiveVendorDirectory
};
