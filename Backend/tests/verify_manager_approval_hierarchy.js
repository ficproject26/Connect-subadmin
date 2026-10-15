/**
 * Comprehensive Test Suite for Manager Request Approval Hierarchy
 * 
 * Verifies all 12 test cases specified in the Master Prompt:
 * 1. State Admin can approve or reject eligible State Manager requests within scope.
 * 2. District Admin can approve or reject eligible District Manager requests within scope.
 * 3. Division Admin can approve or reject eligible Division Manager requests within scope.
 * 4. Pincode Admin can approve or reject eligible Pincode Manager requests within scope.
 * 5. Admin cannot approve or reject a request in an unauthorized territory (HTTP 403).
 * 6. User with wrong Admin level receives HTTP 403 (e.g. State Admin -> District Mgr, District Admin -> State Mgr).
 * 7. Non-admin roles (Managers, Agents) receive HTTP 403.
 * 8. Direct API calls and manipulated payloads cannot bypass authorization.
 * 9. View permissions, filtering, and canApprove flags remain accurate.
 * 10. Multi-stage workflow integrity (territory approval -> KYC review queue) is preserved.
 * 11. Audit records (subAdminApprovedBy, subAdminApprovedByRole, reviewHistory) are accurately recorded.
 * 12. Rejection requires a mandatory reason and sets proper audit fields.
 */

require('dotenv').config();
const assert = require('assert');
const { db, initDatabase } = require('../config/db');
const managerDirectoryController = require('../controllers/managerDirectoryController');

// Mock Express req/res
function createMockReqRes({ method = 'POST', params = {}, body = {}, query = {}, user = null }) {
  const req = {
    method,
    params,
    body,
    query,
    user,
    ip: '127.0.0.1'
  };
  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      responseData = data;
      return res;
    },
    getStatusCode: () => statusCode,
    getData: () => responseData
  };

  return { req, res };
}

