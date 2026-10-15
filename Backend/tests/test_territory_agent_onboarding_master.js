const assert = require('assert');
const executiveController = require('../controllers/executiveController');
const { db, initDatabase } = require('../config/db');

console.log('========================================================================');
console.log('🧪 TERRITORY-BASED AGENT ONBOARDING & APPROVAL WORKFLOW TEST SUITE');
console.log('========================================================================\n');

function createMockReqRes({ user, body = {}, query = {}, params = {} }) {
  const req = {
    user,
    body,
    query,
    params,
    ip: '127.0.0.1',
    headers: {}
  };

  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    getStatusCode() {
      return statusCode;
    },
    getData() {
      return responseData;
    }
  };

  return { req, res };
}

async function runTests() {
  await initDatabase();

  let passed = 0;
  let failed = 0;

  function record(desc, cond) {
    if (cond) {
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      failed++;
    }
  }

  const runTag = Date.now().toString().slice(-5);
  // Generate valid 10-digit mobile numbers: 2 + 5 + 3 = 10 digits
  const makePhone = (n) => `98${runTag}${String(n).padStart(3, '0')}`;

  // Setup test users
  const stateAdminTN = {
    _id: 'user-tn-state',
    name: 'State Admin TN',
    email: 'state_tn@example.com',
    role: 'State Admin',
    state: 'Tamil Nadu',
    stateId: 'ST-TN-001'
  };

  const districtAdminSalem = {
    _id: 'user-salem-dist',
    name: 'Salem District Admin',
    email: 'salem_dist@example.com',
    role: 'District Admin',
    state: 'Tamil Nadu',
    district: 'Salem',
    stateId: 'ST-TN-001',
    districtId: 'DT-SLM-001'
  };

  const divisionAdminSalemNorth = {
    _id: 'user-salem-north-div',
    name: 'Salem North Division Admin',
    email: 'salem_north_div@example.com',
    role: 'Division Admin',
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Salem North',
    stateId: 'ST-TN-001',
    districtId: 'DT-SLM-001',
    divisionId: 'DIV-SLMN-001'
  };

  const pincodeAdmin636001 = {
    _id: 'user-pin-636001',
    name: 'Pincode Admin 636001',
    email: 'pin_636001@example.com',
    role: 'Pincode Admin',
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Salem North',
    pincode: '636001',
    stateId: 'ST-TN-001',
    districtId: 'DT-SLM-001',
    divisionId: 'DIV-SLMN-001',
    pincodeId: 'PIN-636001'
  };

  const managerTN = {
    _id: 'user-mgr-tn',
    name: 'Field Manager TN',
    email: 'mgr_tn@example.com',
    role: 'Manager',
    state: 'Tamil Nadu'
  };

  console.log('--- TEST GROUP 1: Role & Level Authorization Enforcement ---');
  {
    // Non-admin role cannot onboard agents
    const { req, res } = createMockReqRes({
      user: managerTN,
      body: { name: 'Agent Test', mobile: makePhone(1), email: `agent1_${runTag}@test.com` }
    });
    await executiveController.addAgent(req, res);
    record('Non-admin (Manager) cannot onboard agents (403 UNAUTHORIZED_ROLE)', res.getStatusCode() === 403 && res.getData()?.code === 'UNAUTHORIZED_ROLE');
  }

  {
    // State Admin cannot onboard District Agent
    const { req, res } = createMockReqRes({
      user: stateAdminTN,
      body: { name: 'Dist Agent', mobile: makePhone(2), email: `dist1_${runTag}@test.com`, level: 'district' }
    });
    await executiveController.addAgent(req, res);
    record('State Admin cannot onboard District Agent (403 UNAUTHORIZED_LEVEL)', res.getStatusCode() === 403 && res.getData()?.code === 'UNAUTHORIZED_LEVEL');
  }

  {
    // District Admin cannot onboard State Agent
    const { req, res } = createMockReqRes({
      user: districtAdminSalem,
      body: { name: 'State Agent', mobile: makePhone(3), email: `state1_${runTag}@test.com`, level: 'state' }
    });
    await executiveController.addAgent(req, res);
    record('District Admin cannot onboard State Agent (403 UNAUTHORIZED_LEVEL)', res.getStatusCode() === 403 && res.getData()?.code === 'UNAUTHORIZED_LEVEL');
  }

  {
    // Division Admin cannot onboard District Agent
    const { req, res } = createMockReqRes({
      user: divisionAdminSalemNorth,
      body: { name: 'Dist Agent', mobile: makePhone(4), email: `dist2_${runTag}@test.com`, level: 'district' }
    });
    await executiveController.addAgent(req, res);
    record('Division Admin cannot onboard District Agent (403 UNAUTHORIZED_LEVEL)', res.getStatusCode() === 403 && res.getData()?.code === 'UNAUTHORIZED_LEVEL');
  }

  {
    // Pincode Admin cannot onboard Division Agent
    const { req, res } = createMockReqRes({
      user: pincodeAdmin636001,
      body: { name: 'Div Agent', mobile: makePhone(5), email: `div1_${runTag}@test.com`, level: 'division' }
    });
    await executiveController.addAgent(req, res);
    record('Pincode Admin cannot onboard Division Agent (403 UNAUTHORIZED_LEVEL)', res.getStatusCode() === 403 && res.getData()?.code === 'UNAUTHORIZED_LEVEL');
  }

  console.log('\n--- TEST GROUP 2: Territory Restriction Enforcement ---');
  {
    // Tamil Nadu State Admin cannot onboard agent for Karnataka
    const { req, res } = createMockReqRes({
      user: stateAdminTN,
      body: { name: 'Karnataka Agent', mobile: makePhone(6), email: `ka1_${runTag}@test.com`, level: 'state', state: 'Karnataka' }
    });
    await executiveController.addAgent(req, res);
    record('TN State Admin cannot onboard agent for Karnataka (403 UNAUTHORIZED_TERRITORY)', res.getStatusCode() === 403 && res.getData()?.code === 'UNAUTHORIZED_TERRITORY');
  }

  {
    // Salem District Admin cannot onboard agent for Coimbatore
    const { req, res } = createMockReqRes({
      user: districtAdminSalem,
      body: { name: 'Coimbatore Agent', mobile: makePhone(7), email: `cbe1_${runTag}@test.com`, level: 'district', district: 'Coimbatore' }
    });
    await executiveController.addAgent(req, res);
    record('Salem District Admin cannot onboard agent for Coimbatore (403 UNAUTHORIZED_TERRITORY)', res.getStatusCode() === 403 && res.getData()?.code === 'UNAUTHORIZED_TERRITORY');
  }

  {
    // Salem North Division Admin cannot onboard agent for Salem South
    const { req, res } = createMockReqRes({
      user: divisionAdminSalemNorth,
      body: { name: 'South Agent', mobile: makePhone(8), email: `south1_${runTag}@test.com`, level: 'division', division: 'Salem South' }
    });
    await executiveController.addAgent(req, res);
    record('Salem North Division Admin cannot onboard agent for Salem South (403 UNAUTHORIZED_TERRITORY)', res.getStatusCode() === 403 && res.getData()?.code === 'UNAUTHORIZED_TERRITORY');
  }

  {
    // Pincode Admin 636001 cannot onboard agent for 636002
    const { req, res } = createMockReqRes({
      user: pincodeAdmin636001,
      body: { name: 'Pin Agent', mobile: makePhone(9), email: `pin2_${runTag}@test.com`, level: 'pincode', pincode: '636002' }
    });
    await executiveController.addAgent(req, res);
    record('Pincode Admin 636001 cannot onboard agent for 636002 (403 UNAUTHORIZED_TERRITORY)', res.getStatusCode() === 403 && res.getData()?.code === 'UNAUTHORIZED_TERRITORY');
  }

  {
    // Direct API request with manipulated territory ID is rejected
    const { req, res } = createMockReqRes({
      user: districtAdminSalem,
      body: { name: 'Fake ID Agent', mobile: makePhone(10), email: `fakeid_${runTag}@test.com`, level: 'district', district: 'Salem', districtId: 'DT-CBE-999' }
    });
    await executiveController.addAgent(req, res);
    record('Manipulated districtId is rejected (403 UNAUTHORIZED_TERRITORY)', res.getStatusCode() === 403 && res.getData()?.code === 'UNAUTHORIZED_TERRITORY');
  }

  console.log('\n--- TEST GROUP 3: Successful Onboarding & Auto-Prefill ---');
  let onboardedStateAgent = null;
  let onboardedDistrictAgent = null;
  let onboardedDivisionAgent = null;
  let onboardedPincodeAgent = null;

  {
    // State Admin onboards State Agent
    const phoneState = makePhone(11);
    const { req, res } = createMockReqRes({
      user: stateAdminTN,
      body: { name: 'Anand Kumar', mobile: phoneState, email: `anand_${runTag}@example.com`, level: 'state' }
    });
    await executiveController.addAgent(req, res);
    const data = res.getData();
    onboardedStateAgent = data?.agent;
    record('State Admin onboards State Agent successfully (201)', res.getStatusCode() === 201 && data?.success === true);
    record('Territory is strictly prefilled to Tamil Nadu and district is null', onboardedStateAgent?.state === 'Tamil Nadu' && onboardedStateAgent?.district === null);
    record('Initial status is pending and requiresApproval is true', onboardedStateAgent?.status === 'pending' && onboardedStateAgent?.adminApprovalStatus === 'pending' && onboardedStateAgent?.isApproved === false);
  }

  {
    // District Admin onboards District Agent
    const phoneDist = makePhone(12);
    const { req, res } = createMockReqRes({
      user: districtAdminSalem,
      body: { name: 'Balaji Salem', mobile: phoneDist, email: `balaji_${runTag}@example.com`, level: 'district' }
    });
    await executiveController.addAgent(req, res);
    const data = res.getData();
    onboardedDistrictAgent = data?.agent;
    record('District Admin onboards District Agent successfully (201)', res.getStatusCode() === 201 && data?.success === true);
    record('Territory is prefilled with Salem and Tamil Nadu', onboardedDistrictAgent?.district === 'Salem' && onboardedDistrictAgent?.state === 'Tamil Nadu' && onboardedDistrictAgent?.division === null);
  }

  {
    // Division Admin onboards Division Agent
    const phoneDiv = makePhone(13);
    const { req, res } = createMockReqRes({
      user: divisionAdminSalemNorth,
      body: { name: 'Chitra Division', mobile: phoneDiv, email: `chitra_${runTag}@example.com`, level: 'division' }
    });
    await executiveController.addAgent(req, res);
    const data = res.getData();
    onboardedDivisionAgent = data?.agent;
    record('Division Admin onboards Division Agent successfully (201)', res.getStatusCode() === 201 && data?.success === true);
    record('Territory is prefilled with Salem North, Salem, Tamil Nadu', onboardedDivisionAgent?.division === 'Salem North' && onboardedDivisionAgent?.district === 'Salem');
  }

  {
    // Pincode Admin onboards Pincode Agent
    const phonePin = makePhone(14);
    const { req, res } = createMockReqRes({
      user: pincodeAdmin636001,
      body: { name: 'Dinesh Pincode', mobile: phonePin, email: `dinesh_${runTag}@example.com`, level: 'pincode' }
    });
    await executiveController.addAgent(req, res);
    const data = res.getData();
    onboardedPincodeAgent = data?.agent;
    record('Pincode Admin onboards Pincode Agent successfully (201)', res.getStatusCode() === 201 && data?.success === true);
    record('Territory is prefilled with pincode 636001', onboardedPincodeAgent?.pincode === '636001');
  }

  console.log('\n--- TEST GROUP 4: Input Validation & Duplicate Protection ---');
  {
    // Invalid mobile
    const { req, res } = createMockReqRes({
      user: stateAdminTN,
      body: { name: 'Bad Mobile', mobile: '12345', email: `badmobile_${runTag}@example.com`, level: 'state' }
    });
    await executiveController.addAgent(req, res);
    record('Short mobile number rejected (400)', res.getStatusCode() === 400);
  }

  {
    // Invalid email
    const { req, res } = createMockReqRes({
      user: stateAdminTN,
      body: { name: 'Bad Email', mobile: makePhone(15), email: 'notanemail', level: 'state' }
    });
    await executiveController.addAgent(req, res);
    record('Invalid email rejected (400)', res.getStatusCode() === 400);
  }

  {
    // Duplicate agent mobile
    const { req, res } = createMockReqRes({
      user: stateAdminTN,
      body: { name: 'Duplicate Anand', mobile: makePhone(11), email: `another_${runTag}@example.com`, level: 'state' }
    });
    await executiveController.addAgent(req, res);
    record('Duplicate mobile rejected (409 Conflict)', res.getStatusCode() === 409);
  }

  console.log('\n--- TEST GROUP 5: Agent Directory & Requests Scoping ---');
  {
    // Newly onboarded pending agent does NOT appear in active agent roster
    const { req, res } = createMockReqRes({
      user: stateAdminTN,
      query: { level: 'state' }
    });
    await executiveController.getAgents(req, res);
    const activeAgents = res.getData()?.agents || [];
    const foundInActive = activeAgents.some(a => String(a.id || a._id) === String(onboardedStateAgent?.id));
    record('Pending onboarded agent does NOT appear in active roster', !foundInActive);
  }

  {
    // Newly onboarded pending agent DOES appear in getAgentRequests
    const { req, res } = createMockReqRes({
      user: stateAdminTN,
      query: {}
    });
    await executiveController.getAgentRequests(req, res);
    const requests = res.getData()?.requests || [];
    const foundInRequests = requests.some(a => String(a.id || a._id) === String(onboardedStateAgent?.id));
    record('Pending onboarded agent appears in getAgentRequests for authorized admin', foundInRequests);
  }

  {
    // Cross-state isolation: Karnataka admin cannot see Tamil Nadu requests
    const karnatakaStateAdmin = {
      _id: 'user-ka-state',
      name: 'State Admin KA',
      email: 'state_ka@example.com',
      role: 'State Admin',
      state: 'Karnataka'
    };
    const { req, res } = createMockReqRes({
      user: karnatakaStateAdmin,
      query: {}
    });
    await executiveController.getAgentRequests(req, res);
    const kaRequests = res.getData()?.requests || [];
    const tnRequestLeaked = kaRequests.some(a => a.state === 'Tamil Nadu');
    record('Karnataka Admin cannot see Tamil Nadu pending agent requests', !tnRequestLeaked);
  }

  console.log('\n--- TEST GROUP 6: Approval Workflow Authorization ---');
  {
    // Salem District Admin CANNOT approve State Agent
    const { req, res } = createMockReqRes({
      user: districtAdminSalem,
      params: { id: onboardedStateAgent?.id }
    });
    await executiveController.approveAgent(req, res);
    record('District Admin cannot approve State Agent (403 Forbidden)', res.getStatusCode() === 403);
  }

  {
    // State Admin CAN approve State Agent
    const { req, res } = createMockReqRes({
      user: stateAdminTN,
      params: { id: onboardedStateAgent?.id }
    });
    await executiveController.approveAgent(req, res);
    record('State Admin approves State Agent successfully (200 OK)', res.getStatusCode() === 200 && res.getData()?.success === true);

    // After approval, agent appears in active roster
    const { req: reqRoster, res: resRoster } = createMockReqRes({
      user: stateAdminTN,
      query: { level: 'state' }
    });
    await executiveController.getAgents(reqRoster, resRoster);
    const activeList = resRoster.getData()?.agents || [];
    const nowActive = activeList.some(a => String(a.id || a._id) === String(onboardedStateAgent?.id));
    record('Approved agent now appears in active roster', nowActive);
  }

  {
    // District Admin approves District Agent
    const { req, res } = createMockReqRes({
      user: districtAdminSalem,
      params: { id: onboardedDistrictAgent?.id }
    });
    await executiveController.approveAgent(req, res);
    record('District Admin approves District Agent successfully (200 OK)', res.getStatusCode() === 200);
  }

  {
    // Rejection workflow retains rejection reason
    const { req, res } = createMockReqRes({
      user: divisionAdminSalemNorth,
      params: { id: onboardedDivisionAgent?.id },
      body: { reason: 'Incomplete document verification for cluster' }
    });
    await executiveController.rejectAgent(req, res);
    const data = res.getData();
    record('Division Admin can reject request with reason', res.getStatusCode() === 200 && data?.agent?.rejectionReason === 'Incomplete document verification for cluster');
  }

  console.log('\n========================================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

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
