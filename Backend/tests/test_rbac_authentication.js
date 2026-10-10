/**
 * RBAC and Authentication Regression & Security Test Suite
 * Tests Sub-Admin management portal authentication and role-based access control.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const assert = require('assert');
const bcrypt = require('bcryptjs');
const { getMongoDb } = require('../config/mongo');
const { generateToken, verifyToken } = require('../utils/jwt');
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
  console.log('🧪 Running RBAC & Authentication Test Suite');
  console.log('=================================================================');

  // Start temporary test server on random port
  const testPort = 8099;
  testServer = http.createServer(app);
  await new Promise(resolve => testServer.listen(testPort, resolve));
  baseUrl = `http://localhost:${testPort}`;

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    return (async () => {
      try {
        await fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
      } catch (err) {
        console.error(`  ❌ FAIL: ${name}`);
        console.error(`     Error: ${err.message}`);
        failed++;
      }
    })();
  }

  try {
    const mdb = await getMongoDb();
    console.log('Connected to MongoDB Atlas for test assertions.\n');

    // Setup temporary test accounts in Atlas
    const testAdminPw = 'StateAdmin@Test2026';
    const testAdminHash = bcrypt.hashSync(testAdminPw, 10);
    const testAdminEmail = `test_state_admin_${Date.now()}@example.com`;

    const testManagerPw = 'Manager@Test2026';
    const testManagerHash = bcrypt.hashSync(testManagerPw, 10);
    const testManagerEmail = `test_state_manager_${Date.now()}@example.com`;

    const testSuspendedEmail = `test_suspended_admin_${Date.now()}@example.com`;

    // 1. Insert Test State Admin (mimics Super Admin creation)
    await mdb.collection('users').insertOne({
      name: 'Test State Admin',
      email: testAdminEmail,
      phone: '9999900001',
      role: 'admin',
      adminRole: 'state-admin',
      adminLevel: 'state',
      level: 'pincode', // intentionally set to schema default to verify correction
      assignedState: 'Karnataka',
      status: 'approved',
      isActive: true,
      password: testAdminHash,
      passwordHash: testAdminHash,
      createdAt: new Date()
    });

    // 2. Insert Test Manager
    await mdb.collection('users').insertOne({
      name: 'Test State Manager',
      email: testManagerEmail,
      phone: '9999900002',
      role: 'state_manager',
      status: 'active',
      isActive: true,
      password: testManagerHash,
      passwordHash: testManagerHash,
      createdAt: new Date()
    });

    // 3. Insert Suspended Admin
    await mdb.collection('users').insertOne({
      name: 'Test Suspended Admin',
      email: testSuspendedEmail,
      phone: '9999900003',
      role: 'admin',
      adminRole: 'district-admin',
      adminLevel: 'district',
      assignedState: 'Karnataka',
      assignedDistrict: 'Bangalore Urban',
      status: 'suspended',
      isActive: false,
      password: testAdminHash,
      passwordHash: testAdminHash,
      createdAt: new Date()
    });

    // --- CREDENTIAL VERIFICATION TESTS ---
    await test('1. Correctly created, Active State Admin can log in successfully', async () => {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: { email: testAdminEmail, password: testAdminPw }
      });
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      assert.strictEqual(res.data.success, true);
      assert.ok(res.data.token, 'Expected JWT token');
      assert.strictEqual(res.data.user.role, 'State Admin', `Expected 'State Admin', got '${res.data.user.role}'`);
      assert.strictEqual(res.data.user.level, 1, `Expected level 1, got ${res.data.user.level}`);
      assert.strictEqual(res.data.user.state, 'Karnataka');
    });

    await test('2. Incorrect password is rejected with 401 Invalid credentials', async () => {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: { email: testAdminEmail, password: 'WrongPassword123!' }
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.data.success, false);
      assert.strictEqual(res.data.message, 'Invalid credentials');
    });

    await test('3. Unknown account is rejected safely with 401 Invalid credentials', async () => {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: { email: 'nonexistent_account_999@example.com', password: 'SomePassword123!' }
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.data.success, false);
      assert.strictEqual(res.data.message, 'Invalid credentials');
    });

    await test('4. Password with whitespace is trimmed safely and authenticated', async () => {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: { email: testAdminEmail, password: `  ${testAdminPw}  ` }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
    });

    // --- ROLE-BASED ACCESS CONTROL TESTS ---
    await test('5. Manager credentials are strictly rejected without role leakage with 401 Invalid credentials', async () => {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: { email: testManagerEmail, password: testManagerPw }
      });
      assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
      assert.strictEqual(res.data.success, false);
      assert.strictEqual(res.data.message, 'Invalid credentials');
    });

    await test('6. Inactive / suspended account is rejected without status leakage with 401 Invalid credentials', async () => {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: { email: testSuspendedEmail, password: testAdminPw }
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.data.success, false);
      assert.strictEqual(res.data.message, 'Invalid credentials');
    });

    await test('7. Authenticated State Admin profile via /api/auth/me returns authoritative role', async () => {
      const loginRes = await request('/api/auth/login', {
        method: 'POST',
        body: { email: testAdminEmail, password: testAdminPw }
      });
      const token = loginRes.data.token;

      const meRes = await request('/api/auth/me', { token });
      assert.strictEqual(meRes.status, 200);
      assert.strictEqual(meRes.data.user.role, 'State Admin');
      assert.strictEqual(meRes.data.user.level, 1);
      assert.strictEqual(meRes.data.user.state, 'Karnataka');
    });

    await test('8. Token issued to Manager role cannot access protected admin APIs', async () => {
      // Craft a manager token (simulating token from Manager portal or crafted payload)
      const managerToken = generateToken({
        id: 'fake_mgr_1',
        _id: 'fake_mgr_1',
        role: 'state_manager',
        name: 'Manager Intruder'
      });

      const res = await request('/api/admin/overview', { token: managerToken });
      assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
      assert.strictEqual(res.data.success, false);
    });

    await test('9. Token with tampered non-admin role is rejected by auth middleware', async () => {
      const vendorToken = generateToken({
        id: 'fake_vendor_1',
        _id: 'fake_vendor_1',
        role: 'vendor',
        name: 'Vendor User'
      });

      const res = await request('/api/auth/me', { token: vendorToken });
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.data.success, false);
    });

    await test('10. getDemoAdmins returns only Sub-Admin roles and no Manager roles', async () => {
      const res = await request('/api/auth/demo-admins');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data.admins));
      const hasManager = res.data.admins.some(a => (a.role || '').toLowerCase().includes('manager'));
      assert.strictEqual(hasManager, false, 'Expected no manager in demo admins list');
    });

    // Cleanup test records
    await mdb.collection('users').deleteMany({
      email: { $in: [testAdminEmail, testManagerEmail, testSuspendedEmail] }
    });
    console.log('\nTest accounts cleaned up from MongoDB Atlas.');

  } catch (err) {
    console.error('Test Suite Error:', err);
    failed++;
  } finally {
    testServer.close();
    console.log('\n=================================================================');
    console.log(`Results: ${passed} Passed, ${failed} Failed`);
    console.log('=================================================================');
    process.exit(failed > 0 ? 1 : 0);
  }
})();
