export const ROLES = {
  SUPER_ADMIN: 'Super Admin',
  STATE_ADMIN: 'State Admin',
  DISTRICT_ADMIN: 'District Admin',
  DIVISIONAL_ADMIN: 'Divisional Admin',
  PINCODE_ADMIN: 'Pincode Admin'
};

export const ROLE_HIERARCHY_LEVELS = {
  'Super Admin': 5,
  'Admin': 5,
  'State Admin': 4,
  'District Admin': 3,
  'Divisional Admin': 2,
  'Division Admin': 2,
  'Pincode Admin': 1
};

/**
 * Standardize role strings across the application.
 */
export function normalizeRole(role, user = null) {
  const u = (typeof role === 'object' && role !== null) ? role : user;
  const roleStr = (typeof role === 'string' ? role : (u?.role || ''));
  if (!roleStr && !u) return '';

  const r = (roleStr || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();
  const adminLevel = String(u?.adminLevel || u?.level || '').toLowerCase().trim();
  const adminRole = String(u?.adminRole || '').toLowerCase().trim();

  // 1. State Admin
  if (
    r === 'state admin' || r === 'stateadmin' ||
    adminLevel === 'state' || adminRole === 'state admin' || adminRole === 'branch-admin' ||
    (r === 'admin' && (u?.state || u?.assignedState) && u?.state !== 'All India' && !adminRole.includes('super') && adminLevel !== 'main' && adminLevel !== 'super')
  ) {
    return 'State Admin';
  }

  // 2. District Admin
  if (
    r === 'district admin' || r === 'districtadmin' ||
    adminLevel === 'district' || adminRole === 'district admin' || adminRole === 'district-admin'
  ) {
    return 'District Admin';
  }

  // 3. Divisional Admin
  if (
    r === 'division admin' || r === 'divisional admin' || r === 'divisionadmin' || r === 'divisionaladmin' ||
    adminLevel === 'division' || adminLevel === 'divisional' || adminRole.includes('divis')
  ) {
    return 'Divisional Admin';
  }

  // 4. Pincode Admin
  if (
    r === 'pincode admin' || r === 'pincodeadmin' ||
    adminLevel === 'pincode' || adminRole === 'pincode admin' || adminRole === 'pincode-admin'
  ) {
    return 'Pincode Admin';
  }

  // 5. Super Admin
  if (
    r === 'super admin' || r === 'main admin' || r === 'superadmin' ||
    adminLevel === 'main' || adminLevel === 'super' || adminRole.includes('super')
  ) {
    return 'Super Admin';
  }

  // 6. Generic Admin fallback
  if (r === 'admin') {
    if (u?.state && u.state !== 'All India') return 'State Admin';
    return 'Super Admin';
  }

  return roleStr;
}

/**
 * Get the authorized dashboard route for a given user role.
 * Ensures each role maps strictly to its designated dashboard.
 * Non-admin roles (Managers, Agents, Vendors, etc.) are restricted to /login.
 */
export function getRoleDashboardPath(role) {
  if (!role) return '/login';
  const norm = normalizeRole(role);
  const raw = (role || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();

  // Super Admin / Admin -> /state-admin/dashboard (or /dashboard)
  if (norm === 'Super Admin' || raw === 'admin' || raw.includes('super admin') || raw.includes('main admin')) {
    return '/state-admin/dashboard';
  }
  // State Admin -> /state-admin/dashboard
  if (norm === 'State Admin' || raw.includes('state admin')) {
    return '/state-admin/dashboard';
  }
  // District Admin -> /district-admin/dashboard
  if (norm === 'District Admin' || raw.includes('district admin')) {
    return '/district-admin/dashboard';
  }
  // Divisional Admin -> /divisional-admin/dashboard
  if (norm === 'Divisional Admin' || raw.includes('division admin') || raw.includes('divisional admin')) {
    return '/divisional-admin/dashboard';
  }
  // Pincode Admin -> /pincode-admin/dashboard
  if (norm === 'Pincode Admin' || raw.includes('pincode admin')) {
    return '/pincode-admin/dashboard';
  }

  // Strictly deny non-admin roles access to any dashboard
  return '/login';
}

/**
 * Helper to check if a user role matches any allowed role.
 * Super Admin has universal access.
 */
export function isRoleAllowed(userRole, allowedRoles = []) {
  if (!userRole || !allowedRoles || allowedRoles.length === 0) return false;

  const userNorm = normalizeRole(userRole);
  const userRaw = (userRole || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();

  // Super Admin / Admin has full universal authority across all dashboards
  if (userNorm === 'Super Admin' || userRaw === 'admin' || userRaw.includes('super admin')) {
    return true;
  }

  return allowedRoles.some(allowed => {
    if (allowed === userRole) return true;
    const allowedNorm = normalizeRole(allowed);
    const allowedRaw = (allowed || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();

    if (allowedNorm === userNorm) return true;
    if (allowedRaw === userRaw) return true;

    // Divisional Admin aliases
    if (userNorm === 'Divisional Admin' && allowedNorm === 'Divisional Admin') return true;

    return false;
  });
}
