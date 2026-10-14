const { db } = require('../config/db');

/**
 * Normalizes text for case and whitespace-insensitive comparison.
 */
function norm(str) {
  return String(str || '').trim().toLowerCase();
}

/**
 * Normalizes division names (e.g., 'Hosur Division' -> 'hosur').
 */
function normDiv(div) {
  return norm(div).replace(/\s+division$/, '');
}

/**
 * Dynamically resolves the responsible admin for a given vendor PIN code
 * using the database users collection and the existing admin hierarchy.
 *
 * Rules:
 * 1. Pincode Admin assigned specifically to vendor.pincode
 * 2. If no Pincode Admin, Division Admin assigned to vendor.division and district
 * 3. If no Division Admin, District Admin assigned to vendor.district
 * 4. If no District Admin, State Admin assigned to vendor.state
 * 5. If none, return status 'PENDING_ADMIN_ASSIGNMENT'
 */
function resolveResponsibleAdmin(vendorLocation = {}, optionalHierarchy = {}) {
  let pincode = '';
  let division = '';
  let district = '';
  let state = '';

  if (typeof vendorLocation === 'string' || typeof vendorLocation === 'number') {
    pincode = String(vendorLocation).trim();
    if (optionalHierarchy && typeof optionalHierarchy === 'object') {
      division = optionalHierarchy.division;
      district = optionalHierarchy.district;
      state = optionalHierarchy.state;
    }
  } else if (vendorLocation && typeof vendorLocation === 'object') {
    pincode = vendorLocation.pincode;
    division = vendorLocation.division;
    district = vendorLocation.district;
    state = vendorLocation.state;
  }

  const targetPin = String(pincode || '').trim();
  const targetDiv = normDiv(division);
  const targetDist = norm(district);
  const targetState = norm(state);

  const users = Array.from(db.users || []);

  const isApproved = (u) => {
    const s = norm(u.status);
    return s === 'approved' || s === 'active' || !s; // default to eligible if status unset
  };

  // 1. Check for Pincode Admin responsible for this PIN code
  if (targetPin) {
    const pincodeAdmin = users.find(u => {
      if (!isApproved(u)) return false;
      const role = norm(u.role);
      const adminRole = norm(u.adminRole);
      const isPinAdmin = role === 'pincode admin' || adminRole === 'pincode-admin' || (role.includes('pincode') && role.includes('admin'));
      if (!isPinAdmin) return false;
      const uPin = String(u.pincode || u.assignedPincode || '').trim();
      return uPin === targetPin;
    });

    if (pincodeAdmin) {
      return {
        isAssigned: true,
        assignmentLevel: 'PINCODE',
        status: 'ASSIGNED',
        admin: {
          id: String(pincodeAdmin._id || pincodeAdmin.id || pincodeAdmin.loginId || ''),
          adminId: String(pincodeAdmin._id || pincodeAdmin.id || pincodeAdmin.loginId || ''),
          name: pincodeAdmin.name || 'Pincode Admin',
          role: 'Pincode Admin',
          adminRole: pincodeAdmin.adminRole || 'pincode-admin',
          phone: pincodeAdmin.mobile || pincodeAdmin.phone || 'Not Available',
          mobile: pincodeAdmin.mobile || pincodeAdmin.phone || 'Not Available',
          email: pincodeAdmin.email || '',
          state: pincodeAdmin.state || state || '',
          district: pincodeAdmin.district || district || '',
          division: pincodeAdmin.division || division || '',
          pincode: targetPin
        }
      };
    }
  }

  // 2. Check for Division Admin if no Pincode Admin is assigned
  if (targetDiv) {
    const divAdmin = users.find(u => {
      if (!isApproved(u)) return false;
      const role = norm(u.role);
      const adminRole = norm(u.adminRole);
      const isDivAdmin = role.includes('division') || role.includes('divisional') || adminRole === 'divisional-admin' || adminRole === 'division-admin';
      if (!isDivAdmin) return false;
      const uDiv = normDiv(u.division || u.assignedDivision);
      const uDist = norm(u.district || u.assignedDistrict);
      return uDiv === targetDiv && (!targetDist || !uDist || uDist === targetDist);
    });

    if (divAdmin) {
      return {
        isAssigned: true,
        assignmentLevel: 'DIVISION',
        status: 'ASSIGNED_HIGHER_ADMIN',
        admin: {
          id: String(divAdmin._id || divAdmin.id || divAdmin.loginId || ''),
          adminId: String(divAdmin._id || divAdmin.id || divAdmin.loginId || ''),
          name: divAdmin.name || 'Division Admin',
          role: 'Division Admin',
          adminRole: divAdmin.adminRole || 'divisional-admin',
          phone: divAdmin.mobile || divAdmin.phone || 'Not Available',
          mobile: divAdmin.mobile || divAdmin.phone || 'Not Available',
          email: divAdmin.email || '',
          state: divAdmin.state || state || '',
          district: divAdmin.district || district || '',
          division: divAdmin.division || division || '',
          pincode: targetPin || divAdmin.pincode || ''
        }
      };
    }
  }

  // 3. Check for District Admin if no Division Admin
  if (targetDist) {
    const distAdmin = users.find(u => {
      if (!isApproved(u)) return false;
      const role = norm(u.role);
      const adminRole = norm(u.adminRole);
      const isDistAdmin = (role.includes('district') && role.includes('admin')) || adminRole === 'district-admin';
      if (!isDistAdmin) return false;
      const uDist = norm(u.district || u.assignedDistrict);
      const uState = norm(u.state || u.assignedState);
      return uDist === targetDist && (!targetState || !uState || uState === targetState);
    });

    if (distAdmin) {
      return {
        isAssigned: true,
        assignmentLevel: 'DISTRICT',
        status: 'ASSIGNED_HIGHER_ADMIN',
        admin: {
          id: String(distAdmin._id || distAdmin.id || distAdmin.loginId || ''),
          adminId: String(distAdmin._id || distAdmin.id || distAdmin.loginId || ''),
          name: distAdmin.name || 'District Admin',
          role: 'District Admin',
          adminRole: distAdmin.adminRole || 'district-admin',
          phone: distAdmin.mobile || distAdmin.phone || 'Not Available',
          mobile: distAdmin.mobile || distAdmin.phone || 'Not Available',
          email: distAdmin.email || '',
          state: distAdmin.state || state || '',
          district: distAdmin.district || district || '',
          division: division || '',
          pincode: targetPin || distAdmin.pincode || ''
        }
      };
    }
  }

  // 4. Check for State Admin
  if (targetState) {
    const stateAdmin = users.find(u => {
      if (!isApproved(u)) return false;
      const role = norm(u.role);
      const adminRole = norm(u.adminRole);
      const isStateAdmin = (role.includes('state') && role.includes('admin')) || adminRole === 'state-admin';
      if (!isStateAdmin) return false;
      const uState = norm(u.state || u.assignedState);
      return !uState || uState === 'all india' || uState === targetState;
    });

    if (stateAdmin) {
      return {
        isAssigned: true,
        assignmentLevel: 'STATE',
        status: 'ASSIGNED_HIGHER_ADMIN',
        admin: {
          id: String(stateAdmin._id || stateAdmin.id || stateAdmin.loginId || ''),
          adminId: String(stateAdmin._id || stateAdmin.id || stateAdmin.loginId || ''),
          name: stateAdmin.name || 'State Admin',
          role: 'State Admin',
          adminRole: stateAdmin.adminRole || 'state-admin',
          phone: stateAdmin.mobile || stateAdmin.phone || 'Not Available',
          mobile: stateAdmin.mobile || stateAdmin.phone || 'Not Available',
          email: stateAdmin.email || '',
          state: stateAdmin.state || state || '',
          district: district || '',
          division: division || '',
          pincode: targetPin || stateAdmin.pincode || ''
        }
      };
    }
  }

  // 5. Fallback: Pending assignment
  return {
    isAssigned: false,
    assignmentLevel: 'NONE',
    status: 'PENDING_ADMIN_ASSIGNMENT',
    admin: {
      id: '-',
      adminId: '-',
      name: 'Pending Admin Assignment',
      role: 'Unassigned',
      adminRole: 'unassigned',
      phone: 'Not Available',
      mobile: 'Not Available',
      email: '',
      state: state || '',
      district: district || '',
      division: division || '',
      pincode: targetPin
    }
  };
}

