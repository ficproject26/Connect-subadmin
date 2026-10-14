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

// Normalize role string into canonical representation
const normalizeRoleName = (role) => {
  if (!role) return '';
  const r = String(role).toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();
  if (r === 'super admin' || r === 'main admin' || r === 'superadmin' || r === 'admin') return 'Super Admin';
  if (r === 'state admin' || r === 'stateadmin') return 'State Admin';
  if (r === 'district admin' || r === 'districtadmin') return 'District Admin';
  if (r === 'divisional admin' || r === 'division admin' || r === 'divisionaladmin' || r === 'divisionadmin') return 'Divisional Admin';
  if (r === 'pincode admin' || r === 'pincodeadmin') return 'Pincode Admin';
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

  const normalized = normalizeRoleName(roleStr);
  return AUTHORIZED_APP_ROLES.includes(normalized) || AUTHORIZED_APP_ROLES.includes(roleStr);
};

// Check if account status is considered active and approved
const isAccountApproved = (user) => {
  if (!user) return false;
  const status = String(user.status || '').toLowerCase().trim();
  const adminApprovalStatus = String(user.adminApprovalStatus || '').toLowerCase().trim();
  const kycStatus = String(user.kycStatus || '').toLowerCase().trim();

  // If explicitly flagged as requiring approval, or isActive is false
  if (user.requiresApproval === true || user.isActive === false) {
    return false;
  }

  // Must have active or approved status
  const isStatusApproved = status === 'active' || status === 'approved';
  const isAdminApproved = !adminApprovalStatus || adminApprovalStatus === 'approved';
  const isKycApproved = !kycStatus || kycStatus === 'verified' || kycStatus === 'approved';

  return isStatusApproved && isAdminApproved && isKycApproved;
};

// Check if account is suspended, blocked, revoked, or rejected
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
