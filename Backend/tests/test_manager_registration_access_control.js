/**
 * Comprehensive Verification Suite for Manager Registration Approval Workflow & Dashboard Access Control
 * Tests all 12 scenarios specified in the requirements prompt:
 * 1. Newly registered Manager attempts to log in before Sub-admin approval -> dashboard access denied.
 * 2. Manager attempts direct dashboard URL access while pending -> access denied.
 * 3. Manager attempts to call protected dashboard APIs while pending -> backend returns 403 Forbidden.
 * 4. Sub-admin approves, but KYC is still pending -> dashboard access remains denied (status PENDING_KYC_APPROVAL).
 * 5. Sub-admin rejects the registration -> dashboard access denied (status rejected).
 * 6. KYC rejects the documents -> dashboard access denied (status rejected).
 * 7. Sub-admin approval and KYC approval are both completed -> dashboard access granted.
 * 8. An already approved Manager logs in -> existing authorized access continues to work.
 * 9. Test State, District, Division, and Pincode Managers independently.
 * 10. Verify that pending Managers cannot access protected data using an old token or an existing session.
 * 11. Verify that refreshing the page or opening a dashboard URL directly does not bypass approval.
 * 12. Verify that the correct territory-based Sub-admin receives each registration request (State, District, Division, Pincode).
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const assert = require('assert');
const bcrypt = require('bcryptjs');
const http = require('http');
const app = require('../server');
const { db, initDatabase } = require('../config/db');
const { generateToken } = require('../utils/jwt');
const { getRegistrationState } = require('../utils/registrationStatusHelper');

let testServer;
let baseUrl;

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

(async () => {
  console.log('========================================================================');
  console.log('🚀 E2E Test Suite: Manager Registration Approval Workflow & Access Control');
  console.log('========================================================================');

  try {
    await initDatabase();
  } catch (err) {
    console.warn('Database note:', err.message);
  }

  testServer = http.createServer(app);
  await new Promise((resolve, reject) => {
    testServer.once('error', reject);
    testServer.listen(0, '127.0.0.1', () => {
      const port = testServer.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`📡 Test server running on ${baseUrl}`);
      resolve();
    });
  });

  let passed = 0;
  let failed = 0;

  async function runScenario(scenarioNum, title, fn) {
    try {
      console.log(`\n[SCENARIO ${scenarioNum}] ${title}`);
      await fn();
      console.log(`  ✅ Passed Scenario ${scenarioNum}: ${title}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAILED Scenario ${scenarioNum}: ${title}`);
      console.error(`     Error details: ${err.message}`);
      if (err.stack) console.error(err.stack);
      failed++;
    }
  }

  // Setup territory Sub-Admins in db.users
  const passwordHash = await bcrypt.hash('admin123', 10);
  const stateAdminUser = {
    _id: 'E2E-STATE-ADMIN-TN',
    id: 'E2E-STATE-ADMIN-TN',
    name: 'Tamil Nadu State Admin',
    email: 'e2e_stateadmin_tn@connect.com',
    password: passwordHash,
    role: 'State Admin',
    adminLevel: 'state',
    state: 'Tamil Nadu',
    status: 'active',
    isActive: true
  };
  const districtAdminSalem = {
    _id: 'E2E-DIST-ADMIN-SALEM',
    id: 'E2E-DIST-ADMIN-SALEM',
    name: 'Salem District Admin',
    email: 'e2e_distadmin_salem@connect.com',
    password: passwordHash,
    role: 'District Admin',
    adminLevel: 'district',
    state: 'Tamil Nadu',
    district: 'Salem',
    districtId: 'dist_salem',
    status: 'active',
    isActive: true
  };
  const divisionalAdminSalemNorth = {
    _id: 'E2E-DIV-ADMIN-SALEM-N',
    id: 'E2E-DIV-ADMIN-SALEM-N',
    name: 'Salem North Divisional Admin',
    email: 'e2e_divadmin_salem_n@connect.com',
    password: passwordHash,
    role: 'Divisional Admin',
    adminLevel: 'division',
    state: 'Tamil Nadu',
    district: 'Salem',
    districtId: 'dist_salem',
    division: 'Salem North',
    divisionId: 'div_dist_salem_urban',
    status: 'active',
    isActive: true
  };
  const pincodeAdminSalem636001 = {
    _id: 'E2E-PIN-ADMIN-636001',
    id: 'E2E-PIN-ADMIN-636001',
    name: 'Salem PIN 636001 Admin',
    email: 'e2e_pinadmin_636001@connect.com',
    password: passwordHash,
    role: 'Pincode Admin',
    adminLevel: 'pincode',
    state: 'Tamil Nadu',
    district: 'Salem',
    districtId: 'dist_salem',
    division: 'Salem North',
    pincode: '636001',
    pincodeId: 'pin_636001',
    status: 'active',
    isActive: true
  };
  const kycTeamUser = {
    _id: 'E2E-KYC-ADMIN',
    id: 'E2E-KYC-ADMIN',
    name: 'KYC Operations Officer',
    email: 'e2e_kyc_officer@connect.com',
    password: passwordHash,
    role: 'KYC Team',
    adminLevel: 'kyc',
    state: 'All India',
    status: 'active',
    isActive: true
  };

  db.users.push(stateAdminUser, districtAdminSalem, divisionalAdminSalemNorth, pincodeAdminSalem636001, kycTeamUser);

  const stateAdminToken = generateToken(stateAdminUser);
  const districtAdminSalemToken = generateToken(districtAdminSalem);
  const divisionalAdminToken = generateToken(divisionalAdminSalemNorth);
  const pincodeAdminToken = generateToken(pincodeAdminSalem636001);
  const kycTeamToken = generateToken(kycTeamUser);

  const testRunId = Date.now();

  // SCENARIO 1: Newly registered Manager attempts to log in before Sub-admin approval -> dashboard access denied
  let regManager1 = null;
  let regManager1Token = null;
  await runScenario(1, 'Newly registered Manager attempts to log in before Sub-admin approval -> dashboard access denied', async () => {
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Kavitha State Manager',
        email: `kavitha_${testRunId}@connect.com`,
        phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        password: 'password123',
        role: 'state_manager',
        state: 'Tamil Nadu'
      }
    });

    assert.strictEqual(regRes.status, 201, `Expected 201 registration: ${JSON.stringify(regRes.data)}`);
    assert.strictEqual(regRes.data.success, true);
    assert.strictEqual(regRes.data.status, 'PENDING_SUB_ADMIN_APPROVAL');
    assert.strictEqual(regRes.data.requiresApproval, true);
    assert.strictEqual(regRes.data.isFullyApproved, false);
    assert.strictEqual(regRes.data.user.status, 'PENDING_SUB_ADMIN_APPROVAL');
    assert.strictEqual(regRes.data.user.adminApprovalStatus, 'pending');

    regManager1 = regRes.data.user;

    // Attempt login before Sub-admin approval
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: {
        email: `kavitha_${testRunId}@connect.com`,
        password: 'password123'
      }
    });

    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginRes.data.requiresApproval, true, 'Login must flag requiresApproval');
    assert.strictEqual(loginRes.data.isFullyApproved, false, 'isFullyApproved must be false');
    assert.strictEqual(loginRes.data.status, 'PENDING_SUB_ADMIN_APPROVAL');
    assert(loginRes.data.token, 'Status token returned for status checking only');
    regManager1Token = loginRes.data.token;
  });

  // SCENARIO 2: Manager attempts direct dashboard URL access while pending -> access denied
  await runScenario(2, 'Manager attempts direct dashboard URL access while pending -> access denied', async () => {
    // When visiting dashboard URL directly, the client queries /api/auth/me with their token.
    const meRes = await request('/api/auth/me', { token: regManager1Token });
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.data.requiresApproval, true);
    assert.strictEqual(meRes.data.isFullyApproved, false);
    assert.strictEqual(meRes.data.user.status, 'PENDING_SUB_ADMIN_APPROVAL');
    assert.strictEqual(meRes.data.user.adminApprovalStatus, 'pending');

    // UI state helper verifies state is State 1 (Awaiting Sub-admin Approval)
    const stateInfo = getRegistrationState(meRes.data.user);
    assert.strictEqual(stateInfo.stateNumber, 1, 'Applicant must be in State 1 (Awaiting Sub-admin Approval)');
    assert.strictEqual(stateInfo.stateKey, 'pending_admin');
  });

  // SCENARIO 3: Manager attempts to call protected dashboard APIs while pending -> backend returns 403 Forbidden
  await runScenario(3, 'Manager attempts to call protected dashboard APIs while pending -> backend returns 403 Forbidden', async () => {
    const protectedEndpoints = [
      '/api/managers',
      '/api/orders',
      '/api/customers',
      '/api/reports/analytics',
      '/api/reports'
    ];

    for (const ep of protectedEndpoints) {
      const res = await request(ep, { token: regManager1Token });
      assert.strictEqual(res.status, 403, `Endpoint ${ep} MUST reject pending manager with 403 Forbidden, got ${res.status}`);
      assert.strictEqual(res.data.requiresApproval, true);
    }
  });

  // SCENARIO 4: Sub-admin approves, but KYC is still pending -> dashboard access remains denied (status PENDING_KYC_APPROVAL)
  await runScenario(4, 'Sub-admin approves, but KYC is still pending -> dashboard access remains denied (status PENDING_KYC_APPROVAL)', async () => {
    const mgrId = regManager1._id || regManager1.id;
    const approveRes = await request(`/api/managers/${mgrId}/approve`, {
      method: 'POST',
      token: stateAdminToken
    });

    assert.strictEqual(approveRes.status, 200, `Approval failed: ${JSON.stringify(approveRes.data)}`);
    assert.strictEqual(approveRes.data.manager.status, 'PENDING_KYC_APPROVAL');
    assert.strictEqual(approveRes.data.manager.adminApprovalStatus, 'approved');

    // Live DB revalidation via /api/auth/me
    const meRes = await request('/api/auth/me', { token: regManager1Token });
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.data.requiresApproval, true, 'Account still requires KYC approval');
    assert.strictEqual(meRes.data.isFullyApproved, false);
    assert.strictEqual(meRes.data.user.status, 'PENDING_KYC_APPROVAL');
    assert.strictEqual(meRes.data.user.adminApprovalStatus, 'approved');
    assert.strictEqual(meRes.data.user.kycStatus, 'pending_verification');

    // UI state helper verifies state is State 2 (Awaiting KYC Verification)
    const stateInfo = getRegistrationState(meRes.data.user);
    assert.strictEqual(stateInfo.stateNumber, 2, 'Applicant must be in State 2 (Awaiting KYC Verification)');
    assert.strictEqual(stateInfo.stateKey, 'awaiting_kyc');

    // Protected dashboard API call must STILL return 403 Forbidden
    const blockedCall = await request('/api/managers', { token: regManager1Token });
    assert.strictEqual(blockedCall.status, 403, 'Manager with Sub-admin approval but pending KYC must still be blocked 403');
  });

  // SCENARIO 5: Sub-admin rejects the registration -> dashboard access denied
  await runScenario(5, 'Sub-admin rejects the registration -> dashboard access denied', async () => {
    // Register a manager to test Sub-admin rejection
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Ravi Reject Manager',
        email: `ravi_${testRunId}@connect.com`,
        phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        password: 'password123',
        role: 'district_manager',
        state: 'Tamil Nadu',
        district: 'Salem'
      }
    });

    const mgrId = regRes.data.user._id || regRes.data.user.id;
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: { email: `ravi_${testRunId}@connect.com`, password: 'password123' }
    });
    const mgrToken = loginRes.data.token;

    // Sub-admin rejects with reason
    const rejectRes = await request(`/api/managers/${mgrId}/reject`, {
      method: 'POST',
      token: districtAdminSalemToken,
      body: { reason: 'Jurisdiction operational capacity full for Salem district' }
    });

    assert.strictEqual(rejectRes.status, 200);
    assert.strictEqual(rejectRes.data.manager.status, 'rejected');

    // Check /api/auth/me
    const meRes = await request('/api/auth/me', { token: mgrToken });
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.data.isFullyApproved, false);
    assert.strictEqual(meRes.data.user.status, 'rejected');
    assert.strictEqual(meRes.data.user.rejectionReason, 'Jurisdiction operational capacity full for Salem district');

    // Calling protected API is denied
    const blockedRes = await request('/api/managers', { token: mgrToken });
    assert.strictEqual(blockedRes.status, 403);
  });

  // SCENARIO 6: KYC rejects the documents -> dashboard access denied
  await runScenario(6, 'KYC rejects the documents -> dashboard access denied', async () => {
    // Register manager, Sub-admin approves
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Suresh KYC Reject Manager',
        email: `suresh_${testRunId}@connect.com`,
        phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        password: 'password123',
        role: 'district_manager',
        state: 'Tamil Nadu',
        district: 'Salem'
      }
    });
    const mgrId = regRes.data.user._id || regRes.data.user.id;
    await request(`/api/managers/${mgrId}/approve`, { method: 'POST', token: districtAdminSalemToken });

    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: { email: `suresh_${testRunId}@connect.com`, password: 'password123' }
    });
    const mgrToken = loginRes.data.token;

    // KYC team rejects
    const kycRejectRes = await request(`/api/kyc/KYC-MGR-${mgrId}/process`, {
      method: 'PATCH',
      token: kycTeamToken,
      body: { action: 'reject', reason: 'Aadhaar document copy is blurry and unreadable' }
    });

    assert.strictEqual(kycRejectRes.status, 200);

    // Check status on me
    const meRes = await request('/api/auth/me', { token: mgrToken });
    assert.strictEqual(meRes.data.isFullyApproved, false);
    assert.strictEqual(meRes.data.user.status, 'rejected');
    assert.strictEqual(meRes.data.user.kycStatus, 'Rejected');

    // Dashboard access blocked 403
    const blocked = await request('/api/managers', { token: mgrToken });
    assert.strictEqual(blocked.status, 403);
  });

  // SCENARIO 7: Sub-admin approval and KYC approval are both completed -> dashboard access granted
  await runScenario(7, 'Sub-admin approval and KYC approval are both completed -> dashboard access granted', async () => {
    const mgrId = regManager1._id || regManager1.id;

    // Process KYC approval on the manager from Scenario 1 & 4
    const kycApproveRes = await request(`/api/kyc/KYC-MGR-${mgrId}/process`, {
      method: 'PATCH',
      token: kycTeamToken,
      body: { action: 'approve' }
    });

    assert.strictEqual(kycApproveRes.status, 200);

    // Profile must now show active, verified, isFullyApproved: true
    const meRes = await request('/api/auth/me', { token: regManager1Token });
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.data.requiresApproval, false, 'requiresApproval must be false now');
    assert.strictEqual(meRes.data.isFullyApproved, true, 'isFullyApproved must be true');
    assert.strictEqual(meRes.data.user.status, 'active');
    assert.strictEqual(meRes.data.user.adminApprovalStatus, 'approved');
    assert.strictEqual(meRes.data.user.kycStatus, 'Verified');

    // UI state helper verifies state is State 5 (Approved and Activated)
    const stateInfo = getRegistrationState(meRes.data.user);
    assert.strictEqual(stateInfo.stateNumber, 5, 'Applicant must be in State 5 (Approved & Active)');
    assert.strictEqual(stateInfo.stateKey, 'approved');

    // Protected API access now SUCCEEDS (200 OK)
    const allowedCall = await request('/api/managers', { token: regManager1Token });
    assert.strictEqual(allowedCall.status, 200, `Approved manager must access protected APIs, got status ${allowedCall.status}`);
  });

  // SCENARIO 8: An already approved Manager logs in -> existing authorized access continues to work
  await runScenario(8, 'An already approved Manager logs in -> existing authorized access continues to work', async () => {
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: {
        email: `kavitha_${testRunId}@connect.com`,
        password: 'password123'
      }
    });

    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginRes.data.requiresApproval, false);
    assert.strictEqual(loginRes.data.user.status, 'active');
    assert.strictEqual(loginRes.data.user.adminApprovalStatus, 'approved');
    assert.strictEqual(loginRes.data.user.kycStatus, 'Verified');

    // The newly issued token also accesses protected resources smoothly
    const res = await request('/api/managers', { token: loginRes.data.token });
    assert.strictEqual(res.status, 200);
  });

  // SCENARIO 9: Test State, District, Division, and Pincode Managers independently
  await runScenario(9, 'Test State, District, Division, and Pincode Managers independently', async () => {
    const rolesToTest = [
      { role: 'state_manager', payload: { state: 'Tamil Nadu' } },
      { role: 'district_manager', payload: { state: 'Tamil Nadu', district: 'Salem', districtId: 'dist_salem' } },
      { role: 'division_manager', payload: { state: 'Tamil Nadu', district: 'Salem', districtId: 'dist_salem', division: 'Salem North', divisionId: 'div_dist_salem_urban' } },
      { role: 'pincode_manager', payload: { state: 'Tamil Nadu', district: 'Salem', districtId: 'dist_salem', division: 'Salem North', divisionId: 'div_dist_salem_urban', pincode: '636001', pincodeId: 'pin_636001' } }
    ];

    for (const item of rolesToTest) {
      const email = `mgr_${item.role}_${testRunId}@connect.com`;
      const reg = await request('/api/auth/register', {
        method: 'POST',
        body: {
          name: `Test ${item.role}`,
          email,
          phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
          password: 'password123',
          role: item.role,
          ...item.payload
        }
      });

      assert.strictEqual(reg.status, 201, `Failed to register ${item.role}: ${JSON.stringify(reg.data)}`);
      assert.strictEqual(reg.data.status, 'PENDING_SUB_ADMIN_APPROVAL');

      // Attempt login
      const log = await request('/api/auth/login', {
        method: 'POST',
        body: { email, password: 'password123' }
      });
      assert.strictEqual(log.data.requiresApproval, true);
      assert.strictEqual(log.data.isFullyApproved, false);

      // Attempt protected call -> blocked
      const blk = await request('/api/managers', { token: log.data.token });
      assert.strictEqual(blk.status, 403, `${item.role} must be blocked 403 while pending`);
    }
  });

  // SCENARIO 10: Verify that pending Managers cannot access protected data using an old token or an existing session
  await runScenario(10, 'Verify that pending Managers cannot access protected data using an old token or an existing session', async () => {
    // Generate a token claiming user is active, but live DB record is pending
    const forgedToken = generateToken({
      id: 'FORGED-PENDING-MGR-TEST',
      _id: 'FORGED-PENDING-MGR-TEST',
      role: 'district_manager',
      status: 'active', // Token claims active
      isActive: true
    });

    // Record in db.users has status PENDING_SUB_ADMIN_APPROVAL
    db.users.push({
      _id: 'FORGED-PENDING-MGR-TEST',
      id: 'FORGED-PENDING-MGR-TEST',
      name: 'Forged Token Manager',
      email: 'forged_pending@connect.com',
      role: 'district_manager',
      status: 'PENDING_SUB_ADMIN_APPROVAL',
      adminApprovalStatus: 'pending',
      kycStatus: 'pending_verification',
      isActive: false
    });

    const res = await request('/api/managers', { token: forgedToken });
    assert.strictEqual(res.status, 403, 'Server must validate against live DB and reject stale/forged token with 403 Forbidden');
  });

  // SCENARIO 11: Verify that refreshing the page or opening a dashboard URL directly does not bypass approval
  await runScenario(11, 'Verify that refreshing the page or opening a dashboard URL directly does not bypass approval', async () => {
    // Fresh request to /api/auth/me with skipCache / fresh query simulating page reload
    const reloadRes = await request('/api/auth/me?fresh=1', {
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
      token: regManager1Token
    });

    assert.strictEqual(reloadRes.status, 200);
    // Since regManager1 was fully approved in Scenario 7, it confirms active
    assert.strictEqual(reloadRes.data.isFullyApproved, true);
    assert.strictEqual(reloadRes.data.requiresApproval, false);

    // Now test a newly pending manager page reload
    const pendingReg = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Reload Pending Manager',
        email: `reload_pending_${testRunId}@connect.com`,
        phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        password: 'password123',
        role: 'district_manager',
        state: 'Tamil Nadu',
        district: 'Salem'
      }
    });

    const pendingLog = await request('/api/auth/login', {
      method: 'POST',
      body: { email: `reload_pending_${testRunId}@connect.com`, password: 'password123' }
    });

    // Simulate page reload
    const reloadPendingMe = await request('/api/auth/me?fresh=1', {
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
      token: pendingLog.data.token
    });

    assert.strictEqual(reloadPendingMe.status, 200);
    assert.strictEqual(reloadPendingMe.data.isFullyApproved, false, 'On reload, server strictly enforces pending status');
    assert.strictEqual(reloadPendingMe.data.requiresApproval, true);

    // Protected API on reload remains 403
    const reloadApiCall = await request('/api/managers', { token: pendingLog.data.token });
    assert.strictEqual(reloadApiCall.status, 403);
  });

  // SCENARIO 12: Verify that the correct territory-based Sub-admin receives each registration request
  await runScenario(12, 'Verify that the correct territory-based Sub-admin receives each registration request', async () => {
    // 1. State Manager routed to State Admin
    const stateReg = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Territory State Manager',
        email: `terr_state_${testRunId}@connect.com`,
        phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        password: 'password123',
        role: 'state_manager',
        state: 'Tamil Nadu'
      }
    });
    assert.strictEqual(stateReg.data.user.targetAdminRole, 'State Admin');

    // State Admin requests queue contains this manager
    const stateAdminQueue = await request('/api/managers/requests?state=Tamil Nadu', { token: stateAdminToken });
    const hasInState = stateAdminQueue.data.requests.some(r => r.email === `terr_state_${testRunId}@connect.com`);
    assert(hasInState, 'State Admin must see the state manager registration in their requests queue');

    // 2. District Manager routed to District Admin
    const distReg = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Territory District Manager',
        email: `terr_dist_${testRunId}@connect.com`,
        phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        password: 'password123',
        role: 'district_manager',
        state: 'Tamil Nadu',
        district: 'Salem'
      }
    });
    assert.strictEqual(distReg.data.user.targetAdminRole, 'District Admin');

    // District Admin Salem requests queue contains this manager
    const distAdminQueue = await request('/api/managers/requests?district=Salem', { token: districtAdminSalemToken });
    const hasInDistrict = distAdminQueue.data.requests.some(r => r.email === `terr_dist_${testRunId}@connect.com`);
    assert(hasInDistrict, 'Salem District Admin must see the district manager registration in their requests queue');

    // 3. Division Manager routed to Divisional Admin
    const divReg = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Territory Division Manager',
        email: `terr_div_${testRunId}@connect.com`,
        phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        password: 'password123',
        role: 'division_manager',
        state: 'Tamil Nadu',
        district: 'Salem',
        districtId: 'dist_salem',
        division: 'Salem North',
        divisionId: 'div_dist_salem_urban'
      }
    });
    assert.strictEqual(divReg.data.user.targetAdminRole, 'Divisional Admin');

    // 4. Pincode Manager routed to Pincode Admin
    const pinReg = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Territory Pincode Manager',
        email: `terr_pin_${testRunId}@connect.com`,
        phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        password: 'password123',
        role: 'pincode_manager',
        state: 'Tamil Nadu',
        district: 'Salem',
        districtId: 'dist_salem',
        division: 'Salem North',
        divisionId: 'div_dist_salem_urban',
        pincode: '636001',
        pincodeId: 'pin_636001'
      }
    });
    assert.strictEqual(pinReg.data.user.targetAdminRole, 'Pincode Admin');

    // 5. Unmapped territory manager registers -> routingIssue reported, remains pending
    const unmappedReg = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Unmapped State Manager',
        email: `terr_unmapped_${testRunId}@connect.com`,
        phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        password: 'password123',
        role: 'state_manager',
        state: 'Himachal Pradesh'
      }
    });
    assert.strictEqual(unmappedReg.status, 201, `Expected 201 for unmapped territory: ${JSON.stringify(unmappedReg.data)}`);
    assert.strictEqual(unmappedReg.data.status, 'PENDING_SUB_ADMIN_APPROVAL');
    assert(unmappedReg.data.routingIssue, 'Routing issue must be reported for unmapped territory');
  });

  console.log('\n========================================================================');
  console.log(`🎯 Test Run Completed: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================================');

  if (testServer) testServer.close();
  process.exit(failed > 0 ? 1 : 0);
})();
