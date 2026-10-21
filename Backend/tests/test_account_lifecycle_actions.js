require('dotenv').config();
const { db, initDatabase } = require('../config/db');
const jwt = require('jsonwebtoken');
const vendorController = require('../controllers/vendorController');
const managerDirectoryController = require('../controllers/managerDirectoryController');
const executiveController = require('../controllers/executiveController');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { JWT_SECRET } = require('../utils/jwt');

function upsertItem(collection, item, matchFn) {
  if (!collection) return;
  const idx = collection.findIndex(matchFn);
  if (idx !== -1) {
    collection.splice(idx, 1);
  }
  collection.push(item);
}

function createMockReqRes({ user, query = {}, params = {}, body = {}, headers = {} }) {
  const req = {
    user,
    query,
    params,
    body,
    headers,
    ip: '127.0.0.1'
  };
  let statusCode = 200;
  let responseData = null;
  const res = {
    status(code) { statusCode = code; return res; },
    json(data) { responseData = data; return res; },
    getStatusCode: () => statusCode,
    getData: () => responseData
  };
  return { req, res };
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log('🧪 ACCOUNT LIFECYCLE MANAGEMENT (SUSPEND, ACTIVATE, SOFT DELETE) SUITE');
  console.log('========================================================================\n');

  await initDatabase();

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // Setup test mock users across territory levels
  const stateAdmin = {
    id: 'user_state_admin_tn',
    _id: 'user_state_admin_tn',
    role: 'state_admin',
    name: 'Tamil Nadu State Admin',
    state: 'Tamil Nadu',
    email: 'stateadmin_tn@connect.com'
  };

  const districtAdminSalem = {
    id: 'user_dist_admin_salem',
    _id: 'user_dist_admin_salem',
    role: 'district_admin',
    name: 'Salem District Admin',
    state: 'Tamil Nadu',
    district: 'Salem',
    email: 'salemadmin@connect.com'
  };

  const districtAdminCoimbatore = {
    id: 'user_dist_admin_cbe',
    _id: 'user_dist_admin_cbe',
    role: 'district_admin',
    name: 'Coimbatore District Admin',
    state: 'Tamil Nadu',
    district: 'Coimbatore',
    email: 'cbeadmin@connect.com'
  };

  const divisionAdminSalemWest = {
    id: 'user_div_admin_sw',
    _id: 'user_div_admin_sw',
    role: 'division_admin',
    name: 'Salem West Division Admin',
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Salem West',
    email: 'salemwest@connect.com'
  };

  const pincodeAdmin636001 = {
    id: 'user_pin_admin_636001',
    _id: 'user_pin_admin_636001',
    role: 'pincode_admin',
    name: 'Pincode Admin 636001',
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Salem West',
    pincode: '636001',
    email: 'pin636001@connect.com'
  };

  // -------------------------------------------------------------------------
  // SECTION 1: MANAGER LIFECYCLE (Suspend -> Activate -> Soft Delete)
  // -------------------------------------------------------------------------
  console.log('\n--- [1] Manager Lifecycle Management ---');

  // Create a test manager in Salem, Tamil Nadu
  const testManagerId = 'mgr_test_salem_101';
  const testManager = {
    id: testManagerId,
    _id: testManagerId,
    managerId: 'MGR_SALEM_101',
    name: 'Salem Field Operations Lead',
    email: 'salemlead@connect.com',
    mobile: '9876543210',
    role: 'district_manager',
    state: 'Tamil Nadu',
    district: 'Salem',
    status: 'Active',
    isDeleted: false
  };

  // Insert or update in db.managers and db.users
  upsertItem(db.managers, { ...testManager }, m => m.id === testManagerId || m._id === testManagerId);
  upsertItem(db.users, { ...testManager, passwordHash: 'hashed_pw_test' }, u => u.id === testManagerId || u.email === testManager.email);

  // 1.1 State Admin suspends the District Manager
  {
    const { req, res } = createMockReqRes({
      user: stateAdmin,
      params: { id: testManagerId },
      body: { action: 'suspend', reason: 'Audit pending on field tasks' }
    });
    await managerDirectoryController.updateManagerStatus(req, res);
    const data = res.getData();
    assert(res.getStatusCode() === 200 && data?.success, 'State Admin successfully suspends District Manager');
    assert(data?.manager?.status === 'Suspended', 'Manager status in response is Suspended');

    const inMgr = Array.from(db.managers).find(m => m.id === testManagerId);
    assert(inMgr && inMgr.status === 'Suspended', 'Manager in db.managers is Suspended');

    const inUser = Array.from(db.users).find(u => u.id === testManagerId);
    assert(inUser && inUser.status === 'Suspended', 'Manager in db.users is Suspended');
  }

  // 1.2 State Admin activates the suspended District Manager
  {
    const { req, res } = createMockReqRes({
      user: stateAdmin,
      params: { id: testManagerId },
      body: { action: 'activate', reason: 'Audit cleared successfully' }
    });
    await managerDirectoryController.updateManagerStatus(req, res);
    const data = res.getData();
    assert(res.getStatusCode() === 200 && data?.success, 'State Admin successfully activates suspended District Manager');
    assert(data?.manager?.status === 'Active', 'Manager status restored to Active');

    const inMgr = Array.from(db.managers).find(m => m.id === testManagerId);
    assert(inMgr && inMgr.status === 'Active', 'Manager status in db.managers is Active');
  }

  // 1.3 State Admin soft-deletes the District Manager
  {
    const { req, res } = createMockReqRes({
      user: stateAdmin,
      params: { id: testManagerId },
      body: { action: 'delete', reason: 'Role transitioned permanently' }
    });
    await managerDirectoryController.updateManagerStatus(req, res);
    const data = res.getData();
    assert(res.getStatusCode() === 200 && data?.success, 'State Admin successfully soft-deletes District Manager');
    assert(data?.manager?.status === 'Deleted' && data?.manager?.isDeleted === true, 'Manager has status Deleted and isDeleted: true');

    const inMgr = Array.from(db.managers).find(m => m.id === testManagerId);
    assert(inMgr && inMgr.status === 'Deleted' && inMgr.isDeleted === true, 'Soft-deleted manager preserved in db.managers (not physically deleted)');

    const inUser = Array.from(db.users).find(u => u.id === testManagerId);
    assert(inUser && inUser.status === 'Deleted' && inUser.isDeleted === true, 'Soft-deleted manager preserved in db.users');
  }

  // 1.4 Territory Boundary Enforcement for Managers:
  // Coimbatore District Admin tries to modify Salem District Manager -> MUST BE REJECTED
  {
    const { req, res } = createMockReqRes({
      user: districtAdminCoimbatore,
      params: { id: testManagerId },
      body: { action: 'activate' }
    });
    await managerDirectoryController.updateManagerStatus(req, res);
    assert(res.getStatusCode() === 403, 'Coimbatore District Admin forbidden from modifying Salem District Manager');
  }

  // -------------------------------------------------------------------------
  // SECTION 2: VENDOR LIFECYCLE (Suspend -> Activate -> Soft Delete)
  // -------------------------------------------------------------------------
  console.log('\n--- [2] Vendor Lifecycle Management ---');

  const testVendorId = 'vnd_test_salem_202';
  const testVendor = {
    id: testVendorId,
    _id: testVendorId,
    name: 'Salem Electronics Store',
    businessName: 'Salem Electronics Store',
    contactPerson: 'Ramesh Kumar',
    phone: '9840123456',
    email: 'salemelectronics@gmail.com',
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Salem West',
    pincode: '636001',
    status: 'Active',
    kycStatus: 'Verified',
    approvalStatus: 'APPROVED',
    isApproved: true,
    isActive: true,
    isDeleted: false,
    products: [{ id: 'prod_1', name: 'LED Bulb' }],
    totalOrdersDelivered: 42
  };

  upsertItem(db.vendors, { ...testVendor }, v => v.id === testVendorId || v._id === testVendorId);
  upsertItem(db.users, {
    id: testVendorId,
    _id: testVendorId,
    role: 'vendor',
    email: testVendor.email,
    phone: testVendor.phone,
    status: 'Active',
    isDeleted: false
  }, u => u.id === testVendorId || u.email === testVendor.email);

  // 2.1 District Admin Salem suspends Salem Vendor
  {
    const { req, res } = createMockReqRes({
      user: districtAdminSalem,
      params: { id: testVendorId },
      body: { action: 'suspend', reason: 'Temporary compliance check' }
    });
    await vendorController.updateVendorStatus(req, res);
    const data = res.getData();
    if (data?.vendor?.status !== 'Suspended') {
      console.log('DEBUG 2.1 data:', JSON.stringify(data));
    }
    assert(res.getStatusCode() === 200 && data?.success, 'District Admin suspends territory vendor');
    assert(data?.vendor?.status === 'Suspended', 'Vendor status updated to Suspended');

    const inVnd = Array.from(db.vendors).find(v => v.id === testVendorId);
    assert(inVnd && inVnd.status === 'Suspended' && inVnd.isSuspended === true, 'db.vendors updated with Suspended');

    const inUser = Array.from(db.users).find(u => u.id === testVendorId);
    assert(inUser && inUser.status === 'Suspended' && inUser.isSuspended === true, 'Vendor user in db.users updated to Suspended');
  }

  // 2.2 District Admin Salem activates Salem Vendor
  {
    const { req, res } = createMockReqRes({
      user: districtAdminSalem,
      params: { id: testVendorId },
      body: { action: 'activate', reason: 'Compliance satisfied' }
    });
    await vendorController.updateVendorStatus(req, res);
    const data = res.getData();
    assert(res.getStatusCode() === 200 && data?.success, 'District Admin activates suspended vendor');
    assert(data?.vendor?.status === 'Active', 'Vendor status restored to Active');

    const inVnd = Array.from(db.vendors).find(v => v.id === testVendorId);
    assert(inVnd && inVnd.status === 'Active' && !inVnd.isSuspended, 'db.vendors restored to Active');
  }

  // 2.3 District Admin Salem soft-deletes Salem Vendor
  {
    const { req, res } = createMockReqRes({
      user: districtAdminSalem,
      params: { id: testVendorId },
      body: { action: 'delete', reason: 'Business ceased operations' }
    });
    await vendorController.updateVendorStatus(req, res);
    const data = res.getData();
    assert(res.getStatusCode() === 200 && data?.success, 'District Admin soft-deletes vendor');
    assert(data?.vendor?.status === 'Deleted' && data?.vendor?.isDeleted === true, 'Vendor status is Deleted and isDeleted: true');

    const inVnd = Array.from(db.vendors).find(v => v.id === testVendorId);
    assert(inVnd && inVnd.status === 'Deleted' && inVnd.isDeleted === true, 'Vendor record retained in db.vendors (soft-deleted)');
    assert(inVnd.products?.length === 1 && inVnd.totalOrdersDelivered === 42, 'Historical products and order history are fully preserved');

    const inUser = Array.from(db.users).find(u => u.id === testVendorId);
    assert(inUser && inUser.status === 'Deleted' && inUser.isDeleted === true, 'db.users entry marked Deleted');
  }

  // 2.4 Territory Boundary Enforcement for Vendors:
  // Pincode Admin 636005 (different pincode) tries to modify vendor in 636001 -> MUST BE REJECTED
  {
    const foreignPincodeAdmin = {
      ...pincodeAdmin636001,
      id: 'user_pin_admin_636005',
      pincode: '636005'
    };
    const { req, res } = createMockReqRes({
      user: foreignPincodeAdmin,
      params: { id: testVendorId },
      body: { action: 'activate' }
    });
    await vendorController.updateVendorStatus(req, res);
    assert(res.getStatusCode() === 403, 'Pincode Admin forbidden from modifying vendor outside assigned pincode');
  }

  // -------------------------------------------------------------------------
  // SECTION 3: AGENT LIFECYCLE (Suspend -> Activate -> Soft Delete)
  // -------------------------------------------------------------------------
  console.log('\n--- [3] Agent Lifecycle Management ---');

  const testAgentId = 'agt_test_salem_303';
  const testAgent = {
    id: testAgentId,
    _id: testAgentId,
    name: 'Suresh Field Agent',
    phone: '9894123456',
    email: 'sureshagent@connect.com',
    role: 'pincode_agent',
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Salem West',
    pincode: '636001',
    status: 'Active',
    isDeleted: false,
    totalReferrals: 15,
    walletBalance: 2500
  };

  upsertItem(db.agents, { ...testAgent }, a => a.id === testAgentId || a._id === testAgentId);
  upsertItem(db.users, {
    id: testAgentId,
    _id: testAgentId,
    role: 'pincode_agent',
    name: testAgent.name,
    email: testAgent.email,
    phone: testAgent.phone,
    status: 'Active',
    isDeleted: false
  }, u => u.id === testAgentId || u.email === testAgent.email);

  // 3.1 Division Admin Salem West suspends the Pincode Agent
  {
    const { req, res } = createMockReqRes({
      user: divisionAdminSalemWest,
      params: { id: testAgentId },
      body: { action: 'suspend', reason: 'Verification required' }
    });
    await executiveController.updateAgentStatus(req, res);
    const data = res.getData();
    assert(res.getStatusCode() === 200 && data?.success, 'Division Admin suspends eligible Agent');
    assert(data?.agent?.status === 'Suspended', 'Agent status updated to Suspended');

    const inAgt = Array.from(db.agents).find(a => a.id === testAgentId);
    assert(inAgt && inAgt.status === 'Suspended' && inAgt.isSuspended === true, 'db.agents updated to Suspended');

    const inUser = Array.from(db.users).find(u => u.id === testAgentId);
    assert(inUser && inUser.status === 'Suspended' && inUser.isSuspended === true, 'Agent user in db.users updated to Suspended');
  }

  // 3.2 Division Admin Salem West activates the Agent
  {
    const { req, res } = createMockReqRes({
      user: divisionAdminSalemWest,
      params: { id: testAgentId },
      body: { action: 'activate', reason: 'Verification approved' }
    });
    await executiveController.updateAgentStatus(req, res);
    const data = res.getData();
    assert(res.getStatusCode() === 200 && data?.success, 'Division Admin activates suspended Agent');
    assert(data?.agent?.status === 'Active', 'Agent status restored to Active');

    const inAgt = Array.from(db.agents).find(a => a.id === testAgentId);
    assert(inAgt && inAgt.status === 'Active' && !inAgt.isSuspended, 'db.agents restored to Active');
  }

  // 3.3 Division Admin Salem West soft-deletes the Agent
  {
    const { req, res } = createMockReqRes({
      user: divisionAdminSalemWest,
      params: { id: testAgentId },
      body: { action: 'delete', reason: 'Resigned' }
    });
    await executiveController.updateAgentStatus(req, res);
    const data = res.getData();
    assert(res.getStatusCode() === 200 && data?.success, 'Division Admin soft-deletes Agent');
    assert(data?.agent?.status === 'Deleted' && data?.agent?.isDeleted === true, 'Agent status is Deleted and isDeleted: true');

    const inAgt = Array.from(db.agents).find(a => a.id === testAgentId);
    assert(inAgt && inAgt.status === 'Deleted' && inAgt.isDeleted === true, 'Agent record retained in db.agents (soft-delete)');
    assert(inAgt.totalReferrals === 15 && inAgt.walletBalance === 2500, 'Historical referrals and financial balances are preserved');

    const inUser = Array.from(db.users).find(u => u.id === testAgentId);
    assert(inUser && inUser.status === 'Deleted' && inUser.isDeleted === true, 'db.users entry marked Deleted');
  }

  // 3.4 Territory Boundary Enforcement for Agents:
  // Admin from another division (Salem East) tries to modify Salem West agent -> MUST BE REJECTED
  {
    const foreignDivisionAdmin = {
      ...divisionAdminSalemWest,
      id: 'user_div_admin_se',
      division: 'Salem East'
    };
    const { req, res } = createMockReqRes({
      user: foreignDivisionAdmin,
      params: { id: testAgentId },
      body: { action: 'activate' }
    });
    await executiveController.updateAgentStatus(req, res);
    assert(res.getStatusCode() === 403, 'Division Admin forbidden from modifying Agent outside assigned division');
  }

  // -------------------------------------------------------------------------
  // SECTION 4: LOGIN DENIAL & AUTHENTICATION ENFORCEMENT
  // -------------------------------------------------------------------------
  console.log('\n--- [4] Login Denial & Token Invalidation ---');

  const EXPECTED_SUSPENDED_MSG = 'Your account has been suspended. Please contact your administrator for assistance.';
  const EXPECTED_DELETED_MSG = 'Your account has been deactivated and access is no longer available. Please contact your administrator if you believe this is an error.';

  // 4.1 Login attempt by Suspended Account
  const suspendedUser = {
    id: 'user_suspended_test',
    _id: 'user_suspended_test',
    email: 'suspended_user@connect.com',
    role: 'pincode_agent',
    status: 'Suspended',
    isSuspended: true,
    isDeleted: false
  };
  upsertItem(db.users, suspendedUser, u => u.id === suspendedUser.id || u.email === suspendedUser.email);

  {
    const { req, res } = createMockReqRes({
      body: { email: suspendedUser.email, password: 'any_password' }
    });
    await authController.login(req, res);
    assert(res.getStatusCode() === 403, 'Login denied with HTTP 403 for suspended account');
    assert(res.getData()?.code === 'ACCOUNT_SUSPENDED', 'Response error code is ACCOUNT_SUSPENDED');
    assert(res.getData()?.message === EXPECTED_SUSPENDED_MSG, `Exact suspension message displayed: "${EXPECTED_SUSPENDED_MSG}"`);
  }

  // 4.2 Login attempt by Soft-Deleted Account
  const deletedUser = {
    id: 'user_deleted_test',
    _id: 'user_deleted_test',
    email: 'deleted_user@connect.com',
    role: 'vendor',
    status: 'Deleted',
    isDeleted: true
  };
  upsertItem(db.users, deletedUser, u => u.id === deletedUser.id || u.email === deletedUser.email);

  {
    const { req, res } = createMockReqRes({
      body: { email: deletedUser.email, password: 'any_password' }
    });
    await authController.login(req, res);
    assert(res.getStatusCode() === 403, 'Login denied with HTTP 403 for soft-deleted account');
    assert(res.getData()?.code === 'ACCOUNT_DEACTIVATED', 'Response error code is ACCOUNT_DEACTIVATED');
    assert(res.getData()?.message === EXPECTED_DELETED_MSG, `Exact deactivation message displayed: "${EXPECTED_DELETED_MSG}"`);
  }

  // 4.3 Active Session Invalidation in authMiddleware (JWT Token Check)
  // Suspended user token
  {
    const token = jwt.sign(
      { id: suspendedUser.id, role: suspendedUser.role, email: suspendedUser.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const { req, res } = createMockReqRes({
      headers: { authorization: `Bearer ${token}` }
    });
    let nextCalled = false;
    await authMiddleware(req, res, () => { nextCalled = true; });

    assert(nextCalled === false, 'Session middleware blocks suspended user token from accessing protected APIs');
    assert(res.getStatusCode() === 403, 'authMiddleware returns 403 for suspended user');
    assert(res.getData()?.code === 'ACCOUNT_SUSPENDED', 'authMiddleware returns code ACCOUNT_SUSPENDED');
    assert(res.getData()?.message === EXPECTED_SUSPENDED_MSG, 'authMiddleware returns exact suspension message');
  }

  // Soft-deleted user token
  {
    const token = jwt.sign(
      { id: deletedUser.id, role: deletedUser.role, email: deletedUser.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const { req, res } = createMockReqRes({
      headers: { authorization: `Bearer ${token}` }
    });
    let nextCalled = false;
    await authMiddleware(req, res, () => { nextCalled = true; });

    assert(nextCalled === false, 'Session middleware blocks soft-deleted user token');
    assert(res.getStatusCode() === 403, 'authMiddleware returns 403 for deleted user');
    assert(res.getData()?.code === 'ACCOUNT_DEACTIVATED', 'authMiddleware returns code ACCOUNT_DEACTIVATED');
    assert(res.getData()?.message === EXPECTED_DELETED_MSG, 'authMiddleware returns exact deactivation message');
  }

  // -------------------------------------------------------------------------
  // SECTION 5: AUDIT LOG VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n--- [5] Audit Trail Verification ---');

  const allLogs = Array.from(db.auditLogs || []);
  const managerAudit = allLogs.find(l => (l.recordId === testManagerId || (l.details && l.details.includes(testManager.name))) && l.action && l.action.toLowerCase().includes('delete'));
  assert(managerAudit !== undefined, 'Manager lifecycle actions logged in auditLogs');

  const vendorAudit = allLogs.find(l => (l.recordId === testVendorId || (l.details && l.details.includes(testVendor.name))) && l.action && l.action.toLowerCase().includes('delete'));
  assert(vendorAudit !== undefined, 'Vendor lifecycle actions logged in auditLogs');

  const agentAudit = allLogs.find(l => (l.recordId === testAgentId || (l.details && l.details.includes(testAgent.name))) && l.action && l.action.toLowerCase().includes('delete'));
  assert(agentAudit !== undefined, 'Agent lifecycle actions logged in auditLogs');

  // Summary
  console.log('\n========================================================================');
  console.log(`RESULTS: Passed: ${passed} | Failed: ${failed}`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch(err => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
