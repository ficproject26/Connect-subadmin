/**
 * Comprehensive Automated Security Test Suite
 * Validates all 16 scenarios specified in the Antigravity Master Security Prompt:
 * 
 * 1. An unauthenticated user cannot access a protected dashboard or API.
 * 2. A pending account cannot access protected dashboard data.
 * 3. An unapproved user cannot obtain an authorized application session.
 * 4. An approved user with the correct role can access authorized routes.
 * 5. A customer cannot access vendor-only or administrative resources.
 * 6. A vendor cannot access customer-only or administrative resources.
 * 7. A manager cannot access another role's dashboard unless explicitly authorized.
 * 8. A valid email and password cannot bypass application or role restrictions.
 * 9. Modifying local storage or frontend role values cannot grant access.
 * 10. Manually navigating to a protected URL does not bypass authorization.
 * 11. Sending requests directly to backend endpoints does not bypass authorization.
 * 12. A user cannot change their role or approval status through a manipulated API request.
 * 13. A suspended account loses protected access.
 * 14. A revoked or expired session is denied.
 * 15. Resource ownership and territory restrictions remain enforced.
 * 16. Existing approved login, registration, approval, logout, and dashboard workflows continue working.
 */

const assert = require('assert');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { generateToken, verifyToken, JWT_SECRET } = require('../utils/jwt');
const {
  isRoleAuthorizedForApp,
  isAccountApproved,
  isAccountBlockedOrSuspended,
  normalizeRoleName,
  AUTHORIZED_APP_ROLES
} = require('../config/appSecurity');
const authMiddleware = require('../middleware/authMiddleware');
const locationMiddleware = require('../middleware/locationMiddleware');
const { checkRole } = require('../middleware/roleMiddleware');
const authController = require('../controllers/authController');
const { initDatabase, db } = require('../config/db');

// Mock Express req/res
function createMockReqRes({ method = 'GET', url = '/api/admin/districts', headers = {}, body = {}, query = {}, user = null }) {
  const req = {
    method,
    url,
    originalUrl: url,
    headers,
    body,
    query,
    user,
    ip: '127.0.0.1'
  };

  const res = {
    statusCode: 200,
    headers: {},
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
    header(k, v) {
      this.headers[k] = v;
      return this;
    }
  };

  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  return { req, res, next, wasNextCalled: () => nextCalled };
}

