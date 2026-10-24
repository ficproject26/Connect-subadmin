/**
 * Centralized, Reusable, Configuration-Driven Application Security Module
 * 
 * Defines application context, authorized roles, and security policies for this repository.
 * This pattern can be reused across all repositories in the ecosystem with their respective roles.
 */

const APP_CONTEXT = process.env.APP_CONTEXT || 'sub_admin_management';

// Authoritative roles permitted to access THIS application's dashboard and management APIs
const AUTHORIZED_APP_ROLES = [
  'Super Admin',
  'State Admin',
  'District Admin',
  'Divisional Admin',
  'Division Admin',
  'Pincode Admin'
];

// Normalize role string into canonical representation, preserving administrative level
const normalizeRoleName = (role, user = null) => {
  if (!role && !user) return '';

  const userObj = (typeof role === 'object' && role !== null) ? role : (user || {});
  const rawRoleStr = typeof role === 'string' ? role : (userObj.role || userObj.adminRole || '');
  const r = String(rawRoleStr).toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();
  const ar = String(userObj.adminRole || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();

  // 1. Explicit adminRole or sub-admin role strings
  if (r === 'state admin' || r === 'stateadmin' || ar === 'state admin' || ar === 'state-admin' || ar === 'stateadmin') return 'State Admin';
  if (r === 'district admin' || r === 'districtadmin' || ar === 'district admin' || ar === 'district-admin' || ar === 'districtadmin') return 'District Admin';
  if (r === 'divisional admin' || r === 'division admin' || r === 'divisionaladmin' || r === 'divisionadmin' || ar.includes('divis')) return 'Divisional Admin';
  if (r === 'pincode admin' || r === 'pincodeadmin' || ar.includes('pincode') || ar === 'pin-admin') return 'Pincode Admin';

  // 2. Generic 'admin' role disambiguation based on user assigned territories
  if (r === 'admin') {
    if (ar.includes('state')) return 'State Admin';
    if (ar.includes('dist')) return 'District Admin';
    if (ar.includes('divis')) return 'Divisional Admin';
    if (ar.includes('pin')) return 'Pincode Admin';

    // If assigned to a state without lower level assignments (district/division/pincode), it is State Admin
    const hasState = Boolean(userObj.state || userObj.assignedState);
    const hasDist = Boolean(userObj.district || userObj.assignedDistrict);
    const hasDiv = Boolean(userObj.division || userObj.assignedDivision);
    const hasPin = Boolean(userObj.pincode || userObj.assignedPincode);

    if (hasState && !hasDist && !hasDiv && !hasPin) {
      const stateVal = String(userObj.state || userObj.assignedState || '').trim().toLowerCase();
      if (stateVal && stateVal !== 'all india') {
        return 'State Admin';
      }
    } else if (hasDist && !hasDiv && !hasPin) {
      return 'District Admin';
    } else if (hasDiv && !hasPin) {
      return 'Divisional Admin';
    } else if (hasPin) {
      return 'Pincode Admin';
    }

    return 'Super Admin';
  }

  if (r === 'super admin' || r === 'main admin' || r === 'superadmin') return 'Super Admin';

  return role;
};

// Check if a role is authorized for THIS application
const isRoleAuthorizedForApp = (roleOrUser) => {
  if (!roleOrUser) return false;
  const roleStr = typeof roleOrUser === 'string' ? roleOrUser : (roleOrUser.role || roleOrUser.adminRole || '');
  if (!roleStr) return false;

  const raw = String(roleStr).toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();

  // Explicitly deny non-admin roles in Sub-Admin portal
  if (
    raw.includes('manager') ||
    raw.includes('agent') ||
    raw.includes('vendor') ||
    raw.includes('customer') ||
    raw === 'member' ||
    raw === 'staff'
  ) {
    return false;
  }

  const normalized = normalizeRoleName(roleStr, typeof roleOrUser === 'object' ? roleOrUser : null);
  return AUTHORIZED_APP_ROLES.includes(normalized) || AUTHORIZED_APP_ROLES.includes(roleStr);
};

// Check if account status is considered active and approved
const isAccountApproved = (user) => {
  if (!user) return false;
  const status = String(user.status || '').toLowerCase().trim();
  const adminApprovalStatus = String(user.adminApprovalStatus || '').toLowerCase().trim();
  const subAdminApprovalStatus = String(user.subAdminApprovalStatus || '').toLowerCase().trim();
  const mainAdminApprovalStatus = String(user.mainAdminApprovalStatus || '').toLowerCase().trim();
  const kycStatus = String(user.kycStatus || '').toLowerCase().trim();
  const role = String(user.role || '').toLowerCase().trim();

  // If explicitly flagged as requiring approval, or isActive is false, or not fully approved
  if (user.requiresApproval === true || user.isActive === false || user.isFullyApproved === false) {
    return false;
  }

  // Any pending status string denies access
  if (
    status.includes('pending') ||
    status === 'rejected' ||
    status === 'suspended' ||
    status === 'inactive'
  ) {
    return false;
  }

  // Agents & Managers strictly require Main Admin approval & KYC approval
  if (role.includes('agent') || role.includes('manager')) {
    if (mainAdminApprovalStatus && mainAdminApprovalStatus !== 'approved') return false;
    if (subAdminApprovalStatus && subAdminApprovalStatus !== 'approved') return false;
    if (kycStatus && !['verified', 'approved'].includes(kycStatus)) return false;
  }

  // Must have active or approved status
  const isStatusApproved = status === 'active' || status === 'approved';
  const isAdminApproved = !adminApprovalStatus || adminApprovalStatus === 'approved';
  const isKycApproved = !kycStatus || kycStatus === 'verified' || kycStatus === 'approved';

  return isStatusApproved && isAdminApproved && isKycApproved;
};

// Check if account is suspended, blocked, revoked, deleted, or rejected
const isAccountBlockedOrSuspended = (user) => {
  if (!user) return true;
  const status = String(user.status || '').toLowerCase().trim();
  const adminApprovalStatus = String(user.adminApprovalStatus || '').toLowerCase().trim();
  const kycStatus = String(user.kycStatus || '').toLowerCase().trim();

  return (
    status === 'suspended' ||
    status === 'blocked' ||
    status === 'revoked' ||
    status === 'inactive' ||
    status === 'rejected' ||
    status === 'deleted' ||
    status === 'deactivated' ||
    user.isDeleted === true ||
    adminApprovalStatus === 'rejected' ||
    kycStatus === 'rejected'
  );
};

module.exports = {
  APP_CONTEXT,
  AUTHORIZED_APP_ROLES,
  normalizeRoleName,
  isRoleAuthorizedForApp,
  isAccountApproved,
  isAccountBlockedOrSuspended
};
