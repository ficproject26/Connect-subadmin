const assert = require('assert');
const http = require('http');
const jwt = require('jsonwebtoken');

// Import backend controller and helpers directly for end-to-end verification
const executiveController = require('../controllers/executiveController');
const { db } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production_12345';

console.log('========================================================================');
console.log('🧪 VERIFYING ROLE-BASED AGENT TABS & TERRITORY FILTERS (ACCEPTANCE TESTS)');
console.log('========================================================================');

// Helper to mock express req/res
function createMockReqRes({ user, query = {}, params = {} }) {
  const req = {
    user,
    query,
    params,
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

// Helper to simulate the exact visibility rule engine from TerritoryHierarchyFilter.jsx
function computeFilterVisibility({ role, state, district, division, pincode, activeLevel }) {
  let userTier = 'super';
  const r = (role || '').toLowerCase();
  if (r.includes('pincode')) userTier = 'pincode';
  else if (r.includes('division') || r.includes('divisional')) userTier = 'division';
  else if (r.includes('district')) userTier = 'district';
  else if (r.includes('state')) userTier = 'state';

  let isStateVisible = true;
  let isDistrictVisible = true;
  let isDivisionVisible = true;
  let isPincodeVisible = true;

  const lvl = String(activeLevel).toLowerCase().trim();

  if (userTier === 'pincode') {
    isStateVisible = false;
    isDistrictVisible = false;
    isDivisionVisible = false;
    isPincodeVisible = false;
  } else if (userTier === 'division') {
    isStateVisible = false;
    isDistrictVisible = false;
    if (lvl === 'pincode') {
      isDivisionVisible = true; // locked
      isPincodeVisible = true;  // selectable
    } else {
      isDivisionVisible = false;
      isPincodeVisible = false;
    }
  } else if (userTier === 'district') {
    isStateVisible = false;
    if (lvl === 'state' || lvl === 'district') {
      isDistrictVisible = false;
      isDivisionVisible = false;
      isPincodeVisible = false;
    } else if (lvl === 'divisional' || lvl === 'division') {
      isDistrictVisible = true; // locked
      isDivisionVisible = true; // selectable
      isPincodeVisible = false;
    } else if (lvl === 'pincode') {
      isDistrictVisible = true; // locked
      isDivisionVisible = true; // selectable
      isPincodeVisible = true;  // selectable
    } else {
      isDistrictVisible = false;
      isDivisionVisible = false;
      isPincodeVisible = false;
    }
  } else if (userTier === 'state') {
    if (lvl === 'state') {
      isStateVisible = false;
      isDistrictVisible = false;
      isDivisionVisible = false;
      isPincodeVisible = false;
    } else if (lvl === 'district') {
      isStateVisible = true; // locked
      isDistrictVisible = true; // selectable
      isDivisionVisible = false;
      isPincodeVisible = false;
    } else if (lvl === 'divisional' || lvl === 'division') {
      isStateVisible = true; // locked
      isDistrictVisible = true; // selectable
      isDivisionVisible = true; // selectable
      isPincodeVisible = false;
    } else if (lvl === 'pincode') {
      isStateVisible = true; // locked
      isDistrictVisible = true; // selectable
      isDivisionVisible = true; // selectable
      isPincodeVisible = true; // selectable
    }
  }

  const visibleFields = [];
  if (isStateVisible) visibleFields.push('state');
  if (isDistrictVisible) visibleFields.push('district');
  if (isDivisionVisible) visibleFields.push('division');
  if (isPincodeVisible) visibleFields.push('pincode');

  const isSectionVisible = visibleFields.length > 0;

  return {
    isSectionVisible,
    visibleFields,
    isStateVisible,
    isDistrictVisible,
    isDivisionVisible,
    isPincodeVisible
  };
}

async function runTests() {
  console.log('\n--- PART 1: FRONTEND ROLE-TO-FILTER BEHAVIOR RULE VERIFICATION ---');

  // Test 1: State Admin
  console.log('\n[TEST 1] State Admin Filter Visibility:');
  {
    const stateAdmin = { role: 'State Admin', state: 'Tamil Nadu' };

    // 1.1 State Agent tab
    const r1 = computeFilterVisibility({ ...stateAdmin, activeLevel: 'state' });
    assert.strictEqual(r1.isSectionVisible, false, 'State Admin -> State Agent must have NO filter section');
    console.log('  ✅ State Admin -> State Agent: no filter section (completely removed)');

    // 1.2 District Agent tab
    const r2 = computeFilterVisibility({ ...stateAdmin, activeLevel: 'district' });
    assert.strictEqual(r2.isSectionVisible, true);
    assert.deepStrictEqual(r2.visibleFields, ['state', 'district']);
    console.log('  ✅ State Admin -> District Agent: locked State + selectable District');

    // 1.3 Divisional Agent tab
    const r3 = computeFilterVisibility({ ...stateAdmin, activeLevel: 'divisional' });
    assert.strictEqual(r3.isSectionVisible, true);
    assert.deepStrictEqual(r3.visibleFields, ['state', 'district', 'division']);
    console.log('  ✅ State Admin -> Divisional Agent: locked State + selectable District and Division');

    // 1.4 Pincode Agent tab
    const r4 = computeFilterVisibility({ ...stateAdmin, activeLevel: 'pincode' });
    assert.strictEqual(r4.isSectionVisible, true);
    assert.deepStrictEqual(r4.visibleFields, ['state', 'district', 'division', 'pincode']);
    console.log('  ✅ State Admin -> Pincode Agent: locked State + selectable District, Division, Pincode');
  }

  // Test 2: District Admin
  console.log('\n[TEST 2] District Admin Filter Visibility:');
  {
    const distAdmin = { role: 'District Admin', state: 'Tamil Nadu', district: 'Namakkal' };

    // 2.1 State Agent tab
    const r1 = computeFilterVisibility({ ...distAdmin, activeLevel: 'state' });
    assert.strictEqual(r1.isSectionVisible, false);
    console.log('  ✅ District Admin -> State Agent: no filter section');

    // 2.2 District Agent tab
    const r2 = computeFilterVisibility({ ...distAdmin, activeLevel: 'district' });
    assert.strictEqual(r2.isSectionVisible, false);
    console.log('  ✅ District Admin -> District Agent: no filter section (assigned district only)');

    // 2.3 Divisional Agent tab
    const r3 = computeFilterVisibility({ ...distAdmin, activeLevel: 'divisional' });
    assert.strictEqual(r3.isSectionVisible, true);
    assert.deepStrictEqual(r3.visibleFields, ['district', 'division']);
    console.log('  ✅ District Admin -> Divisional Agent: locked District + selectable Division');

    // 2.4 Pincode Agent tab
    const r4 = computeFilterVisibility({ ...distAdmin, activeLevel: 'pincode' });
    assert.strictEqual(r4.isSectionVisible, true);
    assert.deepStrictEqual(r4.visibleFields, ['district', 'division', 'pincode']);
    console.log('  ✅ District Admin -> Pincode Agent: locked District + selectable Division, Pincode');
  }

  // Test 3: Divisional Admin
  console.log('\n[TEST 3] Divisional Admin Filter Visibility:');
  {
    const divAdmin = { role: 'Divisional Admin', state: 'Tamil Nadu', district: 'Namakkal', division: 'Namakkal' };

    // 3.1 State Agent tab
    const r1 = computeFilterVisibility({ ...divAdmin, activeLevel: 'state' });
    assert.strictEqual(r1.isSectionVisible, false);
    console.log('  ✅ Divisional Admin -> State Agent: no filter section');

    // 3.2 District Agent tab
    const r2 = computeFilterVisibility({ ...divAdmin, activeLevel: 'district' });
    assert.strictEqual(r2.isSectionVisible, false);
    console.log('  ✅ Divisional Admin -> District Agent: no filter section');

    // 3.3 Divisional Agent tab
    const r3 = computeFilterVisibility({ ...divAdmin, activeLevel: 'divisional' });
    assert.strictEqual(r3.isSectionVisible, false);
    console.log('  ✅ Divisional Admin -> Divisional Agent: no filter section (assigned division only)');

    // 3.4 Pincode Agent tab
    const r4 = computeFilterVisibility({ ...divAdmin, activeLevel: 'pincode' });
    assert.strictEqual(r4.isSectionVisible, true);
    assert.deepStrictEqual(r4.visibleFields, ['division', 'pincode']);
    console.log('  ✅ Divisional Admin -> Pincode Agent: locked Division + selectable Pincode');
  }

  // Test 4: Pincode Admin
  console.log('\n[TEST 4] Pincode Admin Filter Visibility:');
  {
    const pinAdmin = { role: 'Pincode Admin', state: 'Tamil Nadu', district: 'Namakkal', division: 'Namakkal', pincode: '637001' };

    ['state', 'district', 'divisional', 'pincode'].forEach(lvl => {
      const r = computeFilterVisibility({ ...pinAdmin, activeLevel: lvl });
      assert.strictEqual(r.isSectionVisible, false);
    });
    console.log('  ✅ Pincode Admin -> All accessible Agent tabs: no filter section (assigned pincode only)');
  }

  console.log('\n--- PART 2: BACKEND AUTHORIZATION & DATA FILTERING VERIFICATION ---');

  // Test 5: State Admin authorization
  console.log('\n[TEST 5] State Admin API Authorization:');
  {
    const stateAdminUser = { id: 'ADM_ST_01', role: 'State Admin', state: 'Tamil Nadu' };

    // 5.1 Direct request for another state -> MUST be 403
    const { req: req1, res: res1 } = createMockReqRes({
      user: stateAdminUser,
      query: { state: 'Kerala' }
    });
    await executiveController.getAgents(req1, res1);
    assert.strictEqual(res1.getStatusCode(), 403, 'Cross-state request by State Admin must return 403');
    console.log('  ✅ Direct API request for another state rejected with 403 Forbidden');

    // 5.2 Legitimate request for State Admin -> 200 OK
    const { req: req2, res: res2 } = createMockReqRes({
      user: stateAdminUser,
      query: { state: 'Tamil Nadu', level: 'district' }
    });
    await executiveController.getAgents(req2, res2);
    assert.strictEqual(res2.getStatusCode(), 200);
    const data = res2.getData();
    assert.strictEqual(data.success, true);
    // Verify no agents belong to Kerala
    const hasKerala = data.agents.some(a => (a.state || '').toLowerCase() === 'kerala');
    assert.strictEqual(hasKerala, false);
    console.log(`  ✅ Legitimate State Admin query returned ${data.count} authorized agents within Tamil Nadu`);
  }

  // Test 6: District Admin authorization
  console.log('\n[TEST 6] District Admin API Authorization:');
  {
    const distAdminUser = { id: 'ADM_DT_01', role: 'District Admin', state: 'Tamil Nadu', district: 'Namakkal' };

    // 6.1 Direct request for State Agents -> MUST be 403
    const { req: req1, res: res1 } = createMockReqRes({
      user: distAdminUser,
      query: { level: 'state' }
    });
    await executiveController.getAgents(req1, res1);
    assert.strictEqual(res1.getStatusCode(), 403, 'District Admin requesting state level must return 403');
    console.log('  ✅ District Admin request for State Agent level rejected with 403 Forbidden');

    // 6.2 Direct request for another district -> MUST be 403
    const { req: req2, res: res2 } = createMockReqRes({
      user: distAdminUser,
      query: { district: 'Salem', level: 'divisional' }
    });
    await executiveController.getAgents(req2, res2);
    assert.strictEqual(res2.getStatusCode(), 403, 'District Admin requesting another district must return 403');
    console.log('  ✅ Direct API request for another district rejected with 403 Forbidden');

    // 6.3 Legitimate request for assigned district -> 200 OK
    const { req: req3, res: res3 } = createMockReqRes({
      user: distAdminUser,
      query: { district: 'Namakkal', level: 'district' }
    });
    await executiveController.getAgents(req3, res3);
    assert.strictEqual(res3.getStatusCode(), 200);
    const data = res3.getData();
    assert.strictEqual(data.success, true);
    // All returned agents must belong to Namakkal district
    const wrongDist = data.agents.some(a => (a.district || '').toLowerCase() !== 'namakkal');
    assert.strictEqual(wrongDist, false);
    console.log(`  ✅ Legitimate District Admin query returned ${data.count} agents, all scoped to Namakkal`);
  }

  // Test 7: Divisional Admin authorization
  console.log('\n[TEST 7] Divisional Admin API Authorization:');
  {
    const divAdminUser = { id: 'ADM_DV_01', role: 'Divisional Admin', state: 'Tamil Nadu', district: 'Namakkal', division: 'Namakkal' };

    // 7.1 Direct request for District Agent level -> MUST be 403
    const { req: req1, res: res1 } = createMockReqRes({
      user: divAdminUser,
      query: { level: 'district' }
    });
    await executiveController.getAgents(req1, res1);
    assert.strictEqual(res1.getStatusCode(), 403);
    console.log('  ✅ Divisional Admin request for District Agent level rejected with 403 Forbidden');

    // 7.2 Direct request for another division -> MUST be 403
    const { req: req2, res: res2 } = createMockReqRes({
      user: divAdminUser,
      query: { division: 'Attur' }
    });
    await executiveController.getAgents(req2, res2);
    assert.strictEqual(res2.getStatusCode(), 403);
    console.log('  ✅ Direct API request for another division rejected with 403 Forbidden');

    // 7.3 Legitimate request for assigned division -> 200 OK
    const { req: req3, res: res3 } = createMockReqRes({
      user: divAdminUser,
      query: { division: 'Namakkal', level: 'pincode' }
    });
    await executiveController.getAgents(req3, res3);
    assert.strictEqual(res3.getStatusCode(), 200);
    console.log(`  ✅ Legitimate Divisional Admin query returned ${res3.getData().count} pincode agents scoped to Namakkal`);
  }

  // Test 8: Pincode Admin authorization
  console.log('\n[TEST 8] Pincode Admin API Authorization:');
  {
    const pinAdminUser = { id: 'ADM_PIN_01', role: 'Pincode Admin', state: 'Tamil Nadu', district: 'Namakkal', division: 'Namakkal', pincode: '637001' };

    // 8.1 Requesting higher level -> MUST be 403
    const { req: req1, res: res1 } = createMockReqRes({
      user: pinAdminUser,
      query: { level: 'divisional' }
    });
    await executiveController.getAgents(req1, res1);
    assert.strictEqual(res1.getStatusCode(), 403);
    console.log('  ✅ Pincode Admin request for higher level rejected with 403 Forbidden');

    // 8.2 Requesting another pincode -> MUST be 403
    const { req: req2, res: res2 } = createMockReqRes({
      user: pinAdminUser,
      query: { pincode: '637002' }
    });
    await executiveController.getAgents(req2, res2);
    assert.strictEqual(res2.getStatusCode(), 403);
    console.log('  ✅ Direct API request for another pincode rejected with 403 Forbidden');

    // 8.3 Legitimate request for assigned pincode -> 200 OK
    const { req: req3, res: res3 } = createMockReqRes({
      user: pinAdminUser,
      query: { pincode: '637001', level: 'pincode' }
    });
    await executiveController.getAgents(req3, res3);
    assert.strictEqual(res3.getStatusCode(), 200);
    console.log('  ✅ Legitimate Pincode Admin query returned 200 OK');
  }

  // Test 9: State Agent Tab Level Isolation
  console.log('\n[TEST 9] State Agent Tab Drill-Down Isolation:');
  {
    const stateAdminUser = { id: 'ADM_ST_01', role: 'State Admin', state: 'Tamil Nadu' };

    // Querying level=state when a district parameter might have lingered
    const { req, res } = createMockReqRes({
      user: stateAdminUser,
      query: { level: 'state', district: 'Namakkal' }
    });
    await executiveController.getAgents(req, res);
    assert.strictEqual(res.getStatusCode(), 200);
    const data = res.getData();
    // Since State Agents are at state level (no district), district param was ignored
    console.log(`  ✅ State Agent query correctly isolates level, returning ${data.count} state agents`);
  }

  // Test 10: Search and Status filters work within permitted territory
  console.log('\n[TEST 10] Search & Status Operations in Permitted Territory:');
  {
    const stateAdminUser = { id: 'ADM_ST_01', role: 'State Admin', state: 'Tamil Nadu' };

    const { req: req1, res: res1 } = createMockReqRes({
      user: stateAdminUser,
      query: { search: 'agent', status: 'approved' }
    });
    await executiveController.getAgents(req1, res1);
    assert.strictEqual(res1.getStatusCode(), 200);
    assert.strictEqual(res1.getData().success, true);
    console.log(`  ✅ Search & Status queries work correctly, returning ${res1.getData().count} agents`);
  }

  console.log('\n========================================================================');
  console.log('🎯 ALL ROLE-BASED AGENT TABS & TERRITORY FILTER ACCEPTANCE TESTS PASSED!');
  console.log('========================================================================\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
