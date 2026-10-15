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

  // Strictly deny non-admin roles (Managers, Agents, Vendors, Customers) access to any Sub-Admin dashboard
  return '/access-denied';
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

    // Manager role group match
    if ((allowedRaw === 'manager' || allowedRaw.includes('manager')) && userRaw.includes('manager')) return true;

    return false;
  });
}

/**
 * Strict Level-Specific Manager Approval Authority Check
 *
 * Rules:
 * | Manager request level | Authorized approver |
 * | State Manager         | State Admin only    |
 * | District Manager      | District Admin only |
 * | Division Manager      | Division Admin only |
 * | Pincode Manager       | Pincode Admin only  |
 *
 * Only the Admin responsible for the request's corresponding level
 * and authorized territory can approve, reject, or change pending status.
 */
export function canAdminApproveManagerRequest(adminUser, managerRow) {
  if (!adminUser || !managerRow) return false;
  if (managerRow.canApprove === false) return false;

  const adminRole = String(adminUser.role || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();
  // Only administrative accounts have approval authority; managers/agents/vendors/customers do not
  if (!adminRole.includes('admin') || adminRole.includes('manager') || adminRole.includes('agent')) {
    return false;
  }

  const isSuper = adminRole === 'super admin' || adminRole === 'main admin' || (adminRole === 'admin' && (!adminUser.state || adminUser.state === 'All India'));
  if (isSuper) return true;

  let rawMgrRole = String(managerRow.role || managerRow.level || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();
  const levelNumMap = { '1': 'state', '2': 'district', '3': 'division', '4': 'pincode' };
  if (levelNumMap[rawMgrRole]) rawMgrRole = levelNumMap[rawMgrRole];
  if (levelNumMap[String(managerRow.level || '').trim()]) rawMgrRole = levelNumMap[String(managerRow.level || '').trim()];

  // 1. State Manager -> State Admin only
  if (rawMgrRole.includes('state')) {
    if (!adminRole.includes('state')) return false;
    const aState = String(adminUser.state || adminUser.assignedState || '').trim().toLowerCase();
    const mState = String(managerRow.state || managerRow.assignedState || '').trim().toLowerCase();
    if (aState && mState && aState !== mState) return false;
    return managerRow.canApprove !== false;
  }

  // 2. District Manager -> District Admin only
  if (rawMgrRole.includes('district')) {
    if (!adminRole.includes('district')) return false;
    const aDist = String(adminUser.district || adminUser.assignedDistrict || '').trim().toLowerCase().replace(/\s+district$/, '');
    const mDist = String(managerRow.district || managerRow.assignedDistrict || '').trim().toLowerCase().replace(/\s+district$/, '');
    if (aDist && mDist && aDist !== mDist) return false;
    return managerRow.canApprove !== false;
  }

  // 3. Division Manager -> Division Admin only
  if (rawMgrRole.includes('division') || rawMgrRole.includes('divisional')) {
    if (!adminRole.includes('division') && !adminRole.includes('divisional')) return false;
    const aDiv = String(adminUser.division || adminUser.assignedDivision || '').trim().toLowerCase().replace(/\s+division$/, '');
    const mDiv = String(managerRow.division || managerRow.assignedDivision || '').trim().toLowerCase().replace(/\s+division$/, '');
    if (aDiv && mDiv && aDiv !== mDiv) return false;
    return managerRow.canApprove !== false;
  }

  // 4. Pincode Manager -> Pincode Admin only
  if (rawMgrRole.includes('pincode')) {
    if (!adminRole.includes('pincode')) return false;
    const aPin = String(adminUser.pincode || adminUser.assignedPincode || '').trim();
    const mPin = String(managerRow.pincode || managerRow.assignedPincode || '').trim();
    if (aPin && mPin && aPin !== mPin) return false;
    return managerRow.canApprove !== false;
  }

  return false;
}

/**
 * Strict Level-Specific Agent Approval Authority Check
 *
 * Rules:
 * | Agent request level | Authorized approver |
 * | State Agent         | State Admin only    |
 * | District Agent      | District Admin only |
 * | Division Agent      | Division Admin only |
 * | Pincode Agent       | Pincode Admin only  |
 *
 * Higher-level admins (e.g. State Admin viewing a Divisional Agent in their state)
 * have view-only monitoring privileges and cannot approve, reject, or keep pending.
 */
export function canAdminApproveAgentRequest(adminUser, agentRow) {
  if (!adminUser || !agentRow) return false;
  if (agentRow.canApprove === false) return false;

  const adminRole = String(adminUser.role || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();
  const adminUserRole = String(adminUser.adminRole || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();
  const adminLevel = String(adminUser.adminLevel || adminUser.level || '').toLowerCase().trim();

  // Non-administrative accounts cannot approve agents
  if (!adminRole.includes('admin') || adminRole.includes('manager') || adminRole.includes('agent')) {
    return false;
  }

  // Global Unscoped Super Admin can approve all
  const isSuper = (adminRole === 'super admin' || adminRole === 'main admin' || (adminRole === 'admin' && !adminUserRole.includes('state') && !adminUserRole.includes('district') && !adminUserRole.includes('division') && !adminUserRole.includes('pincode') && adminLevel !== 'state')) && (!adminUser.state || adminUser.state === 'All India');
  if (isSuper) return true;

  // Extract agent level
  let aLevel = '';
  const lvlRaw = agentRow.level;
  if (typeof lvlRaw === 'number') {
    if (lvlRaw === 1) aLevel = 'state';
    else if (lvlRaw === 2) aLevel = 'district';
    else if (lvlRaw === 3) aLevel = 'division';
    else if (lvlRaw === 4) aLevel = 'pincode';
  }
  if (!aLevel) {
    const rawRole = String(agentRow.role || agentRow.level || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();
    if (rawRole.includes('pincode') || rawRole.includes('pin')) aLevel = 'pincode';
    else if (rawRole.includes('divis')) aLevel = 'division';
    else if (rawRole.includes('district')) aLevel = 'district';
    else if (rawRole.includes('state')) aLevel = 'state';
    else aLevel = rawRole;
  }

  // Extract agent territory
  const t = agentRow.territory || {};
  const clean = (val) => String(val || '').trim().toLowerCase().replace(/\s+(district|division|state)$/, '').trim();
  const uState = clean(adminUser.state || adminUser.assignedState);
  const tState = clean(agentRow.state || t.state);
  const uDist = clean(adminUser.district || adminUser.assignedDistrict);
  const tDist = clean(agentRow.district || t.district);
  const uDiv = clean(adminUser.division || adminUser.assignedDivision);
  const tDiv = clean(agentRow.division || t.division);
  const uPin = String(adminUser.pincode || adminUser.assignedPincode || '').trim();
  const tPin = String(agentRow.pincode || t.pincode || '').trim();

  // 1. State Agent -> ONLY State Admin of the same state
  if (aLevel === 'state') {
    if (!adminRole.includes('state') && !(adminRole === 'admin' && uState)) return false;
    return Boolean(uState && tState && uState === tState);
  }

  // 2. District Agent -> ONLY District Admin of the same district
  if (aLevel === 'district') {
    if (!adminRole.includes('district')) return false;
    const matchState = !uState || uState === 'all india' || (tState && tState === uState);
    return Boolean(matchState && uDist && tDist && uDist === tDist);
  }

  // 3. Division Agent -> ONLY Division Admin of the same division
  if (aLevel === 'division' || aLevel === 'divisional') {
    if (!adminRole.includes('division') && !adminRole.includes('divisional')) return false;
    const matchState = !uState || uState === 'all india' || (tState && tState === uState);
    const matchDist = matchState && (!uDist || uDist === 'all districts' || (tDist && tDist === uDist));
    return Boolean(matchDist && uDiv && tDiv && uDiv === tDiv);
  }

  // 4. Pincode Agent -> ONLY Pincode Admin of the same pincode
  if (aLevel === 'pincode') {
    if (!adminRole.includes('pincode')) return false;
    const matchState = !uState || uState === 'all india' || (tState && tState === uState);
    const matchDist = matchState && (!uDist || uDist === 'all districts' || (tDist && tDist === uDist));
    const matchDiv = matchDist && (!uDiv || uDiv === 'all divisions' || (tDiv && tDiv === uDiv));
    return Boolean(matchDiv && uPin && tPin && uPin === tPin);
  }

  return false;
}

