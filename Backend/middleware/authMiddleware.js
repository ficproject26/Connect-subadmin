const { verifyToken, JWT_SECRET } = require('../utils/jwt');
const { db } = require('../config/db');
const { getMongoDb } = require('../config/mongo');
const {
  isRoleAuthorizedForApp,
  isAccountApproved,
  isAccountBlockedOrSuspended,
  normalizeRoleName
} = require('../config/appSecurity');

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, code: 'UNAUTHENTICATED', message: 'Authentication required. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return res.status(401).json({ success: false, code: 'INVALID_TOKEN', message: 'Invalid or expired token', error: err.message });
    }

    // Attach decoded user token payload to request (supporting nested payload)
    const userPayload = decoded.user ? { ...decoded.user, ...decoded } : decoded;
    if (!userPayload.role && userPayload.adminRole) {
      userPayload.role = userPayload.adminRole;
    }
    if ((userPayload.role === 'admin' || userPayload.role === 'super-admin') && (userPayload.adminRole === 'super-admin' || !userPayload.adminRole)) {
      userPayload.role = 'Super Admin';
    }

    const reqPath = (req.originalUrl || req.url || '').toLowerCase();
    const isStatusCheckPath = reqPath.includes('/auth/me') || reqPath.includes('/auth/registration-status');

    // 1. Check if token itself was issued with restricted pending scope
    if (decoded.scope === 'pending_registration' || userPayload.requiresApproval === true) {
      if (isStatusCheckPath) {
        req.user = { ...userPayload, requiresApproval: true, isFullyApproved: false };
        req.userId = userPayload.id || userPayload._id;
        return next();
      }
      return res.status(403).json({
        success: false,
        code: 'APPROVAL_REQUIRED',
        requiresApproval: true,
        isFullyApproved: false,
        message: 'Account registration approval is incomplete. Access to protected dashboard resources is restricted.'
      });
    }

    // 2. Resolve authoritative live database record to ensure approval changes and status changes take immediate effect
    const userId = userPayload.id || userPayload._id;
    let dbUser = null;

    // Check MongoDB Atlas users collection first
    try {
      const mdb = await getMongoDb();
      if (mdb && userId) {
        const { ObjectId } = require('mongodb');
        try {
          if (typeof userId === 'string' && ObjectId.isValid(userId)) {
            dbUser = await mdb.collection('users').findOne({ _id: new ObjectId(userId) });
          }
        } catch (e) {}
        if (!dbUser) {
          dbUser = await mdb.collection('users').findOne({
            $or: [{ _id: String(userId) }, { id: String(userId) }, { email: userPayload.email }]
          });
        }
      }
    } catch (mErr) {
      console.warn('MongoDB live status check warning in authMiddleware:', mErr.message);
    }

    // Fallback to local db.users
    if (!dbUser && db.users) {
      dbUser = Array.from(db.users).find(u => String(u._id || u.id) === String(userId) || (u.email && u.email.toLowerCase() === (userPayload.email || '').toLowerCase()));
    }

    const effectiveUser = dbUser ? { ...userPayload, ...dbUser } : userPayload;

    // Preserve specialized administrative roles from token/adminRole when dbUser.role is generic 'admin'
    if (userPayload.role && userPayload.role !== 'admin' && effectiveUser.role === 'admin') {
      effectiveUser.role = userPayload.role;
    }
    if (effectiveUser.adminRole && (!effectiveUser.role || effectiveUser.role === 'admin')) {
      const ar = String(effectiveUser.adminRole).toLowerCase().replace(/[_-]/g, ' ').trim();
      if (ar.includes('state') || ar === 'state admin' || ar === 'state-admin') effectiveUser.role = 'State Admin';
      else if (ar.includes('dist') || ar === 'district admin' || ar === 'district-admin') effectiveUser.role = 'District Admin';
      else if (ar.includes('divis') || ar === 'division admin' || ar === 'division-admin') effectiveUser.role = 'Divisional Admin';
      else if (ar.includes('pin') || ar === 'pincode admin' || ar === 'pincode-admin') effectiveUser.role = 'Pincode Admin';
    }

    // Synchronize territory fields between assigned* and primary coordinates
    if (!effectiveUser.state && effectiveUser.assignedState) effectiveUser.state = effectiveUser.assignedState;
    if (!effectiveUser.assignedState && effectiveUser.state) effectiveUser.assignedState = effectiveUser.state;
    if (!effectiveUser.district && effectiveUser.assignedDistrict) effectiveUser.district = effectiveUser.assignedDistrict;
    if (!effectiveUser.assignedDistrict && effectiveUser.district) effectiveUser.assignedDistrict = effectiveUser.district;
    if (!effectiveUser.division && effectiveUser.assignedDivision) effectiveUser.division = effectiveUser.assignedDivision;
    if (!effectiveUser.assignedDivision && effectiveUser.division) effectiveUser.assignedDivision = effectiveUser.division;
    if (!effectiveUser.pincode && effectiveUser.assignedPincode) effectiveUser.pincode = effectiveUser.assignedPincode;
    if (!effectiveUser.assignedPincode && effectiveUser.pincode) effectiveUser.assignedPincode = effectiveUser.pincode;

    // 3. Strict Account Status Check (Suspended, Blocked, Revoked, Inactive, Rejected, Deleted)
    if (isAccountBlockedOrSuspended(effectiveUser)) {
      const currentStatus = String(effectiveUser.status || 'inactive').toLowerCase();
      if (currentStatus === 'suspended') {
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_SUSPENDED',
          message: 'Your account has been suspended. Please contact your administrator for assistance.'
        });
      }
      if (currentStatus === 'deleted' || currentStatus === 'deactivated' || effectiveUser.isDeleted === true) {
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_DEACTIVATED',
          message: 'Your account has been deactivated and access is no longer available. Please contact your administrator if you believe this is an error.'
        });
      }
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_STATUS_REVOKED',
        message: `Forbidden: Account status is '${currentStatus}'. Protected access revoked.`
      });
    }

    // 4. Strict Role Isolation for Current Application
    if (!isRoleAuthorizedForApp(effectiveUser)) {
      return res.status(403).json({
        success: false,
        code: 'UNAUTHORIZED_APPLICATION_ROLE',
        message: `Forbidden: Accounts with role '${effectiveUser.role || 'Unknown'}' are not authorized to access the Sub-Admin Management system.`
      });
    }

    // 5. Strict Approval Status Check
    const approved = isAccountApproved(effectiveUser);
    if (!approved) {
      if (isStatusCheckPath) {
        req.user = { ...effectiveUser, requiresApproval: true, isFullyApproved: false };
        req.userId = userId;
        return next();
      }
      return res.status(403).json({
        success: false,
        code: 'APPROVAL_REQUIRED',
        requiresApproval: true,
        isFullyApproved: false,
        status: effectiveUser.status || 'PENDING_SUB_ADMIN_APPROVAL',
        adminApprovalStatus: effectiveUser.adminApprovalStatus || 'pending',
        kycStatus: effectiveUser.kycStatus || 'pending_verification',
        message: 'Account registration approval is incomplete. Access to protected dashboard resources is restricted.'
      });
    }

    // Normalize canonical role title on authenticated user, preserving territory level
    effectiveUser.role = normalizeRoleName(effectiveUser.role, effectiveUser);
    req.user = effectiveUser;
    req.userId = userId;

    next();
  } catch (error) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Invalid or expired token', error: error.message });
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
        if (!userPayload.state && userPayload.assignedState) userPayload.state = userPayload.assignedState;
        if (!userPayload.assignedState && userPayload.state) userPayload.assignedState = userPayload.state;
        if (!userPayload.district && userPayload.assignedDistrict) userPayload.district = userPayload.assignedDistrict;
        if (!userPayload.division && userPayload.assignedDivision) userPayload.division = userPayload.assignedDivision;
        if (!userPayload.pincode && userPayload.assignedPincode) userPayload.pincode = userPayload.assignedPincode;
        userPayload.role = normalizeRoleName(userPayload.role, userPayload);
        req.user = userPayload;
        req.userId = userPayload.id || userPayload._id;
      } catch (err) {}
    }
  } catch (e) {}
  next();
}

authMiddleware.authMiddleware = authMiddleware;
authMiddleware.optionalAuth = optionalAuth;
authMiddleware.JWT_SECRET = JWT_SECRET;

module.exports = authMiddleware;
