const assert = require('assert');
const executiveController = require('../controllers/executiveController');
const { db } = require('../config/db');

console.log('========================================================================');
console.log('🧪 ROLE-BASED AGENT ONBOARDING RESTRICTIONS VERIFICATION SUITE');
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
  const makePhone = (n) => `91${runTag}${String(n).padStart(3, '0')}`;

  // Mock Admin accounts
  const stateAdmin = {
    id: 'ADM_ST_TN',
    _id: 'ADM_ST_TN',
    name: 'State Admin Tamil Nadu',
    email: 'state_tn@connect.com',
    role: 'State Admin',
    state: 'Tamil Nadu'
  };

  const districtAdmin = {
    id: 'ADM_DT_SALEM',
    _id: 'ADM_DT_SALEM',
    name: 'District Admin Salem',
    email: 'district_salem@connect.com',
    role: 'District Admin',
    state: 'Tamil Nadu',
    district: 'Salem'
  };

  const divisionAdmin = {
    id: 'ADM_DV_SALEM_NORTH',
    _id: 'ADM_DV_SALEM_NORTH',
    name: 'Division Admin Salem North',
    email: 'division_salem_north@connect.com',
    role: 'Division Admin',
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Salem North'
  };

  const pincodeAdmin = {
    id: 'ADM_PIN_636001',
    _id: 'ADM_PIN_636001',
    name: 'Pincode Admin 636001',
    email: 'pin_636001@connect.com',
    role: 'Pincode Admin',
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Salem North',
    pincode: '636001'
  };

  const manager = {
    id: 'MGR_01',
    _id: 'MGR_01',
    name: 'Field Manager',
    email: 'manager@connect.com',
    role: 'Manager',
    state: 'Tamil Nadu'
  };

  console.log('--- TEST GROUP 1: Non-Admin Rejection ---');
  {
    const { req, res } = createMockReqRes({
      user: manager,
      body: { name: 'Manager Agent', mobile: makePhone(1), email: `mgr_agt_${runTag}@test.com` }
    });
    await executiveController.addAgent(req, res);
    record('Non-admin role (Manager) rejected with 403 UNAUTHORIZED_ROLE', res.getStatusCode() === 403 && res.getData()?.code === 'UNAUTHORIZED_ROLE');
  }

  console.log('\n--- TEST GROUP 2: State Admin Onboarding Matrix ---');
  {
    // State Admin CAN create State Agent
    const { req, res } = createMockReqRes({
      user: stateAdmin,
      body: { name: 'State Agent TN', mobile: makePhone(2), email: `st_agt_${runTag}@test.com`, level: 'state' }
    });
    await executiveController.addAgent(req, res);
    record('State Admin can create State Agent (201 Created)', res.getStatusCode() === 201 && res.getData()?.success === true);
    record('Created agent records creator audit metadata', res.getData()?.agent?.creatorId === stateAdmin.id && res.getData()?.agent?.onboardingSource === 'sub_admin_portal');
  }
  {
    // State Admin CANNOT create District Agent
    const { req, res } = createMockReqRes({
      user: stateAdmin,
      body: { name: 'District Agent Attempt', mobile: makePhone(3), email: `st_dt_${runTag}@test.com`, level: 'district' }
    });
    await executiveController.addAgent(req, res);
    record('State Admin cannot create District Agent (403 UNAUTHORIZED_LEVEL)', res.getStatusCode() === 403 && res.getData()?.code === 'UNAUTHORIZED_LEVEL');
  }
  {
    // State Admin CANNOT create Division Agent
    const { req, res } = createMockReqRes({
      user: stateAdmin,
      body: { name: 'Division Agent Attempt', mobile: makePhone(4), email: `st_dv_${runTag}@test.com`, level: 'division' }
    });
    await executiveController.addAgent(req, res);
    record('State Admin cannot create Division Agent (403 UNAUTHORIZED_LEVEL)', res.getStatusCode() === 403 && res.getData()?.code === 'UNAUTHORIZED_LEVEL');
  }
  {
    // State Admin CANNOT create Pincode Agent
    const { req, res } = createMockReqRes({
      user: stateAdmin,
      body: { name: 'Pincode Agent Attempt', mobile: makePhone(5), email: `st_pin_${runTag}@test.com`, level: 'pincode' }
    });
    await executiveController.addAgent(req, res);
    record('State Admin cannot create Pincode Agent (403 UNAUTHORIZED_LEVEL)', res.getStatusCode() === 403 && res.getData()?.code === 'UNAUTHORIZED_LEVEL');
  }

  console.log('\n--- TEST GROUP 3: District Admin Onboarding Matrix ---');
  {
    // District Admin CAN create District Agent
    const { req, res } = createMockReqRes({
      user: districtAdmin,
      body: { name: 'Salem District Agent', mobile: makePhone(6), email: `dt_agt_${runTag}@test.com`, level: 'district' }
    });
    await executiveController.addAgent(req, res);
    record('District Admin can create District Agent (201 Created)', res.getStatusCode() === 201 && res.getData()?.success === true);
  }
  {
    // District Admin CANNOT create State Agent
    const { req, res } = createMockReqRes({
      user: districtAdmin,
      body: { name: 'State Agent Attempt', mobile: makePhone(7), email: `dt_st_${runTag}@test.com`, level: 'state' }
    });
    await executiveController.addAgent(req, res);
    record('District Admin cannot create State Agent (403 UNAUTHORIZED_LEVEL)', res.getStatusCode() === 403 && res.getData()?.code === 'UNAUTHORIZED_LEVEL');
  }
  {
    // District Admin CANNOT create Division Agent
    const { req, res } = createMockReqRes({
      user: districtAdmin,
      body: { name: 'Division Agent Attempt', mobile: makePhone(8), email: `dt_dv_${runTag}@test.com`, level: 'division' }
    });
    await executiveController.addAgent(req, res);
    record('District Admin cannot create Division Agent (403 UNAUTHORIZED_LEVEL)', res.getStatusCode() === 403 && res.getData()?.code === 'UNAUTHORIZED_LEVEL');
  }
  {
    // District Admin CANNOT create Pincode Agent
    const { req, res } = createMockReqRes({
      user: districtAdmin,
      body: { name: 'Pincode Agent Attempt', mobile: makePhone(9), email: `dt_pin_${runTag}@test.com`, level: 'pincode' }
    });
    await executiveController.addAgent(req, res);
    record('District Admin cannot create Pincode Agent (403 UNAUTHORIZED_LEVEL)', res.getStatusCode() === 403 && res.getData()?.code === 'UNAUTHORIZED_LEVEL');
  }

  console.log('\n--- TEST GROUP 4: Division Admin Onboarding Matrix ---');
  {
    // Division Admin CAN create Division Agent
    const { req, res } = createMockReqRes({
      user: divisionAdmin,
      body: { name: 'Salem North Div Agent', mobile: makePhone(10), email: `dv_agt_${runTag}@test.com`, level: 'division' }
    });
    await executiveController.addAgent(req, res);
    record('Division Admin can create Division Agent (201 Created)', res.getStatusCode() === 201 && res.getData()?.success === true);
  }
  {
    // Division Admin CANNOT create State Agent
    const { req, res } = createMockReqRes({
      user: divisionAdmin,
      body: { name: 'State Agent Attempt', mobile: makePhone(11), email: `dv_st_${runTag}@test.com`, level: 'state' }
    });
    await executiveController.addAgent(req, res);
    record('Division Admin cannot create State Agent (403 UNAUTHORIZED_LEVEL)', res.getStatusCode() === 403 && res.getData()?.code === 'UNAUTHORIZED_LEVEL');
  }
  {
    // Division Admin CANNOT create District Agent
    const { req, res } = createMockReqRes({
      user: divisionAdmin,
      body: { name: 'District Agent Attempt', mobile: makePhone(12), email: `dv_dt_${runTag}@test.com`, level: 'district' }
    });
    await executiveController.addAgent(req, res);
    record('Division Admin cannot create District Agent (403 UNAUTHORIZED_LEVEL)', res.getStatusCode() === 403 && res.getData()?.code === 'UNAUTHORIZED_LEVEL');
  }
  {
    // Division Admin CANNOT create Pincode Agent
    const { req, res } = createMockReqRes({
      user: divisionAdmin,
      body: { name: 'Pincode Agent Attempt', mobile: makePhone(13), email: `dv_pin_${runTag}@test.com`, level: 'pincode' }
    });
    await executiveController.addAgent(req, res);
    record('Division Admin cannot create Pincode Agent (403 UNAUTHORIZED_LEVEL)', res.getStatusCode() === 403 && res.getData()?.code === 'UNAUTHORIZED_LEVEL');
  }

  console.log('\n--- TEST GROUP 5: Pincode Admin Onboarding Matrix ---');
  {
    // Pincode Admin CAN create Pincode Agent
    const { req, res } = createMockReqRes({
      user: pincodeAdmin,
      body: { name: 'Pin 636001 Agent', mobile: makePhone(14), email: `pin_agt_${runTag}@test.com`, level: 'pincode' }
    });
    await executiveController.addAgent(req, res);
    record('Pincode Admin can create Pincode Agent (201 Created)', res.getStatusCode() === 201 && res.getData()?.success === true);
  }
  {
    // Pincode Admin CANNOT create State Agent
    const { req, res } = createMockReqRes({
      user: pincodeAdmin,
      body: { name: 'State Agent Attempt', mobile: makePhone(15), email: `pin_st_${runTag}@test.com`, level: 'state' }
    });
    await executiveController.addAgent(req, res);
    record('Pincode Admin cannot create State Agent (403 UNAUTHORIZED_LEVEL)', res.getStatusCode() === 403 && res.getData()?.code === 'UNAUTHORIZED_LEVEL');
  }
  {
    // Pincode Admin CANNOT create District Agent
    const { req, res } = createMockReqRes({
      user: pincodeAdmin,
      body: { name: 'District Agent Attempt', mobile: makePhone(16), email: `pin_dt_${runTag}@test.com`, level: 'district' }
    });
    await executiveController.addAgent(req, res);
    record('Pincode Admin cannot create District Agent (403 UNAUTHORIZED_LEVEL)', res.getStatusCode() === 403 && res.getData()?.code === 'UNAUTHORIZED_LEVEL');
  }
  {
    // Pincode Admin CANNOT create Division Agent
    const { req, res } = createMockReqRes({
      user: pincodeAdmin,
      body: { name: 'Division Agent Attempt', mobile: makePhone(17), email: `pin_dv_${runTag}@test.com`, level: 'division' }
    });
    await executiveController.addAgent(req, res);
    record('Pincode Admin cannot create Division Agent (403 UNAUTHORIZED_LEVEL)', res.getStatusCode() === 403 && res.getData()?.code === 'UNAUTHORIZED_LEVEL');
  }

  console.log('\n--- TEST GROUP 6: Territory Boundary Authorization ---');
  {
    // District Admin attempting outside district
    const { req, res } = createMockReqRes({
      user: districtAdmin,
      body: { name: 'Out of District', mobile: makePhone(18), email: `out_dt_${runTag}@test.com`, level: 'district', district: 'Coimbatore' }
    });
    await executiveController.addAgent(req, res);
    record('District Admin cannot onboard agent for Coimbatore (403 UNAUTHORIZED_TERRITORY)', res.getStatusCode() === 403 && res.getData()?.code === 'UNAUTHORIZED_TERRITORY');
  }
  {
    // Pincode Admin attempting outside pincode
    const { req, res } = createMockReqRes({
      user: pincodeAdmin,
      body: { name: 'Out of Pincode', mobile: makePhone(19), email: `out_pin_${runTag}@test.com`, level: 'pincode', pincode: '636002' }
    });
    await executiveController.addAgent(req, res);
    record('Pincode Admin cannot onboard agent for 636002 (403 UNAUTHORIZED_TERRITORY)', res.getStatusCode() === 403 && res.getData()?.code === 'UNAUTHORIZED_TERRITORY');
  }

  console.log('\n--- TEST GROUP 7: Read-Only Multi-Tab View Permissions ---');
  {
    // District Admin viewing State tab
    const { req, res } = createMockReqRes({
      user: districtAdmin,
      query: { level: 'state' }
    });
    await executiveController.getAgents(req, res);
    record('District Admin can view State Agents tab (200 OK)', res.getStatusCode() === 200);
  }
  {
    // Division Admin viewing District tab
    const { req, res } = createMockReqRes({
      user: divisionAdmin,
      query: { level: 'district' }
    });
    await executiveController.getAgents(req, res);
    record('Division Admin can view District Agents tab (200 OK)', res.getStatusCode() === 200);
  }
  {
    // Pincode Admin viewing Divisional tab
    const { req, res } = createMockReqRes({
      user: pincodeAdmin,
      query: { level: 'division' }
    });
    await executiveController.getAgents(req, res);
    record('Pincode Admin can view Division Agents tab (200 OK)', res.getStatusCode() === 200);
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
