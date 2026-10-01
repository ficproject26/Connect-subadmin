const ROLE_HIERARCHY = {
  'State Admin': 4,
  'District Admin': 3,
  'Divisional Admin': 2,
  'Division Admin': 2,
  'Pincode Admin': 1,
  'Manager': 1,
  'state_manager': 1,
  'district_manager': 1,
  'division_manager': 1,
  'pincode_manager': 1
};

const MODULE_PERMISSIONS = {
  'Customers': ['State Admin', 'District Admin', 'Divisional Admin', 'Division Admin', 'Pincode Admin'],
  'Membership Cards': ['State Admin', 'District Admin', 'Divisional Admin', 'Division Admin', 'Pincode Admin'],
  'Vendors': ['State Admin', 'District Admin', 'Divisional Admin', 'Division Admin', 'Pincode Admin'],
  'Vendor Payments': ['State Admin', 'District Admin', 'Divisional Admin', 'Division Admin', 'Pincode Admin'],
  'Pincode Manager': ['State Admin', 'District Admin', 'Divisional Admin', 'Division Admin', 'Pincode Admin'],
  'Business Reports': ['State Admin', 'District Admin', 'Divisional Admin', 'Division Admin', 'Pincode Admin'],
  'KYC': ['State Admin', 'District Admin', 'Divisional Admin', 'Division Admin', 'Pincode Admin'],
  'Orders': ['State Admin', 'District Admin', 'Divisional Admin', 'Division Admin', 'Pincode Admin'],
  'Bookings': ['State Admin', 'District Admin', 'Divisional Admin', 'Division Admin', 'Pincode Admin'],
  'Jobs': ['State Admin', 'District Admin', 'Divisional Admin', 'Division Admin', 'Pincode Admin'],
  'Technicians': ['State Admin', 'District Admin', 'Divisional Admin', 'Division Admin', 'Pincode Admin'],
  'Executives': ['State Admin', 'District Admin', 'Divisional Admin', 'Division Admin', 'Pincode Admin'],
  'Support Team': ['State Admin', 'District Admin', 'Divisional Admin', 'Division Admin', 'Pincode Admin'],
  'Agents': ['State Admin', 'District Admin', 'Divisional Admin', 'Division Admin', 'Pincode Admin'],
  'Agent Payments': ['State Admin', 'District Admin', 'Divisional Admin', 'Division Admin', 'Pincode Admin']
};

function hasPermission(role, moduleName) {
  const allowedRoles = MODULE_PERMISSIONS[moduleName];
  if (!allowedRoles) return true;
  const normalized = (role === 'Division Admin' ? 'Divisional Admin' : role);
  return allowedRoles.includes(role) || allowedRoles.includes(normalized);
}

function normalizeAdminRole(role) {
  if (!role) return '';
  const r = String(role).toLowerCase().replace(/[_-]/g, ' ').trim();
  if (r === 'super admin' || r === 'main admin' || r === 'superadmin' || r === 'admin') return 'Super Admin';
  if (r === 'state admin' || r === 'stateadmin') return 'State Admin';
  if (r === 'district admin' || r === 'districtadmin') return 'District Admin';
  if (r === 'division admin' || r === 'divisional admin' || r === 'divisionadmin' || r === 'divisionaladmin') return 'Division Admin';
  if (r === 'pincode admin' || r === 'pincodeadmin') return 'Pincode Admin';
  if (r.includes('manager')) return 'Manager';
  return role;
}

function cleanDivName(d) {
  return String(d || '').toLowerCase().replace(/\s+division$/i, '').trim();
}

