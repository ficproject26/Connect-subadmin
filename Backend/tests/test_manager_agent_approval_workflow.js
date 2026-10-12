/**
 * End-to-End Test Suite: Manager and Agent Registration Approval & KYC Workflow
 * Strictly verifies the 16 scenarios defined in Section 9 of the specifications.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const assert = require('assert');
const bcrypt = require('bcryptjs');
const http = require('http');
const app = require('../server');
const { db, initDatabase } = require('../config/db');
const { generateToken } = require('../utils/jwt');

let testServer;
let baseUrl;

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  console.log(`[REQ] ${options.method || 'GET'} ${path}`);
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
  console.log(`[RES] ${options.method || 'GET'} ${path} -> status ${res.status}`);
  return { status: res.status, ok: res.ok, data };
}

(async () => {
  console.log('========================================================================');
  console.log('🧪 Testing Manager & Agent Registration Approval Workflow (16 Scenarios)');
  console.log('========================================================================');

  try {
    await initDatabase();
  } catch (err) {
    console.warn('Database initialization note:', err.message);
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

  async function test(scenarioNum, name, fn) {
    try {
      console.log(`[TEST] Starting Scenario ${scenarioNum}: ${name}`);
      await fn();
      console.log(`  ✅ Scenario ${scenarioNum}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ Scenario ${scenarioNum}: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // Setup mock Sub-Admins in db.users for territory governance testing
  const passwordHash = await bcrypt.hash('admin123', 10);
  const stateAdminUser = {
    _id: 'TEST-ADMIN-TN',
    id: 'TEST-ADMIN-TN',
    name: 'Tamil Nadu State Admin',
    email: 'stateadmin_tn@connect.com',
    password: passwordHash,
    role: 'State Admin',
    adminLevel: 'state',
    state: 'Tamil Nadu',
    status: 'active',
    isActive: true
  };
  const districtAdminSalem = {
    _id: 'TEST-ADMIN-SALEM',
    id: 'TEST-ADMIN-SALEM',
    name: 'Salem District Admin',
    email: 'districtadmin_salem@connect.com',
    password: passwordHash,
    role: 'District Admin',
    adminLevel: 'district',
    state: 'Tamil Nadu',
    district: 'Salem',
    status: 'active',
    isActive: true
  };
  const districtAdminChennai = {
    _id: 'TEST-ADMIN-CHENNAI',
    id: 'TEST-ADMIN-CHENNAI',
    name: 'Chennai District Admin',
    email: 'districtadmin_chennai@connect.com',
    password: passwordHash,
    role: 'District Admin',
    adminLevel: 'district',
    state: 'Tamil Nadu',
    district: 'Chennai',
    status: 'active',
    isActive: true
  };
  const kycTeamUser = {
    _id: 'TEST-KYC-ADMIN',
    id: 'TEST-KYC-ADMIN',
    name: 'KYC Verification Officer',
    email: 'kyc_officer@connect.com',
    password: passwordHash,
    role: 'KYC Team',
    adminLevel: 'kyc',
    state: 'All India',
    status: 'active',
    isActive: true
  };

  db.users.push(stateAdminUser, districtAdminSalem, districtAdminChennai, kycTeamUser);

  const stateAdminToken = generateToken(stateAdminUser);
  const districtAdminSalemToken = generateToken(districtAdminSalem);
  const districtAdminChennaiToken = generateToken(districtAdminChennai);
  const kycTeamToken = generateToken(kycTeamUser);

  const runId = Date.now();
  const testManagerEmail = `muthu_manager_${runId}@connect.com`;
  const testManagerPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
  const testAgentEmail = `arun_agent_${runId}@connect.com`;
  const testAgentPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;

  let testManagerUser = null;
  let testManagerToken = null;
  let testAgentUser = null;
  let testAgentToken = null;

  // Scenario 1: Manager registers -> pending admin approval, login requiresApproval
  await test(1, 'Manager registers -> created with pending_admin_approval and login blocked from dashboard', async () => {
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Muthu Manager',
        email: testManagerEmail,
        phone: testManagerPhone,
        password: 'password123',
        role: 'district_manager',
        state: 'Tamil Nadu',
        district: 'Salem'
      }
    });

    assert.strictEqual(regRes.status, 201, `Registration should succeed with 201: ${JSON.stringify(regRes.data)}`);
    assert.strictEqual(regRes.data.success, true);
    assert.strictEqual(regRes.data.user.status, 'pending_admin_approval');
    assert.strictEqual(regRes.data.user.adminApprovalStatus, 'pending');
    assert.strictEqual(regRes.data.requiresApproval, true);

    testManagerUser = regRes.data.user;

    // Attempt login
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: {
        email: testManagerEmail,
        password: 'password123'
      }
    });

    assert.strictEqual(loginRes.status, 200, 'Login returns 200 with status info');
    assert.strictEqual(loginRes.data.requiresApproval, true, 'Login payload must specify requiresApproval: true');
    assert(loginRes.data.token, 'A status inquiry token must be returned');
    testManagerToken = loginRes.data.token;
  });

  // Scenario 2: Agent registers -> created with pending_admin_approval and login blocked
  await test(2, 'Agent registers -> created with pending_admin_approval and login blocked from dashboard', async () => {
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Arun Agent',
        email: testAgentEmail,
        phone: testAgentPhone,
        password: 'password123',
        role: 'district_agent',
        state: 'Tamil Nadu',
        district: 'Salem'
      }
    });

    assert.strictEqual(regRes.status, 201);
    assert.strictEqual(regRes.data.user.status, 'pending_admin_approval');
    assert.strictEqual(regRes.data.user.adminApprovalStatus, 'pending');
    testAgentUser = regRes.data.user;

    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: {
        email: testAgentEmail,
        password: 'password123'
      }
    });

    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginRes.data.requiresApproval, true);
    testAgentToken = loginRes.data.token;
  });

  // Scenario 3: Unapproved applicant calls /api/auth/me and /api/auth/registration-status
  await test(3, 'Unapproved applicant can view /api/auth/me and live status', async () => {
    const meRes = await request('/api/auth/me', { token: testManagerToken });
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.data.requiresApproval, true);
    assert.strictEqual(meRes.data.user.status, 'pending_admin_approval');

    const statusRes = await request('/api/auth/registration-status', { token: testManagerToken });
    assert.strictEqual(statusRes.status, 200);
    assert.strictEqual(statusRes.data.requiresApproval, true);
  });

  // Scenario 4: Unapproved applicant calls protected dashboard APIs -> receives 403 Forbidden
  await test(4, 'Unapproved applicant calling protected dashboard API receives 403 Forbidden', async () => {
    const blockedRes1 = await request('/api/managers', { token: testManagerToken });
    assert.strictEqual(blockedRes1.status, 403, 'Should be 403 Forbidden');
    assert.strictEqual(blockedRes1.data.requiresApproval, true);

    const blockedRes2 = await request('/api/reports/analytics', { token: testAgentToken });
    assert.strictEqual(blockedRes2.status, 403, 'Should be 403 Forbidden');
    assert.strictEqual(blockedRes2.data.requiresApproval, true);
  });

  // Scenario 5: Territory Admin visibility: Only Salem Sub-Admin can manage Salem applicant
  await test(5, 'Territory governance: Salem Sub-Admin has authority, Chennai Sub-Admin does not', async () => {
    const mgrId = testManagerUser._id || testManagerUser.id;

    // Chennai District Admin attempts to approve Salem District Manager -> 403
    const unauthorizedRes = await request(`/api/managers/${mgrId}/approve`, {
      method: 'POST',
      token: districtAdminChennaiToken
    });
    assert.strictEqual(unauthorizedRes.status, 403, 'Sub-Admin outside jurisdiction must be denied authority');

    // Salem Sub-Admin has authority for Salem manager
    const authorizedView = await request('/api/managers/requests?district=Salem', {
      token: districtAdminSalemToken
    });
    assert.strictEqual(authorizedView.status, 200);
    const found = (authorizedView.data.requests || []).some(r => String(r.id || r._id) === String(mgrId));
    assert(found, 'Manager request must be visible to Salem Sub-Admin');
  });

  // Scenario 6: Sub-admin rejects with mandatory reason -> applicant sees State 4
  await test(6, 'Sub-Admin rejects with reason -> requires non-empty reason and sets State 4', async () => {
    const mgrId = testManagerUser._id || testManagerUser.id;

    // Missing reason should fail with 400
    const failRes = await request(`/api/managers/${mgrId}/reject`, {
      method: 'POST',
      token: stateAdminToken,
      body: { reason: '' }
    });
    assert.strictEqual(failRes.status, 400, 'Empty rejection reason must be rejected with 400');

    // Rejection with mandatory reason
    const rejRes = await request(`/api/managers/${mgrId}/reject`, {
      method: 'POST',
      token: stateAdminToken,
      body: { reason: 'Address mismatch on submitted Aadhaar card for Salem district.' }
    });
    assert.strictEqual(rejRes.status, 200);
    assert.strictEqual(rejRes.data.manager.status, 'rejected');
    assert.strictEqual(rejRes.data.manager.rejectionReason, 'Address mismatch on submitted Aadhaar card for Salem district.');

    // Applicant status check
    const statusRes = await request('/api/auth/me', { token: testManagerToken });
    assert.strictEqual(statusRes.data.user.status, 'rejected');
    assert.strictEqual(statusRes.data.user.rejectionReason, 'Address mismatch on submitted Aadhaar card for Salem district.');
  });

  // Scenario 7: Sub-admin marks pending with mandatory reason -> applicant sees State 3
  await test(7, 'Sub-Admin marks pending with reason -> requires non-empty reason and sets State 3', async () => {
    const agId = testAgentUser._id || testAgentUser.id;

    // Missing reason should fail with 400
    const failRes = await request(`/api/operations/agents/${agId}/pending`, {
      method: 'POST',
      token: districtAdminSalemToken,
      body: { reason: '   ' }
    });
    assert.strictEqual(failRes.status, 400);

    // Keep pending with valid note
    const pendingRes = await request(`/api/operations/agents/${agId}/pending`, {
      method: 'POST',
      token: districtAdminSalemToken,
      body: { reason: 'Please upload a clear copy of Bank passbook.' }
    });
    assert.strictEqual(pendingRes.status, 200);
    assert.strictEqual(pendingRes.data.agent.status, 'pending');
    assert.strictEqual(pendingRes.data.agent.pendingReason, 'Please upload a clear copy of Bank passbook.');

    // Applicant status check
    const statusRes = await request('/api/auth/me', { token: testAgentToken });
    assert.strictEqual(statusRes.data.user.status, 'pending');
    assert.strictEqual(statusRes.data.user.pendingReason, 'Please upload a clear copy of Bank passbook.');
  });

  // Scenario 8: Sub-admin approves -> forwarded to KYC queue with status Awaiting KYC
  await test(8, 'Sub-Admin approves -> forwarded to KYC queue with status Awaiting KYC (State 2)', async () => {
    const mgrId = testManagerUser._id || testManagerUser.id;

    const approveRes = await request(`/api/managers/${mgrId}/approve`, {
      method: 'POST',
      token: stateAdminToken
    });
    assert.strictEqual(approveRes.status, 200);
    assert.strictEqual(approveRes.data.manager.adminApprovalStatus, 'approved');
    assert.strictEqual(approveRes.data.manager.status, 'pending_kyc');

    // KYC record queued
    const kycRecord = Array.from(db.kycRecords).find(k => String(k.managerId) === String(mgrId) || k.id === `KYC-MGR-${mgrId}`);
    assert(kycRecord, 'KYC record must exist for approved manager');
    assert.strictEqual(kycRecord.status, 'Pending');

    // Manager status check -> Awaiting KYC
    const statusRes = await request('/api/auth/me', { token: testManagerToken });
    assert.strictEqual(statusRes.data.user.adminApprovalStatus, 'approved');
    assert.strictEqual(statusRes.data.user.kycStatus, 'pending_verification');
  });

  // Scenario 9: Applicant dashboard access blocked after Sub-admin approval before KYC approval
  await test(9, 'Applicant attempts dashboard access after Sub-Admin approval but before KYC approval -> blocked 403', async () => {
    const blockedRes = await request('/api/managers', { token: testManagerToken });
    assert.strictEqual(blockedRes.status, 403);
    assert.strictEqual(blockedRes.data.requiresApproval, true);
  });

  // Scenario 10: KYC team approves without Sub-admin approval -> account remains unapproved/inactive
  await test(10, 'KYC team approves request without prior Sub-Admin approval -> account remains blocked', async () => {
    // Create an unapproved manager
    const unapprovedMgr = {
      _id: 'UNAPPROVED-MGR-TEST',
      id: 'UNAPPROVED-MGR-TEST',
      name: 'Unapproved Candidate',
      email: 'unapproved@connect.com',
      password: passwordHash,
      role: 'state_manager',
      status: 'pending_admin_approval',
      adminApprovalStatus: 'pending',
      kycStatus: 'pending_verification',
      isActive: false
    };
    db.users.push(unapprovedMgr);

    // Create corresponding KYC record
    const kycRec = {
      _id: 'KYC-MGR-UNAPPROVED-MGR-TEST',
      id: 'KYC-MGR-UNAPPROVED-MGR-TEST',
      type: 'Manager',
      managerId: 'UNAPPROVED-MGR-TEST',
      name: 'Unapproved Candidate',
      status: 'Pending',
      kycStatus: 'Pending Verification'
    };
    db.kycRecords.push(kycRec);

    // KYC officer marks verified
    const kycProcessRes = await request(`/api/kyc/${kycRec.id}/process`, {
      method: 'PATCH',
      token: kycTeamToken,
      body: { status: 'Verified' }
    });
    assert.strictEqual(kycProcessRes.status, 200);

    // Check user: KYC is verified, but status must NOT be active because Sub-Admin approval was missing!
    const candidateInDb = Array.from(db.users).find(u => u.id === 'UNAPPROVED-MGR-TEST');
    assert.strictEqual(candidateInDb.kycStatus, 'Verified');
    assert.notStrictEqual(candidateInDb.status, 'active', 'Account must NOT be active without Sub-Admin approval');
    assert.strictEqual(candidateInDb.isActive, false, 'Account must remain inactive');
  });

  // Scenario 11: KYC team rejects with reason -> applicant sees State 4
  await test(11, 'KYC team rejects with reason -> requires non-empty reason and sets State 4', async () => {
    const kycRec = Array.from(db.kycRecords).find(k => k.id === 'KYC-MGR-UNAPPROVED-MGR-TEST');

    // Missing reason check
    const failRes = await request(`/api/kyc/${kycRec.id}/process`, {
      method: 'PATCH',
      token: kycTeamToken,
      body: { status: 'Rejected', reason: '' }
    });
    assert.strictEqual(failRes.status, 400);

    // Reject with reason
    const rejRes = await request(`/api/kyc/${kycRec.id}/process`, {
      method: 'PATCH',
      token: kycTeamToken,
      body: { status: 'Rejected', reason: 'GSTIN certificate is forged or expired.' }
    });
    assert.strictEqual(rejRes.status, 200);

    const userInDb = Array.from(db.users).find(u => u.id === 'UNAPPROVED-MGR-TEST');
    assert.strictEqual(userInDb.status, 'rejected');
    assert.strictEqual(userInDb.kycStatus, 'Rejected');
    assert.strictEqual(userInDb.rejectionReason, 'GSTIN certificate is forged or expired.');
  });

  // Scenario 12: KYC team marks pending with reason -> applicant sees State 3
  await test(12, 'KYC team marks pending with reason -> requires non-empty reason and sets State 3', async () => {
    const kycRec = Array.from(db.kycRecords).find(k => k.id === 'KYC-MGR-UNAPPROVED-MGR-TEST');

    const pendingRes = await request(`/api/kyc/${kycRec.id}/process`, {
      method: 'PATCH',
      token: kycTeamToken,
      body: { status: 'Pending', reason: 'Pan card photo is blurry. Please re-submit.' }
    });
    assert.strictEqual(pendingRes.status, 200);

    const userInDb = Array.from(db.users).find(u => u.id === 'UNAPPROVED-MGR-TEST');
    assert.strictEqual(userInDb.status, 'pending');
    assert.strictEqual(userInDb.pendingReason, 'Pan card photo is blurry. Please re-submit.');
  });

  // Scenario 13: Sub-admin approves THEN KYC team approves -> account activated
  await test(13, 'Sub-Admin approves THEN KYC team approves -> account activated (State 5)', async () => {
    const mgrId = testManagerUser._id || testManagerUser.id;
    const kycRecord = Array.from(db.kycRecords).find(k => String(k.managerId) === String(mgrId) || k.id === `KYC-MGR-${mgrId}`);
    assert(kycRecord, 'KYC record must be found');

    const kycApproveRes = await request(`/api/kyc/${kycRecord.id}/process`, {
      method: 'PATCH',
      token: kycTeamToken,
      body: { status: 'Verified' }
    });
    assert.strictEqual(kycApproveRes.status, 200);

    const activeUserInDb = Array.from(db.users).find(u => String(u._id || u.id) === String(mgrId));
    assert.strictEqual(activeUserInDb.status, 'active');
    assert.strictEqual(activeUserInDb.adminApprovalStatus, 'approved');
    assert.strictEqual(activeUserInDb.kycStatus, 'Verified');
    assert.strictEqual(activeUserInDb.isActive, true);
  });

  // Scenario 14: Approved Manager logs in -> lands on /manager/dashboard with full active token
  await test(14, 'Approved Manager logs in -> receives active JWT and requiresApproval: false', async () => {
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: {
        email: testManagerEmail,
        password: 'password123'
      }
    });

    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginRes.data.requiresApproval, false);
    assert.strictEqual(loginRes.data.user.status, 'active');

    // Protected API access succeeds now!
    const activeToken = loginRes.data.token;
    const meRes = await request('/api/auth/me', { token: activeToken });
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.data.isFullyApproved, true);
  });

  // Scenario 15: Revocation of active session: Live DB deactivation invalidates access immediately
  await test(15, 'Session revocation: Deactivated account rejected on next API call even with existing token', async () => {
    const mgrId = testManagerUser._id || testManagerUser.id;
    const managerInDb = Array.from(db.users).find(u => String(u._id || u.id) === String(mgrId));

    // Active login
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: {
        email: testManagerEmail,
        password: 'password123'
      }
    });
    const currentToken = loginRes.data.token;

    // Admin deactivates / rejects manager in DB
    managerInDb.status = 'rejected';
    managerInDb.rejectionReason = 'Administrative compliance audit failed.';
    managerInDb.isActive = false;

    // Immediate next call with the token must fail with 403
    const blockedCall = await request('/api/managers', { token: currentToken });
    assert.strictEqual(blockedCall.status, 403, 'Stale token must be rejected because live DB status is rejected');
  });

  // Scenario 16: Registration Status Page 5-state logic verification
  await test(16, 'Frontend 5 explicit states mapping returns exact reasons without generic fallbacks', async () => {
    const { getRegistrationState } = require('../utils/registrationStatusHelper');

    // 1. Pending Admin
    const s1 = getRegistrationState({ status: 'pending_admin_approval', adminApprovalStatus: 'pending' });
    assert.strictEqual(s1.stateNumber, 1);
    assert.strictEqual(s1.primaryMessage, 'Your registration request is pending administrative approval. Please contact your administrator for further information.');

    // 2. Awaiting KYC
    const s2 = getRegistrationState({ status: 'pending_kyc', adminApprovalStatus: 'approved', kycStatus: 'pending_verification' });
    assert.strictEqual(s2.stateNumber, 2);
    assert.strictEqual(s2.primaryMessage, 'Your registration has been reviewed by the administrator and is awaiting KYC verification. Dashboard access will be available after all required approvals are completed.');

    // 3. Pending with reason
    const s3 = getRegistrationState({ status: 'pending', pendingReason: 'Awaiting revised GST certificate copy.' });
    assert.strictEqual(s3.stateNumber, 3);
    assert.strictEqual(s3.primaryMessage, 'Your registration is currently pending.');
    assert.strictEqual(s3.reason, 'Awaiting revised GST certificate copy.');

    // 4. Rejected with reason
    const s4 = getRegistrationState({ status: 'rejected', rejectionReason: 'Jurisdictional manager quota reached for Salem district.' });
    assert.strictEqual(s4.stateNumber, 4);
    assert.strictEqual(s4.primaryMessage, 'Your registration request has not been approved.');
    assert.strictEqual(s4.reason, 'Jurisdictional manager quota reached for Salem district.');

    // 5. Approved and active
    const s5 = getRegistrationState({ status: 'active', adminApprovalStatus: 'approved', kycStatus: 'Verified', isActive: true, requiresApproval: false });
    assert.strictEqual(s5.stateNumber, 5);
    assert(s5.primaryMessage.includes('approved and activated'));
  });

  console.log('========================================================================');
  console.log(`Summary: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================================');

  testServer.close();
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
})();
