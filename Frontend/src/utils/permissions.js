export const ROLE_HIERARCHY_LEVELS = {
  'Super Admin': 5,
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

/**
 * Standardize role strings across the application.
 */
export function normalizeRole(role) {
  if (!role) return '';
  const r = role.toLowerCase().replace(/_/g, ' ').trim();
  if (r === 'division admin' || r === 'divisional admin') return 'Divisional Admin';
  if (r === 'state admin') return 'State Admin';
  if (r === 'district admin') return 'District Admin';
  if (r === 'pincode admin') return 'Pincode Admin';
  if (r.includes('manager') && !r.includes('admin')) return 'Manager';
  if (r === 'super admin' || r === 'main admin') return 'State Admin';
  return role;
}

/**
 * Get the authorized dashboard route for a given user role.
 * Ensures each role maps strictly to its own designated dashboard.
 */
export function getRoleDashboardPath(role) {
  if (!role) return '/login';
  const norm = normalizeRole(role);
  const raw = (role || '').toLowerCase().replace(/_/g, ' ').trim();

  if (norm === 'State Admin' || raw.includes('state admin') || norm === 'Super Admin' || raw.includes('super admin') || raw.includes('main admin')) {
    return '/state-admin/dashboard';
  }
  if (norm === 'State Admin' || raw.includes('state admin')) {
    return '/state-admin/dashboard';
  }
  if (norm === 'District Admin' || raw.includes('district admin')) {
    return '/district-admin/dashboard';
  }
  if (norm === 'Divisional Admin' || raw.includes('division admin') || raw.includes('divisional admin')) {
    return '/divisional-admin/dashboard';
  }
  if (norm === 'Pincode Admin' || raw.includes('pincode admin')) {
    return '/pincode-admin/dashboard';
  }
  if (norm === 'Manager' || raw.includes('manager')) {
    return '/manager/dashboard';
  }

  return '/login';
}

/**
 * Helper to check if a user role matches any allowed role.
 * Handles normalization, aliases, and sub-role tier matching.
 */
export function isRoleAllowed(userRole, allowedRoles = []) {
  if (!userRole || !allowedRoles || allowedRoles.length === 0) return false;

  const userNorm = normalizeRole(userRole);
  const userRaw = (userRole || '').toLowerCase().replace(/_/g, ' ').trim();

  return allowedRoles.some(allowed => {
    if (allowed === userRole) return true;
    const allowedNorm = normalizeRole(allowed);
    const allowedRaw = (allowed || '').toLowerCase().replace(/_/g, ' ').trim();

    if (allowedNorm === userNorm) return true;
    if (allowedRaw === userRaw) return true;

    // Divisional Admin aliases
    if ((userNorm === 'Divisional Admin') && (allowedNorm === 'Divisional Admin')) return true;

    // Manager umbrella role matching
    if (allowedNorm === 'Manager' && (userNorm === 'Manager' || userRaw.includes('manager'))) return true;
    if (userNorm === 'Manager' && (allowedNorm === 'Manager' || allowedRaw.includes('manager'))) return true;

    return false;
  });
}