function resolveAdminTerritory(user) {
  if (!user) {
    return {
      isValid: false,
      message: 'Authentication required. No user session found.',
      level: 'none'
    };
  }

  const role = normalizeAdminRole(user.role);
  const state = (user.state || user.assignedState || '').trim();
  const district = (user.district || user.assignedDistrict || '').trim();
  const division = (user.division || user.assignedDivision || '').trim();
  const pincode = String(user.pincode || user.assignedPincode || '').trim();
  const stateId = user.stateId ? String(user.stateId).trim() : null;
  const districtId = user.districtId ? String(user.districtId).trim() : null;
  const divisionId = user.divisionId ? String(user.divisionId).trim() : null;
  const pincodeId = user.pincodeId ? String(user.pincodeId).trim() : null;

  if (role === 'Super Admin') {
    return {
      isValid: true,
      level: 'super',
      role,
      state, district, division, pincode,
      stateId, districtId, divisionId, pincodeId
    };
  }

  if (role === 'State Admin') {
    if ((!state || state.toLowerCase() === 'all india') && !stateId) {
      return {
        isValid: false,
        message: 'Territory assignment is incomplete. Please contact Super Admin.',
        level: 'state',
        role
      };
    }
    return {
      isValid: true,
      level: 'state',
      role,
      state, district, division, pincode,
      stateId, districtId, divisionId, pincodeId
    };
  }

  if (role === 'District Admin') {
    if (!state || (!district && !districtId)) {
      return {
        isValid: false,
        message: 'Territory assignment is incomplete. Please contact Super Admin.',
        level: 'district',
        role
      };
    }
    return {
      isValid: true,
      level: 'district',
      role,
      state, district, division, pincode,
      stateId, districtId, divisionId, pincodeId
    };
  }

  if (role === 'Division Admin') {
    if (!state || !district || (!division && !divisionId)) {
      return {
        isValid: false,
        message: 'Territory assignment is incomplete. Please contact Super Admin.',
        level: 'division',
        role
      };
    }
    return {
      isValid: true,
      level: 'division',
      role,
      state, district, division, pincode,
      stateId, districtId, divisionId, pincodeId
    };
  }

  if (role === 'Pincode Admin') {
    if (!state || !district || (!pincode && !pincodeId)) {
      return {
        isValid: false,
        message: 'Territory assignment is incomplete. Please contact Super Admin.',
        level: 'pincode',
        role
      };
    }
    return {
      isValid: true,
      level: 'pincode',
      role,
      state, district, division, pincode,
      stateId, districtId, divisionId, pincodeId
    };
  }

  return {
    isValid: true,
    level: 'other',
    role,
    state, district, division, pincode,
    stateId, districtId, divisionId, pincodeId
  };
}

function isEntityInAdminTerritory(entity, territory) {
  if (!territory || !territory.isValid) return false;
  if (territory.level === 'super') return true;

  const entState = String(entity.vendorState || entity.state || '').trim().toLowerCase();
  const entStateId = entity.vendorStateId ? String(entity.vendorStateId).trim() : (entity.stateId ? String(entity.stateId).trim() : null);

  const adminState = territory.state ? territory.state.trim().toLowerCase() : '';
  const adminStateId = territory.stateId;

  // State check: must match state name or stateId
  const stateMatch = (adminState && entState === adminState) || (adminStateId && entStateId && entStateId === adminStateId);
  if (!stateMatch) return false;

  if (territory.level === 'state') return true;

  // District check
  const entDistrict = String(entity.vendorDistrict || entity.district || '').trim().toLowerCase();
  const entDistrictId = entity.vendorDistrictId ? String(entity.vendorDistrictId).trim() : (entity.districtId ? String(entity.districtId).trim() : null);

  const adminDistrict = territory.district ? territory.district.trim().toLowerCase() : '';
  const adminDistrictId = territory.districtId;

  const districtMatch = (adminDistrict && entDistrict === adminDistrict) || (adminDistrictId && entDistrictId && entDistrictId === adminDistrictId);
  if (!districtMatch) return false;

  if (territory.level === 'district') return true;

  // Division check
  const entDivision = cleanDivName(entity.vendorDivision || entity.division);
  const entDivisionId = entity.vendorDivisionId ? String(entity.vendorDivisionId).trim() : (entity.divisionId ? String(entity.divisionId).trim() : null);

  const adminDivision = cleanDivName(territory.division);
  const adminDivisionId = territory.divisionId;

  const divisionMatch = (adminDivision && entDivision === adminDivision) || (adminDivisionId && entDivisionId && entDivisionId === adminDivisionId);
  if (!divisionMatch) return false;

  if (territory.level === 'division') return true;

  // Pincode check
  const entPincode = String(entity.vendorPincode || entity.pincode || '').trim();
  const entPincodeId = entity.vendorPincodeId ? String(entity.vendorPincodeId).trim() : (entity.pincodeId ? String(entity.pincodeId).trim() : null);

  const adminPincode = String(territory.pincode || '').trim();
  const adminPincodeId = territory.pincodeId;

  const pincodeMatch = (adminPincode && entPincode === adminPincode) || (adminPincodeId && entPincodeId && entPincodeId === adminPincodeId);
  return Boolean(pincodeMatch);
}

module.exports = {
  ROLE_HIERARCHY,
  MODULE_PERMISSIONS,
  hasPermission,
  normalizeAdminRole,
  cleanDivName,
  resolveAdminTerritory,
  isEntityInAdminTerritory
};
