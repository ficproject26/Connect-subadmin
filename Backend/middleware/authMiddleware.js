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
      // Also try fallback manager secret in case an old token from Manager is presented
      const jwt = require('jsonwebtoken');
      try {
        decoded = jwt.verify(token, 'super_secret_agent_manager_jwt_key_2026');
      } catch (innerErr) {
        throw err;
      }
    }

    // Attach decoded user token payload to request
    req.user = decoded;
    req.userId = decoded.id || decoded._id;

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
        req.user = decoded;
        req.userId = decoded.id || decoded._id;
      } catch (err) {
        const jwt = require('jsonwebtoken');
        try {
          const decoded = jwt.verify(token, 'super_secret_agent_manager_jwt_key_2026');
          req.user = decoded;
          req.userId = decoded.id || decoded._id;
        } catch (inner) {}
      }
    }
  } catch (e) {}
  next();
}

authMiddleware.authMiddleware = authMiddleware;
authMiddleware.optionalAuth = optionalAuth;
authMiddleware.JWT_SECRET = JWT_SECRET;

module.exports = authMiddleware;