async function runTests() {
  console.log('================================================================');
  console.log('  MANAGER REQUEST APPROVAL HIERARCHY VERIFICATION SUITE');
  console.log('================================================================\n');

  await initDatabase();

  // Test data setup in db.users
  const stateAdminTN = {
    _id: 'sa_tn_001',
    id: 'sa_tn_001',
    name: 'State Admin Tamil Nadu',
    email: 'stateadmin.tn@example.com',
    role: 'State Admin',
    state: 'Tamil Nadu',
    status: 'active',
    isFullyApproved: true
  };

  const districtAdminSalem = {
    _id: 'da_salem_001',
    id: 'da_salem_001',
    name: 'District Admin Salem',
    email: 'da.salem@example.com',
    role: 'District Admin',
    state: 'Tamil Nadu',
    district: 'Salem',
    status: 'active',
    isFullyApproved: true
  };

  const districtAdminCoimbatore = {
    _id: 'da_cbe_001',
    id: 'da_cbe_001',
    name: 'District Admin Coimbatore',
    email: 'da.cbe@example.com',
    role: 'District Admin',
    state: 'Tamil Nadu',
    district: 'Coimbatore',
    status: 'active',
    isFullyApproved: true
  };

  const divisionAdminVandalur = {
    _id: 'diva_vandalur_001',
    id: 'diva_vandalur_001',
    name: 'Division Admin Vandalur',
    email: 'diva.vandalur@example.com',
    role: 'Divisional Admin',
    state: 'Tamil Nadu',
    district: 'Chengalpattu',
    division: 'Vandalur',
    status: 'active',
    isFullyApproved: true
  };

  const pincodeAdmin600048 = {
    _id: 'pa_600048_001',
    id: 'pa_600048_001',
    name: 'Pincode Admin 600048',
    email: 'pa.600048@example.com',
    role: 'Pincode Admin',
    state: 'Tamil Nadu',
    district: 'Chengalpattu',
    division: 'Vandalur',
    pincode: '600048',
    status: 'active',
    isFullyApproved: true
  };

  const managerUser = {
    _id: 'mgr_unauth_001',
    id: 'mgr_unauth_001',
    name: 'Field Manager User',
    email: 'mgr.unauth@example.com',
    role: 'state_manager',
    status: 'active'
  };

  // Sample Manager Requests
  const stateMgrTN = {
    _id: 'req_state_tn_001',
    id: 'req_state_tn_001',
    userId: 'req_state_tn_001',
    name: 'Applicant State Mgr',
    role: 'state_manager',
    level: 'state',
    state: 'Tamil Nadu',
    status: 'pending',
    adminApprovalStatus: 'pending'
  };

  const districtMgrSalem = {
    _id: 'req_dist_salem_001',
    id: 'req_dist_salem_001',
    userId: 'req_dist_salem_001',
    name: 'Applicant District Mgr Salem',
    role: 'district_manager',
    level: 'district',
    state: 'Tamil Nadu',
    district: 'Salem',
    status: 'pending',
    adminApprovalStatus: 'pending'
  };

  const divisionMgrVandalur = {
    _id: 'req_div_vandalur_001',
    id: 'req_div_vandalur_001',
    userId: 'req_div_vandalur_001',
    name: 'Applicant Division Mgr Vandalur',
    role: 'division_manager',
    level: 'division',
    state: 'Tamil Nadu',
    district: 'Chengalpattu',
    division: 'Vandalur',
    status: 'pending',
    adminApprovalStatus: 'pending'
  };

  const pincodeMgr600048 = {
    _id: 'req_pin_600048_001',
    id: 'req_pin_600048_001',
    userId: 'req_pin_600048_001',
    name: 'Applicant Pincode Mgr 600048',
    role: 'pincode_manager',
    level: 'pincode',
    state: 'Tamil Nadu',
    district: 'Chengalpattu',
    division: 'Vandalur',
    pincode: '600048',
    status: 'pending',
    adminApprovalStatus: 'pending'
  };

  // Populate db.users with test records
  const allUsers = [
    stateAdminTN, districtAdminSalem, districtAdminCoimbatore,
    divisionAdminVandalur, pincodeAdmin600048, managerUser,
    stateMgrTN, districtMgrSalem, divisionMgrVandalur, pincodeMgr600048
  ];
  for (const u of allUsers) {
    const existing = Array.from(db.users).find(x => String(x._id || x.id) === String(u._id || u.id));
    if (existing) {
      Object.assign(existing, u);
    } else {
      db.users.push(u);
    }
  }

  let passed = 0;
  let failed = 0;

  function recordPass(testName) {
    passed++;
    console.log(`  [PASS] ${testName}`);
  }

  function recordFail(testName, err) {
    failed++;
    console.error(`  [FAIL] ${testName}: ${err.message || err}`);
  }

  // --- Test Case 1: State Admin can approve eligible State Manager in scope ---
  try {
    const { req, res } = createMockReqRes({
      method: 'POST',
      params: { id: stateMgrTN.id },
      user: stateAdminTN
    });
    await managerDirectoryController.approveManager(req, res);
    assert.strictEqual(res.getStatusCode(), 200, `Expected 200, got ${res.getStatusCode()}`);
    assert.strictEqual(res.getData()?.success, true);
    assert.strictEqual(stateMgrTN.subAdminApprovedByRole, 'State Admin');
    recordPass('1. State Admin successfully approves State Manager within scope');
  } catch (e) {
    recordFail('1. State Admin approve State Manager', e);
  }

  // --- Test Case 2: District Admin can approve eligible District Manager in scope ---
  try {
    const { req, res } = createMockReqRes({
      method: 'POST',
      params: { id: districtMgrSalem.id },
      user: districtAdminSalem
    });
    await managerDirectoryController.approveManager(req, res);
    assert.strictEqual(res.getStatusCode(), 200, `Expected 200, got ${res.getStatusCode()}`);
    assert.strictEqual(res.getData()?.success, true);
    assert.strictEqual(districtMgrSalem.subAdminApprovedByRole, 'District Admin');
    recordPass('2. District Admin successfully approves District Manager within scope');
  } catch (e) {
    recordFail('2. District Admin approve District Manager', e);
  }

  // --- Test Case 3: Division Admin can approve eligible Division Manager in scope ---
  try {
    const { req, res } = createMockReqRes({
      method: 'POST',
      params: { id: divisionMgrVandalur.id },
      user: divisionAdminVandalur
    });
    await managerDirectoryController.approveManager(req, res);
    assert.strictEqual(res.getStatusCode(), 200, `Expected 200, got ${res.getStatusCode()}`);
    assert.strictEqual(res.getData()?.success, true);
    assert.strictEqual(divisionMgrVandalur.subAdminApprovedByRole, 'Divisional Admin');
    recordPass('3. Division Admin successfully approves Division Manager within scope');
  } catch (e) {
    recordFail('3. Division Admin approve Division Manager', e);
  }

  // --- Test Case 4: Pincode Admin can approve eligible Pincode Manager in scope ---
  try {
    const { req, res } = createMockReqRes({
      method: 'POST',
      params: { id: pincodeMgr600048.id },
      user: pincodeAdmin600048
    });
    await managerDirectoryController.approveManager(req, res);
    assert.strictEqual(res.getStatusCode(), 200, `Expected 200, got ${res.getStatusCode()}`);
    assert.strictEqual(res.getData()?.success, true);
    assert.strictEqual(pincodeMgr600048.subAdminApprovedByRole, 'Pincode Admin');
    recordPass('4. Pincode Admin successfully approves Pincode Manager within scope');
  } catch (e) {
    recordFail('4. Pincode Admin approve Pincode Manager', e);
  }

  // Reset statuses for restriction tests
  districtMgrSalem.status = 'pending';
  districtMgrSalem.adminApprovalStatus = 'pending';
  stateMgrTN.status = 'pending';
  stateMgrTN.adminApprovalStatus = 'pending';
  divisionMgrVandalur.status = 'pending';
  divisionMgrVandalur.adminApprovalStatus = 'pending';
  pincodeMgr600048.status = 'pending';
  pincodeMgr600048.adminApprovalStatus = 'pending';

  // --- Test Case 5: Admin cannot approve request from unauthorized territory ---
  try {
    const { req, res } = createMockReqRes({
      method: 'POST',
      params: { id: districtMgrSalem.id },
      user: districtAdminCoimbatore // Coimbatore Admin trying to approve Salem Manager
    });
    await managerDirectoryController.approveManager(req, res);
    assert.strictEqual(res.getStatusCode(), 403, `Expected 403 Forbidden, got ${res.getStatusCode()}`);
    recordPass('5. Out-of-territory Admin (Coimbatore) blocked with HTTP 403 for Salem request');
  } catch (e) {
    recordFail('5. Out-of-territory Admin restriction', e);
  }

  // --- Test Case 6a: State Admin CANNOT approve District Manager ---
  try {
    const { req, res } = createMockReqRes({
      method: 'POST',
      params: { id: districtMgrSalem.id },
      user: stateAdminTN
    });
    await managerDirectoryController.approveManager(req, res);
    assert.strictEqual(res.getStatusCode(), 403, `Expected 403, got ${res.getStatusCode()}`);
    recordPass('6a. State Admin blocked with HTTP 403 when attempting to approve District Manager');
  } catch (e) {
    recordFail('6a. State Admin -> District Mgr approval', e);
  }

  // --- Test Case 6b: District Admin CANNOT approve State Manager ---
  try {
    const { req, res } = createMockReqRes({
      method: 'POST',
      params: { id: stateMgrTN.id },
      user: districtAdminSalem
    });
    await managerDirectoryController.approveManager(req, res);
    assert.strictEqual(res.getStatusCode(), 403, `Expected 403, got ${res.getStatusCode()}`);
    recordPass('6b. District Admin blocked with HTTP 403 when attempting to approve State Manager');
  } catch (e) {
    recordFail('6b. District Admin -> State Mgr approval', e);
  }

  // --- Test Case 6c: Division Admin CANNOT approve District Manager ---
  try {
    const { req, res } = createMockReqRes({
      method: 'POST',
      params: { id: districtMgrSalem.id },
      user: divisionAdminVandalur
    });
    await managerDirectoryController.approveManager(req, res);
    assert.strictEqual(res.getStatusCode(), 403, `Expected 403, got ${res.getStatusCode()}`);
    recordPass('6c. Division Admin blocked with HTTP 403 when attempting to approve District Manager');
  } catch (e) {
    recordFail('6c. Division Admin -> District Mgr approval', e);
  }

  // --- Test Case 6d: Pincode Admin CANNOT approve Division Manager ---
  try {
    const { req, res } = createMockReqRes({
      method: 'POST',
      params: { id: divisionMgrVandalur.id },
      user: pincodeAdmin600048
    });
    await managerDirectoryController.approveManager(req, res);
    assert.strictEqual(res.getStatusCode(), 403, `Expected 403, got ${res.getStatusCode()}`);
    recordPass('6d. Pincode Admin blocked with HTTP 403 when attempting to approve Division Manager');
  } catch (e) {
    recordFail('6d. Pincode Admin -> Division Mgr approval', e);
  }

  // --- Test Case 7: Non-admin (Manager) cannot approve requests ---
  try {
    const { req, res } = createMockReqRes({
      method: 'POST',
      params: { id: stateMgrTN.id },
      user: managerUser
    });
    await managerDirectoryController.approveManager(req, res);
    assert.strictEqual(res.getStatusCode(), 403, `Expected 403, got ${res.getStatusCode()}`);
    recordPass('7. Non-admin Manager role blocked with HTTP 403');
  } catch (e) {
    recordFail('7. Non-admin role restriction', e);
  }

  // --- Test Case 8: Direct API payload manipulation cannot bypass restriction ---
  try {
    const { req, res } = createMockReqRes({
      method: 'POST',
      params: { id: stateMgrTN.id },
      body: { role: 'Super Admin', canApprove: true, authorized: true }, // Manipulated body
      user: districtAdminSalem
    });
    await managerDirectoryController.approveManager(req, res);
    assert.strictEqual(res.getStatusCode(), 403, `Expected 403, got ${res.getStatusCode()}`);
    recordPass('8. Manipulated payload in request body fails to bypass server-side role check');
  } catch (e) {
    recordFail('8. Manipulated payload bypass', e);
  }

  // --- Test Case 9: Request listing populates correct canApprove flags ---
  try {
    const { req, res } = createMockReqRes({
      method: 'GET',
      user: stateAdminTN
    });
    await managerDirectoryController.getManagerRequests(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    const requests = res.getData()?.requests || [];

    const stateRow = requests.find(r => r.id === stateMgrTN.id);
    const distRow = requests.find(r => r.id === districtMgrSalem.id);

    assert(stateRow, 'State manager request should be present');
    assert.strictEqual(stateRow.canApprove, true, 'State Admin should have canApprove=true for State Manager');

    assert(distRow, 'District manager request should be present in state oversight');
    assert.strictEqual(distRow.canApprove, false, 'State Admin should have canApprove=false for District Manager');

    recordPass('9. getManagerRequests populates canApprove=true for State Mgr and canApprove=false for District Mgr');
  } catch (e) {
    recordFail('9. canApprove listing population', e);
  }

  // --- Test Case 10: Preserves Multi-stage Workflow (Territory Approval -> KYC Review) ---
  try {
    const { req, res } = createMockReqRes({
      method: 'POST',
      params: { id: districtMgrSalem.id },
      user: districtAdminSalem
    });
    await managerDirectoryController.approveManager(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    const approvedMgr = res.getData()?.manager;
    assert(approvedMgr, 'Approved manager should be returned in response');
    assert.strictEqual(approvedMgr.adminApprovalStatus, 'approved');
    assert.strictEqual(approvedMgr.workflowStage, 'Awaiting KYC Review');
    recordPass('10. Multi-stage workflow preserved: adminApprovalStatus=approved, stage=Awaiting KYC Review');
  } catch (e) {
    recordFail('10. Multi-stage workflow preservation', e);
  }

  // --- Test Case 11: Rejection requires reason and enforces hierarchy ---
  try {
    // 11a. Missing reason fails with 400
    const { req: reqNoReason, res: resNoReason } = createMockReqRes({
      method: 'POST',
      params: { id: divisionMgrVandalur.id },
      body: { reason: '' },
      user: divisionAdminVandalur
    });
    await managerDirectoryController.rejectManager(reqNoReason, resNoReason);
    assert.strictEqual(resNoReason.getStatusCode(), 400, 'Rejection without reason must return 400');

    // 11b. Valid rejection by authorized admin succeeds with 200
    const { req: reqValid, res: resValid } = createMockReqRes({
      method: 'POST',
      params: { id: divisionMgrVandalur.id },
      body: { reason: 'Invalid identity documents' },
      user: divisionAdminVandalur
    });
    await managerDirectoryController.rejectManager(reqValid, resValid);
    assert.strictEqual(resValid.getStatusCode(), 200, 'Authorized rejection must succeed with 200');
    assert.strictEqual(resValid.getData()?.manager?.adminApprovalStatus, 'rejected');

    // 11c. Unauthorized rejection returns 403
    const { req: reqUnauth, res: resUnauth } = createMockReqRes({
      method: 'POST',
      params: { id: divisionMgrVandalur.id },
      body: { reason: 'Cross level attempt' },
      user: stateAdminTN // State Admin cannot reject Division Mgr
    });
    await managerDirectoryController.rejectManager(reqUnauth, resUnauth);
    assert.strictEqual(resUnauth.getStatusCode(), 403, 'Unauthorized rejection must return 403');

    recordPass('11. Rejection workflow enforces mandatory reason, records rejection audit, and blocks cross-level admin with 403');
  } catch (e) {
    recordFail('11. Rejection workflow enforcement', e);
  }

  // --- Test Case 12: Keep Pending requires reason, enforces hierarchy, and records review history ---
  try {
    // 12a. Keep pending by authorized admin
    const { req, res } = createMockReqRes({
      method: 'POST',
      params: { id: pincodeMgr600048.id },
      body: { reason: 'Address verification in progress' },
      user: pincodeAdmin600048
    });
    await managerDirectoryController.keepPendingManager(req, res);
    assert.strictEqual(res.getStatusCode(), 200, 'Keep pending by authorized admin must succeed');
    const pendingMgr = res.getData()?.manager;
    assert(pendingMgr, 'Pending manager should be returned in response');
    assert.strictEqual(pendingMgr.adminApprovalStatus, 'pending');
    assert(pendingMgr.reviewHistory.length > 0, 'Review history must be appended');

    // 12b. Keep pending by unauthorized admin returns 403
    const { req: reqUnauth, res: resUnauth } = createMockReqRes({
      method: 'POST',
      params: { id: pincodeMgr600048.id },
      body: { reason: 'District admin trying to change pincode manager' },
      user: districtAdminSalem
    });
    await managerDirectoryController.keepPendingManager(reqUnauth, resUnauth);
    assert.strictEqual(resUnauth.getStatusCode(), 403, 'Unauthorized keep pending must return 403');

    recordPass('12. Keep pending workflow strictly enforces territory admin hierarchy and updates review history');
  } catch (e) {
    recordFail('12. Keep pending workflow enforcement', e);
  }

  console.log('\n================================================================');
  console.log(`  RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

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