/**
 * Checks whether a given admin user is authorized to approve or reject
 * requests for a specific vendor's pincode and location.
 */
function isUserAuthorizedForVendor(user, vendor) {
  if (!user || !vendor) return false;
  const role = norm(user.role);
  const adminRole = norm(user.adminRole);

  // Super Admin can approve all
  if (role.includes('super admin') || role === 'admin' || adminRole === 'super-admin' || user.state === 'All India') {
    return true;
  }

  const vPin = String(vendor.pincode || '').trim();
  const vDiv = normDiv(vendor.division);
  const vDist = norm(vendor.district);
  const vState = norm(vendor.state);

  // Pincode Admin must match exact pincode
  if (role.includes('pincode') || adminRole === 'pincode-admin') {
    const userPin = String(user.pincode || user.assignedPincode || '').trim();
    return Boolean(userPin && vPin && userPin === vPin);
  }

  // Division Admin must match division and district
  if (role.includes('division') || role.includes('divisional') || adminRole === 'divisional-admin') {
    const userDiv = normDiv(user.division || user.assignedDivision);
    const userDist = norm(user.district || user.assignedDistrict);
    return Boolean(userDiv && vDiv && userDiv === vDiv && (!userDist || userDist === vDist));
  }

  // District Admin must match district
  if (role.includes('district') || adminRole === 'district-admin') {
    const userDist = norm(user.district || user.assignedDistrict);
    return Boolean(userDist && vDist && userDist === vDist);
  }

  // State Admin must match state
  if (role.includes('state') || adminRole === 'state-admin') {
    const userState = norm(user.state || user.assignedState);
    return Boolean(!userState || userState === 'all india' || userState === vState);
  }

  return false;
}

module.exports = {
  resolveResponsibleAdmin,
  isUserAuthorizedForVendor
};
