/**
 * Hierarchy-Based Manager Creation Permissions Test Suite
 * Validates strict hierarchy boundaries for State, District, Division, and Pincode Admins.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const assert = require('assert');
const { generateToken } = require('../utils/jwt');
const app = require('../server');
const http = require('http');

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
  console.log('=================================================================');
  console.log('🧪 Running Hierarchy-Based Manager Creation Permissions Test Suite');
  console.log('=================================================================');

  const testPort = 8098;
  testServer = http.createServer(app);
  await new Promise(resolve => testServer.listen(testPort, resolve));
  baseUrl = `http://localhost:${testPort}`;

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // Token helper
  const stateAdminToken = generateToken({
    id: 'admin_state_test_01',
    name: 'Tamil Nadu State Admin',
    email: 'stateadmin_test@ficapp.in',
    role: 'State Admin',
    state: 'Tamil Nadu'
  });

  const districtAdminToken = generateToken({
    id: 'admin_district_test_01',
    name: 'Salem District Admin',
    email: 'distadmin_test@ficapp.in',
    role: 'District Admin',
    state: 'Tamil Nadu',
    district: 'Salem'
  });

  const divisionAdminToken = generateToken({
    id: 'admin_division_test_01',
    name: 'Salem North Division Admin',
    email: 'divadmin_test@ficapp.in',
    role: 'Divisional Admin',
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Salem North'
  });

  const pincodeAdminToken = generateToken({
    id: 'admin_pincode_test_01',
    name: '636001 Pincode Admin',
    email: 'pinadmin_test@ficapp.in',
    role: 'Pincode Admin',
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Salem North',
    pincode: '636001'
  });

  try {
    // -------------------------------------------------------------
    // STATE ADMIN TESTS
    // -------------------------------------------------------------
    await test('1. State Admin CANNOT create District Manager (rejected with 403)', async () => {
      const res = await request('/api/managers', {
        method: 'POST',
        token: stateAdminToken,
        body: {
          name: 'Unauthorized District Mgr',
          email: 'unauth_dm@example.com',
          mobile: '9876500001',
          role: 'district_manager',
          assignedState: 'Tamil Nadu',
          assignedDistrict: 'Salem'
        }
      });
      assert.strictEqual(res.status, 403, `Expected status 403, got ${res.status}`);
      assert.strictEqual(res.data.success, false);
      assert.match(res.data.message, /State Admin can create State Managers only/i);
    });

    await test('2. State Admin CANNOT create Divisional Manager (rejected with 403)', async () => {
      const res = await request('/api/managers', {
        method: 'POST',
        token: stateAdminToken,
        body: {
          name: 'Unauthorized Div Mgr',
          email: 'unauth_div@example.com',
          mobile: '9876500002',
          role: 'division_manager',
          assignedState: 'Tamil Nadu',
          assignedDistrict: 'Salem',
          assignedDivision: 'Salem North'
        }
      });
      assert.strictEqual(res.status, 403, `Expected status 403, got ${res.status}`);
      assert.strictEqual(res.data.success, false);
    });

    await test('3. State Admin CANNOT create Pincode Manager (rejected with 403)', async () => {
      const res = await request('/api/managers', {
        method: 'POST',
        token: stateAdminToken,
        body: {
          name: 'Unauthorized Pin Mgr',
          email: 'unauth_pin@example.com',
          mobile: '9876500003',
          role: 'pincode_manager',
          assignedState: 'Tamil Nadu',
          assignedDistrict: 'Salem',
          assignedDivision: 'Salem North',
          assignedPincode: '636001'
        }
      });
      assert.strictEqual(res.status, 403, `Expected status 403, got ${res.status}`);
      assert.strictEqual(res.data.success, false);
    });

    await test('4. State Admin CANNOT create State Manager in Kerala outside assigned state (rejected with 403)', async () => {
      const res = await request('/api/managers', {
        method: 'POST',
        token: stateAdminToken,
        body: {
          name: 'Outside State Mgr',
          email: 'outside_sm@example.com',
          mobile: '9876500004',
          role: 'state_manager',
          assignedState: 'Kerala'
        }
      });
      assert.strictEqual(res.status, 403, `Expected status 403, got ${res.status}`);
      assert.strictEqual(res.data.success, false);
      assert.match(res.data.message, /outside their authorized state/i);
    });

    // -------------------------------------------------------------
    // DISTRICT ADMIN TESTS
    // -------------------------------------------------------------
    await test('5. District Admin CANNOT create State Manager (rejected with 403)', async () => {
      const res = await request('/api/managers', {
        method: 'POST',
        token: districtAdminToken,
        body: {
          name: 'Unauthorized State Mgr by DA',
          email: 'da_sm@example.com',
          mobile: '9876500005',
          role: 'state_manager',
          assignedState: 'Tamil Nadu'
        }
      });
      assert.strictEqual(res.status, 403, `Expected status 403, got ${res.status}`);
      assert.strictEqual(res.data.success, false);
      assert.match(res.data.message, /District Admin can create District Managers only/i);
    });

    await test('6. District Admin CANNOT create Divisional Manager (rejected with 403)', async () => {
      const res = await request('/api/managers', {
        method: 'POST',
        token: districtAdminToken,
        body: {
          name: 'Unauthorized Div Mgr by DA',
          email: 'da_div@example.com',
          mobile: '9876500006',
          role: 'division_manager',
          assignedState: 'Tamil Nadu',
          assignedDistrict: 'Salem',
          assignedDivision: 'Salem North'
        }
      });
      assert.strictEqual(res.status, 403, `Expected status 403, got ${res.status}`);
      assert.strictEqual(res.data.success, false);
    });

    await test('7. District Admin CANNOT create Pincode Manager (rejected with 403)', async () => {
      const res = await request('/api/managers', {
        method: 'POST',
        token: districtAdminToken,
        body: {
          name: 'Unauthorized Pin Mgr by DA',
          email: 'da_pin@example.com',
          mobile: '9876500007',
          role: 'pincode_manager',
          assignedState: 'Tamil Nadu',
          assignedDistrict: 'Salem',
          assignedDivision: 'Salem North',
          assignedPincode: '636001'
        }
      });
      assert.strictEqual(res.status, 403, `Expected status 403, got ${res.status}`);
      assert.strictEqual(res.data.success, false);
    });

    await test('8. District Admin CANNOT create District Manager outside assigned district (rejected with 403)', async () => {
      const res = await request('/api/managers', {
        method: 'POST',
        token: districtAdminToken,
        body: {
          name: 'Wrong District Mgr',
          email: 'wrong_dist@example.com',
          mobile: '9876500008',
          role: 'district_manager',
          assignedState: 'Tamil Nadu',
          assignedDistrict: 'Chennai'
        }
      });
      assert.strictEqual(res.status, 403, `Expected status 403, got ${res.status}`);
      assert.strictEqual(res.data.success, false);
      assert.match(res.data.message, /outside their authorized district/i);
    });

    // -------------------------------------------------------------
    // DIVISION ADMIN TESTS
    // -------------------------------------------------------------
    await test('9. Division Admin CANNOT create State Manager (rejected with 403)', async () => {
      const res = await request('/api/managers', {
        method: 'POST',
        token: divisionAdminToken,
        body: {
          name: 'Unauthorized SM by DivAdmin',
          email: 'diva_sm@example.com',
          mobile: '9876500009',
          role: 'state_manager'
        }
      });
      assert.strictEqual(res.status, 403, `Expected status 403, got ${res.status}`);
      assert.strictEqual(res.data.success, false);
      assert.match(res.data.message, /Division Admin can create Divisional Managers only/i);
    });

    await test('10. Division Admin CANNOT create District Manager (rejected with 403)', async () => {
      const res = await request('/api/managers', {
        method: 'POST',
        token: divisionAdminToken,
        body: {
          name: 'Unauthorized DM by DivAdmin',
          email: 'diva_dm@example.com',
          mobile: '9876500010',
          role: 'district_manager',
          assignedDistrict: 'Salem'
        }
      });
      assert.strictEqual(res.status, 403, `Expected status 403, got ${res.status}`);
      assert.strictEqual(res.data.success, false);
    });

    await test('11. Division Admin CANNOT create Pincode Manager (rejected with 403)', async () => {
      const res = await request('/api/managers', {
        method: 'POST',
        token: divisionAdminToken,
        body: {
          name: 'Unauthorized PM by DivAdmin',
          email: 'diva_pm@example.com',
          mobile: '9876500011',
          role: 'pincode_manager',
          assignedPincode: '636001'
        }
      });
      assert.strictEqual(res.status, 403, `Expected status 403, got ${res.status}`);
      assert.strictEqual(res.data.success, false);
    });

    await test('12. Division Admin CANNOT create Division Manager outside assigned division (rejected with 403)', async () => {
      const res = await request('/api/managers', {
        method: 'POST',
        token: divisionAdminToken,
        body: {
          name: 'Wrong Division Mgr',
          email: 'wrong_div@example.com',
          mobile: '9876500012',
          role: 'division_manager',
          assignedState: 'Tamil Nadu',
          assignedDistrict: 'Salem',
          assignedDivision: 'Salem South'
        }
      });
      assert.strictEqual(res.status, 403, `Expected status 403, got ${res.status}`);
      assert.strictEqual(res.data.success, false);
      assert.match(res.data.message, /outside their authorized division/i);
    });

    // -------------------------------------------------------------
    // PINCODE ADMIN TESTS
    // -------------------------------------------------------------
    await test('13. Pincode Admin CANNOT create State Manager (rejected with 403)', async () => {
      const res = await request('/api/managers', {
        method: 'POST',
        token: pincodeAdminToken,
        body: {
          name: 'Unauthorized SM by PinAdmin',
          email: 'pina_sm@example.com',
          mobile: '9876500013',
          role: 'state_manager'
        }
      });
      assert.strictEqual(res.status, 403, `Expected status 403, got ${res.status}`);
      assert.strictEqual(res.data.success, false);
      assert.match(res.data.message, /Pincode Admin can create Pincode Managers only/i);
    });

    await test('14. Pincode Admin CANNOT create District Manager (rejected with 403)', async () => {
      const res = await request('/api/managers', {
        method: 'POST',
        token: pincodeAdminToken,
        body: {
          name: 'Unauthorized DM by PinAdmin',
          email: 'pina_dm@example.com',
          mobile: '9876500014',
          role: 'district_manager'
        }
      });
      assert.strictEqual(res.status, 403, `Expected status 403, got ${res.status}`);
      assert.strictEqual(res.data.success, false);
    });

    await test('15. Pincode Admin CANNOT create Division Manager (rejected with 403)', async () => {
      const res = await request('/api/managers', {
        method: 'POST',
        token: pincodeAdminToken,
        body: {
          name: 'Unauthorized Div by PinAdmin',
          email: 'pina_div@example.com',
          mobile: '9876500015',
          role: 'division_manager'
        }
      });
      assert.strictEqual(res.status, 403, `Expected status 403, got ${res.status}`);
      assert.strictEqual(res.data.success, false);
    });

    await test('16. Pincode Admin CANNOT create Pincode Manager outside assigned pincode (rejected with 403)', async () => {
      const res = await request('/api/managers', {
        method: 'POST',
        token: pincodeAdminToken,
        body: {
          name: 'Wrong Pin Mgr',
          email: 'wrong_pin@example.com',
          mobile: '9876500016',
          role: 'pincode_manager',
          assignedPincode: '600001'
        }
      });
      assert.strictEqual(res.status, 403, `Expected status 403, got ${res.status}`);
      assert.strictEqual(res.data.success, false);
      assert.match(res.data.message, /outside their authorized pincode/i);
    });

    // -------------------------------------------------------------
    // AUTHORIZED CREATION VALIDATION (validation check passes authorization gate)
    // -------------------------------------------------------------
    await test('17. State Admin creating State Manager passes authorization gate (not 403)', async () => {
      // Testing with missing body fields to verify it passes authorization and reaches input validation (400) rather than 403 Forbidden
      const res = await request('/api/managers', {
        method: 'POST',
        token: stateAdminToken,
        body: {
          role: 'state_manager',
          assignedState: 'Tamil Nadu'
        }
      });
      assert.strictEqual(res.status, 400, `Expected 400 (validation error), got ${res.status}`);
      assert.strictEqual(res.data.message, 'Manager name is required.');
    });

    await test('18. District Admin creating District Manager passes authorization gate (not 403)', async () => {
      const res = await request('/api/managers', {
        method: 'POST',
        token: districtAdminToken,
        body: {
          role: 'district_manager',
          assignedState: 'Tamil Nadu',
          assignedDistrict: 'Salem'
        }
      });
      assert.strictEqual(res.status, 400, `Expected 400 (validation error), got ${res.status}`);
      assert.strictEqual(res.data.message, 'Manager name is required.');
    });

    await test('19. Division Admin creating Division Manager passes authorization gate (not 403)', async () => {
      const res = await request('/api/managers', {
        method: 'POST',
        token: divisionAdminToken,
        body: {
          role: 'division_manager',
          assignedState: 'Tamil Nadu',
          assignedDistrict: 'Salem',
          assignedDivision: 'Salem North'
        }
      });
      assert.strictEqual(res.status, 400, `Expected 400 (validation error), got ${res.status}`);
      assert.strictEqual(res.data.message, 'Manager name is required.');
    });

    await test('20. Pincode Admin creating Pincode Manager passes authorization gate (not 403)', async () => {
      const res = await request('/api/managers', {
        method: 'POST',
        token: pincodeAdminToken,
        body: {
          role: 'pincode_manager',
          assignedState: 'Tamil Nadu',
          assignedDistrict: 'Salem',
          assignedDivision: 'Salem North',
          assignedPincode: '636001'
        }
      });
      assert.strictEqual(res.status, 400, `Expected 400 (validation error), got ${res.status}`);
      assert.strictEqual(res.data.message, 'Manager name is required.');
    });

  } finally {
    if (testServer) {
      testServer.close();
    }
  }

  console.log('\n=================================================================');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('=================================================================');
  if (failed > 0) process.exit(1);
  process.exit(0);
})();
