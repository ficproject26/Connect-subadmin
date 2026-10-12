require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { initDatabase, db } = require('../config/db');
const managerDirectoryController = require('../controllers/managerDirectoryController');

async function runTests() {
  console.log('--- Initializing database for test ---');
  await initDatabase();
  console.log('Database initialized successfully.');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  const runEndpoint = async (fn, user, query = {}, params = {}) => {
    let result = null;
    let statusCode = 200;
    const req = { user, query, params, headers: {}, ip: '127.0.0.1' };
    const res = {
      json: (data) => { result = data; return data; },
      status: (code) => { statusCode = code; return res; }
    };
    await fn(req, res);
    return { result, statusCode };
  };

  const karnatakaAdmin = {
    _id: 'test-karnataka-admin-id',
    id: 'test-karnataka-admin-id',
    name: 'State Admin Karnataka',
    role: 'State Admin',
    state: 'Karnataka',
    stateId: 'karnataka-id'
  };

  console.log('\n======================================================');
  console.log('TEST 1: Manager Directory (GET /api/managers) - Show Only Approved & Active');
  console.log('======================================================');

  // Test State Managers Directory
  const stateMgrs = await runEndpoint(managerDirectoryController.getLowerLevelManagers, karnatakaAdmin, { level: 'state' });
  assert(stateMgrs.result && stateMgrs.result.success === true, 'getLowerLevelManagers (state) returns success');
  const stateList = stateMgrs.result?.subordinates || [];
  const stateNonActive = stateList.filter(m => (m.status || '').toLowerCase() !== 'active');
  assert(stateNonActive.length === 0, `State Managers tab has ZERO non-active records (found ${stateNonActive.length})`);
  assert(stateMgrs.result?.stats?.pendingApprovals === 0, 'Directory stats.pendingApprovals is strictly 0');

  // Test District Managers Directory
  const distMgrs = await runEndpoint(managerDirectoryController.getLowerLevelManagers, karnatakaAdmin, { level: 'district' });
  assert(distMgrs.result && distMgrs.result.success === true, 'getLowerLevelManagers (district) returns success');
  const distList = distMgrs.result?.subordinates || [];
  const distNonActive = distList.filter(m => (m.status || '').toLowerCase() !== 'active');
  assert(distNonActive.length === 0, `District Managers tab has ZERO non-active records (found ${distNonActive.length})`);

  // Test Divisional Managers Directory
  const divMgrs = await runEndpoint(managerDirectoryController.getLowerLevelManagers, karnatakaAdmin, { level: 'divisional' });
  assert(divMgrs.result && divMgrs.result.success === true, 'getLowerLevelManagers (divisional) returns success');
  const divList = divMgrs.result?.subordinates || [];
  const divNonActive = divList.filter(m => (m.status || '').toLowerCase() !== 'active');
  assert(divNonActive.length === 0, `Divisional Managers tab has ZERO non-active records (found ${divNonActive.length})`);

  // Test Pincode Managers Directory
  const pinMgrs = await runEndpoint(managerDirectoryController.getLowerLevelManagers, karnatakaAdmin, { level: 'pincode' });
  assert(pinMgrs.result && pinMgrs.result.success === true, 'getLowerLevelManagers (pincode) returns success');
  const pinList = pinMgrs.result?.subordinates || [];
  const pinNonActive = pinList.filter(m => (m.status || '').toLowerCase() !== 'active');
  assert(pinNonActive.length === 0, `Pincode Managers tab has ZERO non-active records (found ${pinNonActive.length})`);

  console.log('\n======================================================');
  console.log('TEST 2: Manager Requests (GET /api/managers/requests) - Centralized View');
  console.log('======================================================');

  // Test All Requests
  const allReqs = await runEndpoint(managerDirectoryController.getManagerRequests, karnatakaAdmin, { status: 'All' });
  assert(allReqs.result && allReqs.result.success === true, 'getManagerRequests (All) returns success');
  const allReqsList = allReqs.result?.requests || [];
  assert(Array.isArray(allReqsList), `Requests list is returned (count: ${allReqsList.length})`);

  // Test Pending Requests
  const pendingReqs = await runEndpoint(managerDirectoryController.getManagerRequests, karnatakaAdmin, { status: 'Pending' });
  assert(pendingReqs.result && pendingReqs.result.success === true, 'getManagerRequests (Pending) returns success');
  const pendingList = pendingReqs.result?.requests || [];
  const nonPendingInPendingTab = pendingList.filter(m => {
    const s = (m.status || '').toLowerCase();
    return s !== 'under_review' && s !== 'pending' && s !== 'pending_admin_approval';
  });
  assert(nonPendingInPendingTab.length === 0, `Pending filter contains ONLY pending/under_review records (non-pending count: ${nonPendingInPendingTab.length})`);
  console.log(`   -> Found ${pendingList.length} pending registration request(s) under review`);

  // Test Approved Requests
  const approvedReqs = await runEndpoint(managerDirectoryController.getManagerRequests, karnatakaAdmin, { status: 'Approved' });
  assert(approvedReqs.result && approvedReqs.result.success === true, 'getManagerRequests (Approved) returns success');
  const approvedList = approvedReqs.result?.requests || [];
  const unapprovedInApprovedTab = approvedList.filter(m => {
    const s = (m.status || '').toLowerCase();
    return s !== 'approved' && s !== 'active' && s !== 'pending_kyc';
  });
  assert(unapprovedInApprovedTab.length === 0, `Approved filter contains ONLY approved/active/pending_kyc records`);

  // Test Rejected Requests
  const rejectedReqs = await runEndpoint(managerDirectoryController.getManagerRequests, karnatakaAdmin, { status: 'Rejected' });
  assert(rejectedReqs.result && rejectedReqs.result.success === true, 'getManagerRequests (Rejected) returns success');
  const rejectedList = rejectedReqs.result?.requests || [];
  const nonRejectedInRejectedTab = rejectedList.filter(m => (m.status || '').toLowerCase() !== 'rejected');
  assert(nonRejectedInRejectedTab.length === 0, `Rejected filter contains ONLY rejected records`);

  console.log('\n======================================================');
  console.log('TEST 3: Level Filtering in Manager Requests');
  console.log('======================================================');

  const levels = ['state', 'district', 'divisional', 'pincode'];
  for (const lvl of levels) {
    const lvlRes = await runEndpoint(managerDirectoryController.getManagerRequests, karnatakaAdmin, { level: lvl });
    assert(lvlRes.result && lvlRes.result.success === true, `Level filter '${lvl}' returns success (count: ${lvlRes.result?.requests?.length || 0})`);
  }

  console.log('\n======================================================');
  console.log('TEST 4: Territory and Role Restrictions (RBAC)');
  console.log('======================================================');

  // Verify Karnataka Admin only sees Karnataka managers
  const tnInDirectory = stateList.filter(m => (m.state || m.assignedState || '').toLowerCase() === 'tamil nadu');
  assert(tnInDirectory.length === 0, 'Karnataka Admin cannot see Tamil Nadu managers in Directory');

  const tnInRequests = allReqsList.filter(m => (m.state || m.assignedState || '').toLowerCase() === 'tamil nadu');
  assert(tnInRequests.length === 0, 'Karnataka Admin cannot see Tamil Nadu manager requests');

  console.log('\n======================================================');
  console.log('TEST 5: Lifecycle & Directory Exclusion Simulation');
  console.log('======================================================');

  // Temporarily insert a mock pending manager and a mock rejected manager in db.users
  const testPendingManager = {
    _id: 'test-pending-mgr-lifecycle',
    id: 'test-pending-mgr-lifecycle',
    name: 'Lifecycle Pending Test Manager',
    email: 'lifecycle_pending@example.com',
    role: 'state_manager',
    state: 'Karnataka',
    status: 'under_review',
    createdAt: new Date().toISOString()
  };

  const testRejectedManager = {
    _id: 'test-rejected-mgr-lifecycle',
    id: 'test-rejected-mgr-lifecycle',
    name: 'Lifecycle Rejected Test Manager',
    email: 'lifecycle_rejected@example.com',
    role: 'state_manager',
    state: 'Karnataka',
    status: 'rejected',
    rejectionReason: 'Invalid identity document submitted',
    createdAt: new Date().toISOString()
  };

  const testPendingKycManager = {
    _id: 'test-pending-kyc-mgr-lifecycle',
    id: 'test-pending-kyc-mgr-lifecycle',
    name: 'Lifecycle KYC Test Manager',
    email: 'lifecycle_kyc@example.com',
    role: 'state_manager',
    state: 'Karnataka',
    status: 'pending_kyc',
    adminApprovalStatus: 'approved',
    createdAt: new Date().toISOString()
  };

  db.users.push(testPendingManager);
  db.users.push(testRejectedManager);
  db.users.push(testPendingKycManager);

  try {
    // 1. Verify NONE of these appear in State Managers directory
    const dirAfter = await runEndpoint(managerDirectoryController.getLowerLevelManagers, karnatakaAdmin, { level: 'state' });
    const dirIds = (dirAfter.result?.subordinates || []).map(m => String(m._id || m.id));
    assert(!dirIds.includes('test-pending-mgr-lifecycle'), 'Pending manager does NOT appear in State Managers directory');
    assert(!dirIds.includes('test-rejected-mgr-lifecycle'), 'Rejected manager does NOT appear in State Managers directory');
    assert(!dirIds.includes('test-pending-kyc-mgr-lifecycle'), 'Approved but unactivated (pending_kyc) manager does NOT appear in State Managers directory');

    // 2. Verify ALL appear in Manager Requests
    const reqsAfter = await runEndpoint(managerDirectoryController.getManagerRequests, karnatakaAdmin, { status: 'All' });
    const reqIds = (reqsAfter.result?.requests || []).map(m => String(m._id || m.id));
    assert(reqIds.includes('test-pending-mgr-lifecycle'), 'Pending manager appears in Manager Requests (All)');
    assert(reqIds.includes('test-rejected-mgr-lifecycle'), 'Rejected manager appears in Manager Requests (All)');
    assert(reqIds.includes('test-pending-kyc-mgr-lifecycle'), 'Approved pending_kyc manager appears in Manager Requests (All)');

    // 3. Verify Rejected manager appears under Rejected filter with rejectionReason
    const reqsRejected = await runEndpoint(managerDirectoryController.getManagerRequests, karnatakaAdmin, { status: 'Rejected' });
    const rejMatch = (reqsRejected.result?.requests || []).find(m => String(m._id || m.id) === 'test-rejected-mgr-lifecycle');
    assert(Boolean(rejMatch), 'Rejected manager appears under Rejected filter');
    assert(rejMatch?.rejectionReason === 'Invalid identity document submitted', 'Rejection reason is preserved and returned');

    // 4. Verify once activated, manager appears in directory
    testPendingKycManager.status = 'active';
    const dirAfterActivation = await runEndpoint(managerDirectoryController.getLowerLevelManagers, karnatakaAdmin, { level: 'state' });
    const activeIds = (dirAfterActivation.result?.subordinates || []).map(m => String(m._id || m.id));
    assert(activeIds.includes('test-pending-kyc-mgr-lifecycle'), 'Once activated (status=active), manager appears immediately in State Managers directory without manual DB changes');

  } finally {
    // Clean up temporary mock users
    db.users = db.users.filter(u => 
      u._id !== 'test-pending-mgr-lifecycle' &&
      u._id !== 'test-rejected-mgr-lifecycle' &&
      u._id !== 'test-pending-kyc-mgr-lifecycle'
    );
  }

  console.log('\n======================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