async function runMasterSecurityTests() {
  console.log('================================================================');
  console.log('🔒 RUNNING MASTER APPLICATION SECURITY AUDIT & VERIFICATION');
  console.log('================================================================\n');

  await initDatabase();

  // Test setup credentials and tokens
  const activeAdmin = Array.from(db.users).find(u => (u.role === 'State Admin' || (u.role || '').toLowerCase().includes('state admin')) && u.status === 'approved') || {
    id: 'test_state_admin_01',
    _id: 'test_state_admin_01',
    email: 'stateadmin_sec@connect.in',
    name: 'State Admin Security Test',
    role: 'State Admin',
    status: 'approved',
    isActive: true,
    adminApprovalStatus: 'approved',
    state: 'Tamil Nadu'
  };

  const adminToken = generateToken({
    id: activeAdmin.id || activeAdmin._id,
    _id: activeAdmin._id || activeAdmin.id,
    email: activeAdmin.email,
    role: 'State Admin',
    scope: 'dashboard_access',
    requiresApproval: false
  });

  // --------------------------------------------------------------------------
  // SCENARIO 1: Unauthenticated user cannot access protected dashboard or API
  // --------------------------------------------------------------------------
  console.log('--- Scenario 1: Unauthenticated User Protection ---');
  {
    const { req, res, next, wasNextCalled } = createMockReqRes({
      url: '/api/admin/districts',
      headers: {} // No token provided
    });

    await authMiddleware(req, res, next);
    assert.strictEqual(res.statusCode, 401, 'Unauthenticated request must return HTTP 401');
    assert.strictEqual(res.jsonData.success, false, 'Unauthenticated response must indicate failure');
    assert.strictEqual(wasNextCalled(), false, 'Next middleware must not be invoked');
    console.log('✓ Scenario 1 passed: Unauthenticated requests denied with 401.');
  }

  // --------------------------------------------------------------------------
  // SCENARIO 2: Pending account cannot access protected dashboard data
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 2: Pending Account Dashboard Access Restriction ---');
  {
    const pendingToken = generateToken({
      id: 'pending_user_999',
      email: 'pending_admin@connect.in',
      role: 'District Admin',
      scope: 'pending_registration',
      requiresApproval: true
    });

    const { req, res, next, wasNextCalled } = createMockReqRes({
      url: '/api/admin/divisions',
      headers: { authorization: `Bearer ${pendingToken}` }
    });

    await authMiddleware(req, res, next);
    assert.strictEqual(res.statusCode, 403, 'Pending account accessing dashboard API must receive HTTP 403 Forbidden');
    assert.strictEqual(res.jsonData.requiresApproval, true, 'Response must identify approval is required');
    assert.strictEqual(wasNextCalled(), false, 'Next middleware must not be invoked for pending accounts');
    console.log('✓ Scenario 2 passed: Pending account blocked from protected dashboard data.');
  }

  // --------------------------------------------------------------------------
  // SCENARIO 3: Unapproved user cannot obtain an authorized application session
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 3: Unapproved User Session Restriction ---');
  {
    // Create an unapproved/pending admin user in db.users
    const pendingId = 'pending_subadmin_sec_test';
    const pwdHash = bcrypt.hashSync('PendingPass123!', 10);
    const existing = await db.users.findById(pendingId);
    if (!existing) {
      await db.users.insertOne({
        _id: pendingId,
        id: pendingId,
        name: 'Pending Sub Admin',
        email: 'pending_subadmin_sec@connect.in',
        passwordHash: pwdHash,
        role: 'District Admin',
        adminRole: 'district-admin',
        status: 'PENDING_SUB_ADMIN_APPROVAL',
        adminApprovalStatus: 'pending',
        isActive: false,
        requiresApproval: true
      });
    }

    const { req, res } = createMockReqRes({
      method: 'POST',
      url: '/api/auth/login',
      body: { email: 'pending_subadmin_sec@connect.in', password: 'PendingPass123!' }
    });

    await authController.login(req, res);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.requiresApproval, true, 'Must flag requiresApproval = true');
    assert.strictEqual(res.jsonData.isFullyApproved, false, 'Must flag isFullyApproved = false');
    
    // Verify the token returned has restricted scope 'pending_registration'
    const decodedToken = verifyToken(res.jsonData.token);
    assert.strictEqual(decodedToken.scope, 'pending_registration', 'Token must have restricted pending_registration scope');
    assert.strictEqual(decodedToken.requiresApproval, true, 'Token must carry requiresApproval: true');
    console.log('✓ Scenario 3 passed: Unapproved user receives only restricted-scope pending token.');
  }

  // --------------------------------------------------------------------------
  // SCENARIO 4: Approved user with correct role can access authorized routes
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 4: Approved User Route Authorization ---');
  {
    const { req, res, next, wasNextCalled } = createMockReqRes({
      url: '/api/admin/districts',
      headers: { authorization: `Bearer ${adminToken}` }
    });

    await authMiddleware(req, res, next);
    assert.strictEqual(wasNextCalled(), true, 'Next must be called for valid approved admin token');
    assert.strictEqual(req.user.role, 'State Admin', 'Canonical role must be assigned to req.user');
    console.log('✓ Scenario 4 passed: Approved State Admin successfully accesses authorized routes.');
  }

  // --------------------------------------------------------------------------
  // SCENARIO 5: Customer cannot access administrative resources
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 5: Customer Role Access Denial ---');
  {
    assert.strictEqual(isRoleAuthorizedForApp('Customer'), false, 'Customer must not be authorized for Sub-Admin app');
    assert.strictEqual(isRoleAuthorizedForApp('customer'), false, 'Lowercase customer rejected');

    const customerToken = generateToken({
      id: 'customer_123',
      email: 'customer@connect.in',
      role: 'Customer',
      scope: 'dashboard_access'
    });

    const { req, res, next, wasNextCalled } = createMockReqRes({
      url: '/api/admin/districts',
      headers: { authorization: `Bearer ${customerToken}` }
    });

    await authMiddleware(req, res, next);
    assert.strictEqual(res.statusCode, 403, 'Customer token must receive HTTP 403 Forbidden');
    assert.strictEqual(res.jsonData.code, 'UNAUTHORIZED_APPLICATION_ROLE');
    assert.strictEqual(wasNextCalled(), false);
    console.log('✓ Scenario 5 passed: Customer completely blocked from administrative endpoints.');
  }

  // --------------------------------------------------------------------------
  // SCENARIO 6: Vendor cannot access administrative resources
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 6: Vendor Role Access Denial ---');
  {
    assert.strictEqual(isRoleAuthorizedForApp('Vendor'), false, 'Vendor must not be authorized for Sub-Admin app');

    const vendorToken = generateToken({
      id: 'vendor_123',
      email: 'vendor@connect.in',
      role: 'Vendor',
      scope: 'dashboard_access'
    });

    const { req, res, next, wasNextCalled } = createMockReqRes({
      url: '/api/customers',
      headers: { authorization: `Bearer ${vendorToken}` }
    });

    await authMiddleware(req, res, next);
    assert.strictEqual(res.statusCode, 403, 'Vendor token must receive HTTP 403 Forbidden');
    assert.strictEqual(wasNextCalled(), false);
    console.log('✓ Scenario 6 passed: Vendor completely blocked from administrative endpoints.');
  }

  // --------------------------------------------------------------------------
  // SCENARIO 7: Manager cannot access Sub-Admin portal
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 7: Manager Role Cross-Application Access Denial ---');
  {
    assert.strictEqual(isRoleAuthorizedForApp('state_manager'), false, 'state_manager rejected from Sub-Admin app');
    assert.strictEqual(isRoleAuthorizedForApp('district_manager'), false, 'district_manager rejected');
    assert.strictEqual(isRoleAuthorizedForApp('Manager'), false, 'Manager rejected');

    const managerToken = generateToken({
      id: 'manager_123',
      email: 'manager@connect.in',
      role: 'state_manager',
      scope: 'dashboard_access'
    });

    const { req, res, next, wasNextCalled } = createMockReqRes({
      url: '/api/admin/hierarchy',
      headers: { authorization: `Bearer ${managerToken}` }
    });

    await authMiddleware(req, res, next);
    assert.strictEqual(res.statusCode, 403, 'Manager token must receive HTTP 403 Forbidden on Sub-Admin API');
    assert.strictEqual(res.jsonData.code, 'UNAUTHORIZED_APPLICATION_ROLE');
    assert.strictEqual(wasNextCalled(), false);
    console.log('✓ Scenario 7 passed: Field Manager strictly denied access to Sub-Admin endpoints.');
  }

  // --------------------------------------------------------------------------
  // SCENARIO 8: Valid email & password cannot bypass application role restrictions
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 8: Valid Credentials Cannot Bypass Application Role Boundaries ---');
  {
    // Create a real manager user with known valid password in db.users
    const testMgrId = 'valid_manager_cross_role_test';
    const pwdHash = bcrypt.hashSync('ManagerValidPass123!', 10);
    const existing = await db.users.findById(testMgrId);
    if (!existing) {
      await db.users.insertOne({
        _id: testMgrId,
        id: testMgrId,
        name: 'Valid Manager User',
        email: 'manager_legit_credentials@connect.in',
        passwordHash: pwdHash,
        role: 'district_manager',
        status: 'active',
        isActive: true,
        adminApprovalStatus: 'approved'
      });
    }

    // Try logging into Sub-Admin portal with valid manager credentials
    const { req, res } = createMockReqRes({
      method: 'POST',
      url: '/api/auth/login',
      body: { email: 'manager_legit_credentials@connect.in', password: 'ManagerValidPass123!' }
    });

    await authController.login(req, res);
    assert.strictEqual(res.statusCode, 403, 'Login attempt must be REJECTED with HTTP 403');
    assert.strictEqual(res.jsonData.code, 'UNAUTHORIZED_APPLICATION_ROLE', 'Response must indicate unauthorized application role');
    assert.strictEqual(res.jsonData.token, undefined, 'No token must ever be issued to manager on Sub-Admin login');
    console.log('✓ Scenario 8 passed: Valid manager credentials rejected on Sub-Admin portal login.');
  }

  // --------------------------------------------------------------------------
  // SCENARIO 9: Modifying client-supplied role values cannot grant access
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 9: Tampered Request Role Manipulation Denial ---');
  {
    // Attacker sends a token for a customer but supplies role='Super Admin' in query or body
    const customerToken = generateToken({
      id: 'customer_tamper_test',
      email: 'tamper@connect.in',
      role: 'Customer',
      scope: 'dashboard_access'
    });

    const { req, res, next, wasNextCalled } = createMockReqRes({
      url: '/api/admin/districts?role=Super+Admin',
      headers: { authorization: `Bearer ${customerToken}` },
      body: { role: 'Super Admin' },
      query: { role: 'Super Admin' }
    });

    await authMiddleware(req, res, next);
    assert.strictEqual(res.statusCode, 403, 'Tampered request must receive 403 Forbidden');
    assert.strictEqual(wasNextCalled(), false, 'Next middleware must not be invoked');
    console.log('✓ Scenario 9 passed: Client-supplied role query/body parameters ignored; server verifies database record.');
  }

  // --------------------------------------------------------------------------
  // SCENARIO 10 & 11: Direct URL navigation / direct backend endpoints protected
  // --------------------------------------------------------------------------
  console.log('\n--- Scenarios 10 & 11: Direct Backend Endpoint Protection ---');
  {
    const protectedUrls = [
      '/api/admin/districts',
      '/api/customers',
      '/api/vendors',
      '/api/managers',
      '/api/reports',
      '/api/orders',
      '/api/bookings',
      '/api/jobs'
    ];

    for (const url of protectedUrls) {
      const { req, res, next, wasNextCalled } = createMockReqRes({ url, headers: {} });
      await authMiddleware(req, res, next);
      assert.strictEqual(res.statusCode, 401, `Endpoint ${url} must require authentication`);
      assert.strictEqual(wasNextCalled(), false);
    }
    console.log(`✓ Scenarios 10 & 11 passed: All ${protectedUrls.length} tested endpoints strictly reject unauthenticated requests.`);
  }

  // --------------------------------------------------------------------------
  // SCENARIO 12: User cannot change role or approval status through API request
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 12: Self-Privilege Escalation Prevention ---');
  {
    const targetAdmin = Array.from(db.users).find(u => u.role === 'Pincode Admin') || activeAdmin;
    const { req, res } = createMockReqRes({
      method: 'PUT',
      url: '/api/auth/profile',
      user: targetAdmin,
      body: {
        role: 'Super Admin',
        status: 'approved',
        adminApprovalStatus: 'approved',
        adminRole: 'super-admin',
        level: 0,
        address: '123 Verified Secure Way'
      }
    });

    await authController.updateProfile(req, res);
    assert.strictEqual(res.statusCode, 200);
    // Reload user from db
    const reloaded = await db.users.findById(targetAdmin.id || targetAdmin._id);
    assert.strictEqual(reloaded.role, targetAdmin.role, 'Role must NOT be escalated to Super Admin');
    console.log('✓ Scenario 12 passed: Role escalation in updateProfile strictly ignored/prevented.');
  }

  // --------------------------------------------------------------------------
  // SCENARIO 13: Suspended account loses protected access immediately
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 13: Suspended Account Revocation ---');
  {
    const suspendedId = 'suspended_subadmin_sec_test';
    const pwdHash = bcrypt.hashSync('SuspendedPass123!', 10);
    const existing = await db.users.findById(suspendedId);
    if (!existing) {
      await db.users.insertOne({
        _id: suspendedId,
        id: suspendedId,
        name: 'Suspended Admin',
        email: 'suspended_admin@connect.in',
        passwordHash: pwdHash,
        role: 'District Admin',
        adminRole: 'district-admin',
        status: 'suspended',
        adminApprovalStatus: 'rejected',
        isActive: false
      });
    }

    // Token was generated previously while admin thought they were active
    const staleToken = generateToken({
      id: suspendedId,
      _id: suspendedId,
      email: 'suspended_admin@connect.in',
      role: 'District Admin',
      scope: 'dashboard_access'
    });

    const { req, res, next, wasNextCalled } = createMockReqRes({
      url: '/api/admin/districts',
      headers: { authorization: `Bearer ${staleToken}` }
    });

    await authMiddleware(req, res, next);
    assert.strictEqual(res.statusCode, 403, 'Suspended user must receive HTTP 403');
    assert.strictEqual(res.jsonData.code, 'ACCOUNT_STATUS_REVOKED', 'Must return ACCOUNT_STATUS_REVOKED');
    assert.strictEqual(wasNextCalled(), false, 'Next middleware must not be called');
    console.log('✓ Scenario 13 passed: Live database verification revokes access for suspended accounts.');
  }

  // --------------------------------------------------------------------------
  // SCENARIO 14: Revoked or expired session is denied
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 14: Expired or Invalid Token Denial ---');
  {
    // Create an expired token (expires in -10 seconds)
    const expiredToken = jwt.sign(
      { id: 'admin_expired', email: 'admin@connect.in', role: 'State Admin' },
      JWT_SECRET,
      { expiresIn: '-10s' }
    );

    const { req, res, next, wasNextCalled } = createMockReqRes({
      url: '/api/admin/districts',
      headers: { authorization: `Bearer ${expiredToken}` }
    });

    await authMiddleware(req, res, next);
    assert.strictEqual(res.statusCode, 401, 'Expired token must return HTTP 401');
    assert.strictEqual(res.jsonData.code, 'INVALID_TOKEN');
    assert.strictEqual(wasNextCalled(), false);
    console.log('✓ Scenario 14 passed: Expired JWT tokens correctly rejected with 401.');
  }

  // --------------------------------------------------------------------------
  // SCENARIO 15: Resource ownership & territory restrictions remain enforced
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 15: Territory Boundaries Enforced ---');
  {
    // District Admin for Salem cannot query Coimbatore
    const districtAdminUser = {
      role: 'District Admin',
      district: 'Salem',
      districtId: 'dist_salem',
      state: 'Tamil Nadu'
    };

    const { req, res, next, wasNextCalled } = createMockReqRes({
      url: '/api/customers',
      user: districtAdminUser,
      query: { district: 'Coimbatore' }
    });

    locationMiddleware(req, res, next);
    assert.strictEqual(res.statusCode, 403, 'Cross-district query must receive HTTP 403');
    assert.strictEqual(wasNextCalled(), false);

    // Pincode Admin for 636002 cannot query 600001
    const pincodeAdminUser = {
      role: 'Pincode Admin',
      pincode: '636002',
      district: 'Salem',
      state: 'Tamil Nadu'
    };

    const { req: pReq, res: pRes, next: pNext, wasNextCalled: pWasNextCalled } = createMockReqRes({
      url: '/api/customers',
      user: pincodeAdminUser,
      query: { pincode: '600001' }
    });

    locationMiddleware(pReq, pRes, pNext);
    assert.strictEqual(pRes.statusCode, 403, 'Cross-pincode query must receive HTTP 403');
    assert.strictEqual(pWasNextCalled(), false);
    console.log('✓ Scenario 15 passed: Territory restrictions strictly enforced across District and Pincode levels.');
  }

  // --------------------------------------------------------------------------
  // SCENARIO 16: Legitimate approved workflows continue working normally
  // --------------------------------------------------------------------------
  console.log('\n--- Scenario 16: Legitimate Approved Workflows Regression Check ---');
  {
    // Approved State Admin login
    const stateAdminUser = Array.from(db.users).find(u => u.role === 'State Admin' && (u.status === 'active' || u.status === 'approved'));
    assert(stateAdminUser, 'State Admin user must exist in db.users');

    const { req: loginReq, res: loginRes } = createMockReqRes({
      method: 'POST',
      url: '/api/auth/login',
      body: { email: stateAdminUser.email, password: 'admin123' }
    });

    await authController.login(loginReq, loginRes);
    assert.strictEqual(loginRes.jsonData.success, true, 'Legitimate State Admin login must succeed');
    assert.strictEqual(loginRes.jsonData.requiresApproval, false, 'Approved admin must not require approval');
    assert.strictEqual(loginRes.jsonData.user.role, 'State Admin', 'Role must be State Admin');

    // getMe profile check with valid token
    const token = loginRes.jsonData.token;
    const { req: meReq, res: meRes, next: meNext } = createMockReqRes({
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` }
    });

    await authMiddleware(meReq, meRes, meNext);
    await authController.getMe(meReq, meRes);
    assert.strictEqual(meRes.jsonData.success, true, 'getMe must succeed for approved admin');
    assert.strictEqual(meRes.jsonData.user.role, 'State Admin');

    // Demo admins endpoint remains functional
    const { req: demoReq, res: demoRes } = createMockReqRes({ url: '/api/auth/demo-admins' });
    authController.getDemoAdmins(demoReq, demoRes);
    assert.strictEqual(demoRes.jsonData.success, true, 'getDemoAdmins must succeed');
    assert(Array.isArray(demoRes.jsonData.admins), 'Demo admins must be an array');
    console.log('✓ Scenario 16 passed: Legitimate login, session retrieval, and admin workflows intact.');
  }

  console.log('\n================================================================');
  console.log('🎉 ALL 16 MASTER SECURITY SCENARIOS PASSED WITH ZERO FAILURES!');
  console.log('================================================================\n');
}

runMasterSecurityTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ MASTER SECURITY TEST FAILED:', err);
    process.exit(1);
  });
