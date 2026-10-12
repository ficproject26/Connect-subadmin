const { verifyToken, JWT_SECRET } = require('../utils/jwt');
const { db } = require('../config/db');

function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      const jwt = require('jsonwebtoken');
      const fallbackSecrets = [
        'super_secret_agent_manager_jwt_key_2026',
        'connect_secret_key_prod_2026'
      ];
      let verified = false;
      for (const secret of fallbackSecrets) {
        try {
          decoded = jwt.verify(token, secret);
          verified = true;
          break;
        } catch (innerErr) {}
      }
      if (!verified) {
        throw err;
      }
    }

    // Attach decoded user token payload to request (supporting nested payload from admin ConnectApp)
    const userPayload = decoded.user ? { ...decoded.user, ...decoded } : decoded;
    if (!userPayload.role && userPayload.adminRole) {
      userPayload.role = userPayload.adminRole;
    }
    if ((userPayload.role === 'admin' || userPayload.role === 'super-admin') && (userPayload.adminRole === 'super-admin' || !userPayload.adminRole)) {
      userPayload.role = 'Super Admin';
    }

    // Resolve live database record to ensure approval changes take immediate effect
    const userId = userPayload.id || userPayload._id;
    let dbUser = null;
    if (db.users) {
      dbUser = Array.from(db.users).find(u => String(u._id || u.id) === String(userId));
    }
    if (!dbUser && db.agents) {
      dbUser = Array.from(db.agents).find(a => String(a._id || a.id) === String(userId));
    }

    const effectiveUser = dbUser ? { ...userPayload, ...dbUser } : userPayload;
    const rawRole = String(effectiveUser.role || '').toLowerCase();
    const isManagerOrAgent = rawRole.includes('manager') || rawRole.includes('agent') ||
      ['state_manager', 'district_manager', 'division_manager', 'pincode_manager', 'state_agent', 'district_agent', 'division_agent', 'pincode_agent'].includes(effectiveUser.role) ||
      effectiveUser.registrationFeePaid !== undefined || Boolean(effectiveUser.territory);

    if (isManagerOrAgent) {
      const currentStatus = String(effectiveUser.status || 'pending').toLowerCase().trim();
      const adminApprovalStatus = String(effectiveUser.adminApprovalStatus || (currentStatus === 'active' || currentStatus === 'approved' ? 'approved' : currentStatus === 'rejected' ? 'rejected' : 'pending')).toLowerCase().trim();
      const kycStatus = String(effectiveUser.kycStatus || (currentStatus === 'active' || currentStatus === 'approved' ? 'verified' : currentStatus === 'rejected' ? 'rejected' : 'pending_verification')).toLowerCase().trim();

      const isFullyApproved = (currentStatus === 'active' || currentStatus === 'approved') &&
        adminApprovalStatus === 'approved' &&
        (kycStatus === 'verified' || kycStatus === 'approved') &&
        effectiveUser.isActive !== false;

      // If user is unapproved
      if (!isFullyApproved) {
        // Allow querying profile / registration status on auth routes
        const reqPath = (req.originalUrl || req.url || '').toLowerCase();
        if (reqPath.includes('/auth/me') || reqPath.includes('/auth/registration-status')) {
          req.user = { ...effectiveUser, requiresApproval: true };
          req.userId = userId;
          return next();
        }

        // Strictly block access to all protected dashboard, admin, and business endpoints
        return res.status(403).json({
          success: false,
          requiresApproval: true,
          status: effectiveUser.status || 'pending',
          message: 'Account registration approval is incomplete. Access to protected dashboard resources is restricted.'
        });
      }

      // If user is fully approved, they can access their role endpoints,
      // but cannot access Sub-Admin specific administrative routes
      const reqPath = (req.originalUrl || req.url || '').toLowerCase();
      const isAdminOnlyPath = reqPath.startsWith('/api/admin') ||
        reqPath.includes('/managers/requests') ||
        reqPath.includes('/operations/agents/requests') ||
        reqPath.includes('/kyc');
      if (isAdminOnlyPath) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Tokens issued to this role cannot access Sub-Admin administrative operations.'
        });
      }

      req.user = effectiveUser;
      req.userId = userId;
      return next();
    }

    // Strictly forbid non-admin roles (vendors, customers, etc.)
    if (rawRole.includes('vendor') || rawRole.includes('customer') || rawRole === 'member') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Tokens issued to this role cannot access the Sub-Admin Management system.'
      });
    }

    // Check account status if present on token payload
    const currentStatus = String(effectiveUser.status || '').toLowerCase().trim();
    if (currentStatus === 'suspended' || currentStatus === 'blocked' || currentStatus === 'revoked' || currentStatus === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Account status is ' + currentStatus + '. Access revoked.'
      });
    }

    req.user = effectiveUser;
    req.userId = userId;

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token', error: error.message });
  }
}

function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = verifyToken(token);
        const userPayload = decoded.user ? { ...decoded.user, ...decoded } : decoded;
        if (!userPayload.role && userPayload.adminRole) userPayload.role = userPayload.adminRole;
        if ((userPayload.role === 'admin' || userPayload.role === 'super-admin') && (userPayload.adminRole === 'super-admin' || !userPayload.adminRole)) {
          userPayload.role = 'Super Admin';
        }
        req.user = userPayload;
        req.userId = userPayload.id || userPayload._id;
      } catch (err) {
        const jwt = require('jsonwebtoken');
        const fallbackSecrets = [
          'super_secret_agent_manager_jwt_key_2026',
          'connect_secret_key_prod_2026'
        ];
        for (const secret of fallbackSecrets) {
          try {
            const decoded = jwt.verify(token, secret);
            const userPayload = decoded.user ? { ...decoded.user, ...decoded } : decoded;
            if (!userPayload.role && userPayload.adminRole) userPayload.role = userPayload.adminRole;
            if ((userPayload.role === 'admin' || userPayload.role === 'super-admin') && (userPayload.adminRole === 'super-admin' || !userPayload.adminRole)) {
              userPayload.role = 'Super Admin';
            }
            req.user = userPayload;
            req.userId = userPayload.id || userPayload._id;
            break;
          } catch (inner) {}
        }
      }
    }
  } catch (e) {}
  next();
}

authMiddleware.authMiddleware = authMiddleware;
authMiddleware.optionalAuth = optionalAuth;
authMiddleware.JWT_SECRET = JWT_SECRET;

module.exports = authMiddleware;
