const ALLOWED_MANAGER_ROLES = [
  'state_manager',
  'district_manager',
  'division_manager',
  'pincode_manager',
  'Manager'
];

const ALLOWED_ADMIN_ROLES = [
  'State Admin',
  'District Admin',
  'Divisional Admin',
  'Division Admin',
  'Pincode Admin',
  'Super Admin'
];

const normalizeRoleName = (role) => {
  if (!role) return '';
  const r = role.toLowerCase().replace(/_/g, ' ').trim();
  if (r === 'division admin' || r === 'divisional admin') return 'divisional admin';
  if (r.includes('manager') && !r.includes('admin')) return 'manager';
  return r;
};

const checkRole = (allowedRoles = [...ALLOWED_MANAGER_ROLES, ...ALLOWED_ADMIN_ROLES]) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ success: false, message: 'Unauthorized: User role not established.' });
    }

    const userNormalized = normalizeRoleName(req.user.role);
    const rawUserRole = req.user.role.toLowerCase().replace(/_/g, ' ').trim();

    const isAllowed = allowedRoles.some(role => {
      const allowedNormalized = normalizeRoleName(role);
      const rawAllowed = role.toLowerCase().replace(/_/g, ' ').trim();
      return allowedNormalized === userNormalized || rawAllowed === rawUserRole || req.user.role === role;
    });

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Role '${req.user.role}' is not authorized for this action.`
      });
    }

    next();
  };
};

const blockManagersFromAdminEndpoints = (req, res, next) => {
  const role = (req.user?.role || '').toLowerCase();
  if (role.includes('manager') && !role.includes('admin')) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Admin operations are out of scope for field managers.'
    });
  }
  next();
};

module.exports = {
  ALLOWED_MANAGER_ROLES,
  ALLOWED_ADMIN_ROLES,
  normalizeRoleName,
  checkRole,
  requireRole: checkRole,
  blockManagersFromAdminEndpoints
};
