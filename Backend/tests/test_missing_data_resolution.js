const assert = require('assert');
const { db, initDatabase, filterByLocation } = require('../config/db');
const authController = require('../controllers/authController');
const vendorController = require('../controllers/vendorController');
const managerDirectoryController = require('../controllers/managerDirectoryController');
const executiveController = require('../controllers/executiveController');
const orderController = require('../controllers/orderController');
const qcTaskController = require('../controllers/qcTaskController');

// Mock Express req & res
function mockReqRes(body = {}, query = {}, user = null, params = {}) {
  const req = {
    body,
    query,
    user,
    params,
    ip: '127.0.0.1',
    headers: {}
  };
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };
  return { req, res };
}

async function runTests() {
  console.log('========================================================================');
  console.log('🧪 MISSING DATA RESOLUTION & SUB ADMIN MULTI-TIER TERRITORY AUDIT');
  console.log('========================================================================\n');

  await initDatabase();

  let passed = 0;
  let failed = 0;

  function test(desc, fn) {
    try {
      fn();
      console.log(`✅ [PASS] ${desc}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${desc}: ${err.message}`);
      failed++;
    }
  }

  // Define Test Admin Personas across all 4 Sub Admin Levels
  const stateAdminTN = {
    _id: 'admin_state_tn_test',
    id: 'admin_state_tn_test',
    name: 'Tamil Nadu State Admin',
    role: 'State Admin',
    state: 'Tamil Nadu',
    stateId: 'state_tn'
  };

  const districtAdminSalem = {
    _id: 'admin_dist_salem_test',
    id: 'admin_dist_salem_test',
    name: 'Salem District Admin',
    role: 'District Admin',
    state: 'Tamil Nadu',
    district: 'Salem',
    stateId: 'state_tn',
    districtId: 'dist_salem'
  };

  const districtAdminCoimbatore = {
    _id: 'admin_dist_cbe_test',
    id: 'admin_dist_cbe_test',
    name: 'Coimbatore District Admin',
    role: 'District Admin',
    state: 'Tamil Nadu',
    district: 'Coimbatore',
    stateId: 'state_tn',
    districtId: 'dist_cbe'
  };

  const divisionAdminSalemNorth = {
    _id: 'admin_div_salem_n_test',
    id: 'admin_div_salem_n_test',
    name: 'Salem North Division Admin',
    role: 'Divisional Admin',
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Salem North',
    stateId: 'state_tn',
    districtId: 'dist_salem',
    divisionId: 'div_dist_salem_urban'
  };

  const pincodeAdmin636001 = {
    _id: 'admin_pin_636001_test',
    id: 'admin_pin_636001_test',
    name: 'Pincode Admin 636001',
    role: 'Pincode Admin',
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Salem North',
    pincode: '636001',
    stateId: 'state_tn',
    districtId: 'dist_salem',
    divisionId: 'div_dist_salem_urban',
    pincodeId: 'pin_636001'
  };

  const pincodeAdmin641001 = {
    _id: 'admin_pin_641001_test',
    id: 'admin_pin_641001_test',
    name: 'Pincode Admin 641001 Coimbatore',
    role: 'Pincode Admin',
    state: 'Tamil Nadu',
    district: 'Coimbatore',
    division: 'Coimbatore North',
    pincode: '641001',
    stateId: 'state_tn',
    districtId: 'dist_cbe',
    divisionId: 'div_cbe_north',
    pincodeId: 'pin_641001'
  };

  // ────────────────────────────────────────────────────────────────────────────
  // 1. DIRECT VENDOR REGISTRATION & REQUESTS
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- [1] Direct Vendor Registration & Multi-Tier Visibility ---');

  const testVendorEmail = `test_direct_vendor_${Date.now()}@connect.com`;
  const testVendorMobile = `9876${Date.now().toString().slice(-6)}`;

  const regVendorBody = {
    name: 'Ganesh Store Owner',
    businessName: 'Ganesh Fresh Mart',
    email: testVendorEmail,
    mobile: testVendorMobile,
    password: 'Password@123',
    role: 'vendor',
    category: 'Daily Needs',
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Salem North',
    pincode: '636001',
    address: '10 Bazar Street, Salem 636001',
    declarationAccepted: true
  };

  const { req: regReq, res: regRes } = mockReqRes(regVendorBody);
  await authController.register(regReq, regRes);

  test('Direct vendor registration succeeds with HTTP 201', () => {
    assert.strictEqual(regRes.statusCode, 201);
    assert.strictEqual(regRes.data.success, true);
    assert.strictEqual(regRes.data.status, 'Under Review');
  });

  const createdVendor = Array.from(db.vendors || []).find(v => v.email === testVendorEmail);
  test('Vendor record created in db.vendors with proper attribution', () => {
    assert.ok(createdVendor, 'Vendor must exist in db.vendors');
    assert.strictEqual(createdVendor.businessName, 'Ganesh Fresh Mart');
    assert.strictEqual(createdVendor.pincode, '636001');
    assert.strictEqual(createdVendor.registrationSource, 'Direct Registration');
    assert.strictEqual(createdVendor.approvalStatus, 'Pending Pincode Admin Approval');
  });

  const createdVendorUser = Array.from(db.users || []).find(u => u.email === testVendorEmail);
  test('User record created in db.users for the registered vendor', () => {
    assert.ok(createdVendorUser, 'Vendor user must exist in db.users');
    assert.strictEqual(createdVendorUser.role, 'vendor');
    assert.strictEqual(createdVendorUser.status, 'Under Review');
  });

  // Check visibility across Sub Admin tiers
  const { req: vReqPin, res: vResPin } = mockReqRes({}, { status: 'Pending' }, pincodeAdmin636001);
  await vendorController.getVendorRequests(vReqPin, vResPin);
  test('Pincode Admin 636001 sees the direct vendor request', () => {
    assert.strictEqual(vResPin.statusCode, 200);
    const found = (vResPin.data.requests || []).find(r => r.email === testVendorEmail);
    assert.ok(found, 'Direct vendor request must appear in Pincode Admin queue');
    assert.strictEqual(found.registrationSource, 'Direct Registration');
  });

  const { req: vReqDiv, res: vResDiv } = mockReqRes({}, { status: 'Pending' }, divisionAdminSalemNorth);
  await vendorController.getVendorRequests(vReqDiv, vResDiv);
  test('Division Admin Salem North sees the direct vendor request', () => {
    assert.strictEqual(vResDiv.statusCode, 200);
    const found = (vResDiv.data.requests || []).find(r => r.email === testVendorEmail);
    assert.ok(found, 'Direct vendor request must appear in Division Admin queue');
  });

  const { req: vReqDist, res: vResDist } = mockReqRes({}, { status: 'Pending' }, districtAdminSalem);
  await vendorController.getVendorRequests(vReqDist, vResDist);
  test('District Admin Salem sees the direct vendor request', () => {
    assert.strictEqual(vResDist.statusCode, 200);
    const found = (vResDist.data.requests || []).find(r => r.email === testVendorEmail);
    assert.ok(found, 'Direct vendor request must appear in District Admin queue');
  });

  const { req: vReqState, res: vResState } = mockReqRes({}, { status: 'Pending' }, stateAdminTN);
  await vendorController.getVendorRequests(vReqState, vResState);
  test('State Admin TN sees the direct vendor request', () => {
    assert.strictEqual(vResState.statusCode, 200);
    const found = (vResState.data.requests || []).find(r => r.email === testVendorEmail);
    assert.ok(found, 'Direct vendor request must appear in State Admin queue');
  });

  const { req: vReqCbe, res: vResCbe } = mockReqRes({}, { status: 'Pending' }, pincodeAdmin641001);
  await vendorController.getVendorRequests(vReqCbe, vResCbe);
  test('Coimbatore Pincode Admin 641001 CANNOT see the Salem vendor request', () => {
    assert.strictEqual(vResCbe.statusCode, 200);
    const found = (vResCbe.data.requests || []).find(r => r.email === testVendorEmail);
    assert.strictEqual(found, undefined, 'Salem vendor request must not leak to Coimbatore Admin');
  });

  // Verify Fully Onboarded Vendors list does NOT include this pending vendor
  const { req: vListReq, res: vListRes } = mockReqRes({}, { onboardedOnly: 'true' }, pincodeAdmin636001);
  await vendorController.getVendors(vListReq, vListRes);
  test('Pending vendor is strictly excluded from Fully Onboarded Vendors directory', () => {
    assert.strictEqual(vListRes.statusCode, 200);
    const list = vListRes.data.vendors || vListRes.data.data || [];
    const found = list.find(v => v.email === testVendorEmail);
    assert.strictEqual(found, undefined, 'Pending request must NOT appear in Onboarded Vendors directory');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 2. MANAGER AND AGENT ONBOARDED VENDOR REQUESTS
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- [2] Manager & Agent Onboarded Vendor Tracking ---');

  const mgrVendorEmail = `mgr_onboarded_${Date.now()}@vendor.com`;
  const mgrActor = {
    _id: 'usr_mgr_salem_test',
    id: 'usr_mgr_salem_test',
    name: 'Kavitha Manager',
    role: 'pincode_manager',
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Salem North',
    pincode: '636001'
  };

  const { req: createVenReq, res: createVenRes } = mockReqRes({
    businessName: 'Kavitha Organic Store',
    contactPerson: 'Kavitha Owner',
    phone: `9123${Date.now().toString().slice(-6)}`,
    email: mgrVendorEmail,
    category: 'Groceries',
    pincode: '636001',
    district: 'Salem',
    division: 'Salem North',
    state: 'Tamil Nadu'
  }, {}, mgrActor);

  await vendorController.createVendor(createVenReq, createVenRes);
  test('Vendor created by Manager returns HTTP 201', () => {
    assert.strictEqual(createVenRes.statusCode, 201);
    assert.strictEqual(createVenRes.data.success, true);
  });

  const createdByMgr = Array.from(db.vendors || []).find(v => v.email === mgrVendorEmail);
  test('Manager-onboarded vendor saved to db.vendors with Manager attribution', () => {
    assert.ok(createdByMgr);
    assert.strictEqual(createdByMgr.businessName, 'Kavitha Organic Store');
    assert.strictEqual(createdByMgr.pincode, '636001');
  });

  const userSynced = Array.from(db.users || []).find(u => u.email === mgrVendorEmail);
  test('Manager-onboarded vendor successfully synced into db.users', () => {
    assert.ok(userSynced, 'Vendor must be synced into db.users');
    assert.strictEqual(userSynced.role, 'vendor');
  });

  // Verify it appears in Vendor Requests
  const { req: mgrVenCheckReq, res: mgrVenCheckRes } = mockReqRes({}, { status: 'Pending' }, districtAdminSalem);
  await vendorController.getVendorRequests(mgrVenCheckReq, mgrVenCheckRes);
  test('Manager-onboarded vendor appears in District Admin request queue', () => {
    const found = (mgrVenCheckRes.data.requests || []).find(r => r.email === mgrVendorEmail);
    assert.ok(found, 'Manager-onboarded vendor must appear in request queue');
    assert.strictEqual(found.registrationSource, 'Manager');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 3. DIRECT MANAGER REGISTRATION & REQUEST VISIBILITY
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- [3] Direct Manager Registration & Territory Scoping ---');

  const mgrEmail = `direct_mgr_${Date.now()}@connect.com`;
  const mgrMobile = `9345${Date.now().toString().slice(-6)}`;

  const { req: regMgrReq, res: regMgrRes } = mockReqRes({
    name: 'Suresh Field Manager',
    email: mgrEmail,
    mobile: mgrMobile,
    password: 'Password@123',
    role: 'pincode_manager',
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Salem North',
    pincode: '636001',
    declarationAccepted: true
  });

  await authController.register(regMgrReq, regMgrRes);
  test('Direct manager registration succeeds with HTTP 201', () => {
    assert.strictEqual(regMgrRes.statusCode, 201);
    assert.strictEqual(regMgrRes.data.status, 'PENDING_SUB_ADMIN_APPROVAL');
  });

  const { req: mReqPin, res: mResPin } = mockReqRes({}, { status: 'pending' }, pincodeAdmin636001);
  await managerDirectoryController.getManagerRequests(mReqPin, mResPin);
  test('Pincode Admin 636001 sees the direct manager registration request', () => {
    assert.strictEqual(mResPin.statusCode, 200);
    const found = (mResPin.data.requests || []).find(r => r.email === mgrEmail);
    assert.ok(found, 'Pincode Manager must appear in Pincode Admin requests');
  });

  const { req: mReqDist, res: mResDist } = mockReqRes({}, { status: 'pending' }, districtAdminSalem);
  await managerDirectoryController.getManagerRequests(mReqDist, mResDist);
  test('District Admin Salem sees the subordinate pincode manager request', () => {
    assert.strictEqual(mResDist.statusCode, 200);
    const found = (mResDist.data.requests || []).find(r => r.email === mgrEmail);
    assert.ok(found, 'Pincode Manager must appear in District Admin requests');
  });

  const { req: mReqCbe, res: mResCbe } = mockReqRes({}, { status: 'pending' }, districtAdminCoimbatore);
  await managerDirectoryController.getManagerRequests(mReqCbe, mResCbe);
  test('Coimbatore District Admin CANNOT see the Salem manager request', () => {
    assert.strictEqual(mResCbe.statusCode, 200);
    const found = (mResCbe.data.requests || []).find(r => r.email === mgrEmail);
    assert.strictEqual(found, undefined, 'Salem Manager must not leak to Coimbatore Admin');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 4. DIRECT AGENT REGISTRATION & REQUEST VISIBILITY
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- [4] Direct Agent Registration & Status Filtering ---');

  const agtEmail = `direct_agt_${Date.now()}@connect.com`;
  const agtMobile = `9456${Date.now().toString().slice(-6)}`;

  const { req: regAgtReq, res: regAgtRes } = mockReqRes({
    name: 'Praveen Agent',
    email: agtEmail,
    mobile: agtMobile,
    password: 'Password@123',
    role: 'pincode_agent',
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Salem North',
    pincode: '636001',
    declarationAccepted: true
  });

  await authController.register(regAgtReq, regAgtRes);
  test('Direct agent registration succeeds with HTTP 201', () => {
    assert.strictEqual(regAgtRes.statusCode, 201);
    assert.strictEqual(regAgtRes.data.status, 'PENDING_SUB_ADMIN_APPROVAL');
  });

  const { req: aReqPin, res: aResPin } = mockReqRes({}, { status: 'pending' }, pincodeAdmin636001);
  await executiveController.getAgentRequests(aReqPin, aResPin);
  test('Pincode Admin 636001 sees direct agent with PENDING_SUB_ADMIN_APPROVAL status', () => {
    assert.strictEqual(aResPin.statusCode, 200);
    const list = aResPin.data.requests || aResPin.data.agents || aResPin.data.data || [];
    const found = list.find(a => a.email === agtEmail);
    assert.ok(found, 'Direct Agent request must be returned when status=pending is queried');
  });

  const { req: aReqDiv, res: aResDiv } = mockReqRes({}, { status: 'pending' }, divisionAdminSalemNorth);
  await executiveController.getAgentRequests(aReqDiv, aResDiv);
  test('Division Admin Salem North sees direct agent request', () => {
    assert.strictEqual(aResDiv.statusCode, 200);
    const list = aResDiv.data.requests || aResDiv.data.agents || aResDiv.data.data || [];
    const found = list.find(a => a.email === agtEmail);
    assert.ok(found, 'Agent request must appear in Division Admin queue');
  });

  const { req: aReqCbe, res: aResCbe } = mockReqRes({}, { status: 'pending' }, pincodeAdmin641001);
  await executiveController.getAgentRequests(aReqCbe, aResCbe);
  test('Coimbatore Pincode Admin CANNOT see the Salem Agent request', () => {
    assert.strictEqual(aResCbe.statusCode, 200);
    const list = aResCbe.data.requests || aResCbe.data.agents || aResCbe.data.data || [];
    const found = list.find(a => a.email === agtEmail);
    assert.strictEqual(found, undefined, 'Salem Agent request must not leak to Coimbatore Admin');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 5. ORDERS DUAL-TERRITORY (DELIVERY & FULFILLING VENDOR) VISIBILITY
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- [5] Orders Dual-Territory Visibility ---');

  const testOrderId1 = `ORD-SALEM-FULFILL-${Date.now()}`;
  // Customer is in Chennai (600001), but Fulfilling Vendor is in Salem (636001)
  const orderFulfillBySalemVendor = {
    _id: testOrderId1,
    id: testOrderId1,
    order_number: testOrderId1,
    category: 'product',
    type: 'product',
    status: 'Delivered',
    customerName: 'Chennai Buyer',
    customer_address: '15 Anna Salai, Chennai, Tamil Nadu - 600001',
    pincode: '600001',
    district: 'Chennai',
    division: 'Chennai Central',
    state: 'Tamil Nadu',
    // Vendor is in Salem
    vendorId: 'ven_salem_test_01',
    vendorName: 'Salem Silk Emporium',
    vendorState: 'Tamil Nadu',
    vendorDistrict: 'Salem',
    vendorDivision: 'Salem North',
    vendorPincode: '636001',
    createdAt: new Date().toISOString()
  };

  db.orders.push(orderFulfillBySalemVendor);

  // Salem District Admin must see this order because fulfilling vendor is in Salem!
  const { req: oReqDist, res: oResDist } = mockReqRes({}, {}, districtAdminSalem);
  await orderController.getOrders(oReqDist, oResDist);
  test('Salem District Admin sees order delivered to Chennai because vendor is in Salem', () => {
    assert.strictEqual(oResDist.statusCode, 200);
    const orders = oResDist.data.orders || oResDist.data.data || [];
    const found = orders.find(o => String(o.id || o.orderNumber) === testOrderId1);
    assert.ok(found, 'Order fulfilled by Salem vendor must be visible to Salem District Admin');
  });

  // Pincode Admin 636001 must also see this order because vendor is in 636001!
  const { req: oReqPin, res: oResPin } = mockReqRes({}, {}, pincodeAdmin636001);
  await orderController.getOrders(oReqPin, oResPin);
  test('Pincode Admin 636001 sees order fulfilled by vendor in 636001', () => {
    assert.strictEqual(oResPin.statusCode, 200);
    const orders = oResPin.data.orders || oResPin.data.data || [];
    const found = orders.find(o => String(o.id || o.orderNumber) === testOrderId1);
    assert.ok(found, 'Order fulfilled by 636001 vendor must be visible to 636001 Pincode Admin');
  });

  // Coimbatore District Admin CANNOT see this order (neither delivery nor vendor in Coimbatore)
  const { req: oReqCbe, res: oResCbe } = mockReqRes({}, {}, districtAdminCoimbatore);
  await orderController.getOrders(oReqCbe, oResCbe);
  test('Coimbatore District Admin CANNOT see order between Salem vendor and Chennai customer', () => {
    assert.strictEqual(oResCbe.statusCode, 200);
    const orders = oResCbe.data.orders || oResCbe.data.data || [];
    const found = orders.find(o => String(o.id || o.orderNumber) === testOrderId1);
    assert.strictEqual(found, undefined, 'Coimbatore Admin must not see unauthorized territory order');
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 6. TASKS RBAC & TERRITORY VISIBILITY
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- [6] Tasks Territory Visibility & Default Tab ---');

  // Verify Sub Admin task querying returns scoped records
  const { req: tReqDist, res: tResDist } = mockReqRes({}, {}, districtAdminSalem);
  await qcTaskController.getTasks(tReqDist, tResDist);
  test('Salem District Admin fetches tasks within their jurisdiction', () => {
    assert.strictEqual(tResDist.statusCode, 200);
    assert.strictEqual(tResDist.data.success, true);
    assert.ok(Array.isArray(tResDist.data.data), 'Tasks data must be an array');
    assert.ok(tResDist.data.count >= 0);
  });

  const { req: tReqState, res: tResState } = mockReqRes({}, {}, stateAdminTN);
  await qcTaskController.getTasks(tReqState, tResState);
  test('State Admin TN fetches all tasks within state jurisdiction', () => {
    assert.strictEqual(tResState.statusCode, 200);
    assert.strictEqual(tResState.data.success, true);
    assert.ok(tResState.data.data.length >= tResDist.data.data.length, 'State Admin must see at least as many tasks as District Admin');
  });

  // Summary counts
  test('Tasks summary provides counts for pending, in progress, and completed', () => {
    const summary = tResState.data.summary || {};
    assert.ok(typeof summary.total === 'number');
    assert.ok(typeof summary.inProgress === 'number');
    assert.ok(typeof summary.completed === 'number');
  });

  console.log('\n========================================================================');
  console.log(`RESULTS: Passed: ${passed} | Failed: ${failed}`);
  console.log('========================================================================');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
