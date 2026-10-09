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

    // Strictly forbid non-admin roles from accessing the Sub-Admin portal
    const rawRole = String(userPayload.role || '').toLowerCase();
    if (rawRole.includes('manager') || rawRole.includes('agent') || rawRole.includes('vendor') || rawRole.includes('customer') || rawRole === 'member') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Tokens issued to this role cannot access the Sub-Admin Management system.'
      });
    }

    // Check account status if present on token payload
    const currentStatus = String(userPayload.status || '').toLowerCase().trim();
    if (currentStatus === 'suspended' || currentStatus === 'blocked' || currentStatus === 'revoked' || currentStatus === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Account status is ' + currentStatus + '. Access revoked.'
      });
    }

    req.user = userPayload;
    req.userId = userPayload.id || userPayload._id;

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
