require('dotenv').config();
const { db, initDatabase } = require('../config/db');
const { isFullyOnboardedVendor } = require('../utils/vendorOnboardingHelper');
const vendorController = require('../controllers/vendorController');

function createMockReqRes({ user, query = {}, params = {}, body = {} }) {
  const req = {
    user,
    query,
    params,
    body,
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

async function runSubAdminVendorVerification() {
  console.log('========================================================================');
  console.log('🧪 RUNNING SUB ADMIN GLOBAL VENDOR LISTING VERIFICATION SUITE');
  console.log('========================================================================\n');

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

  // 1. Unit Tests for isFullyOnboardedVendor rule engine
  console.log('[1] Testing isFullyOnboardedVendor rule engine...');

  assert(
    isFullyOnboardedVendor({
      status: 'active',
      kycStatus: 'Approved',
      approvalStatus: 'APPROVED'
    }) === true,
    'Fully approved active vendor is eligible'
  );

  assert(
    isFullyOnboardedVendor({
      status: 'active',
      kycStatus: 'Verified',
      approvalStatus: 'PINCODE_ADMIN_APPROVED'
    }) === true,
    'Verified KYC active vendor with pincode approval is eligible'
  );

  assert(
    isFullyOnboardedVendor({
      status: 'Pending Pincode Admin Approval',
      kycStatus: 'Pending',
      approvalStatus: 'PENDING_PINCODE_APPROVAL'
    }) === false,
    'Pending pincode approval vendor is excluded'
  );

  assert(
    isFullyOnboardedVendor({
      status: 'Pending KYC Review',
      kycStatus: 'KYC Pending',
      approvalStatus: 'PINCODE_APPROVED'
    }) === false,
    'Pending KYC review vendor is excluded'
  );

  assert(
    isFullyOnboardedVendor({
      status: 'Rejected',
      kycStatus: 'Rejected',
      approvalStatus: 'REJECTED'
    }) === false,
    'Rejected vendor is excluded'
  );

  assert(
    isFullyOnboardedVendor({
      status: 'active',
      kycStatus: 'Pending',
      approvalStatus: 'APPROVED'
    }) === false,
    'Active vendor with KYC pending is excluded'
  );

  assert(
    isFullyOnboardedVendor(null) === false && isFullyOnboardedVendor({}) === false,
    'Null or empty vendor is excluded'
  );

  // 2. Connect to Database and verify real vendor data
  console.log('\n[2] Connecting to Database and verifying live vendor collection...');
  await initDatabase();

  const allVendors = Array.from(db.vendors);
  console.log(`Total vendor records in database: ${allVendors.length}`);
  assert(allVendors.length > 0, `Database contains vendor records (found ${allVendors.length})`);

  const onboardedVendors = allVendors.filter(isFullyOnboardedVendor);
  const incompleteVendors = allVendors.filter(v => !isFullyOnboardedVendor(v));

  console.log(`- Fully Onboarded Vendors: ${onboardedVendors.length}`);
  console.log(`- Incomplete / Requests: ${incompleteVendors.length}`);

  assert(onboardedVendors.length > 0, `Found fully onboarded vendors (${onboardedVendors.length})`);
  assert(incompleteVendors.length > 0, `Found incomplete/request vendors preserved in DB (${incompleteVendors.length})`);

  // Verify none of the incomplete vendors appear in onboarded list
  const hasIncompleteInOnboarded = onboardedVendors.some(v => {
    const s = (v.status || '').toLowerCase();
    const k = (v.kycStatus || '').toLowerCase();
    const a = (v.approvalStatus || '').toLowerCase();
    return s.includes('pending') || s.includes('rejected') ||
           k.includes('pending') || k.includes('rejected') ||
           a.includes('pending') || a.includes('rejected');
  });
  assert(!hasIncompleteInOnboarded, 'No pending, rejected, or incomplete records exist in the onboarded dataset');

  // 3. Controller API test for each Sub Admin Role
  console.log('\n[3] Testing vendorController.getVendors for all 4 Sub Admin Roles...');

  // State Admin test
  {
    const stateAdminUser = {
      role: 'state_admin',
      state: 'Tamil Nadu'
    };
    const { req, res } = createMockReqRes({ user: stateAdminUser, query: {} });
    await vendorController.getVendors(req, res);
    const data = res.getData();
    assert(data && data.success, 'State Admin getVendors succeeds');
    const returned = data.vendors || [];
    assert(returned.length > 0, `State Admin received ${returned.length} vendors`);
    assert(returned.every(isFullyOnboardedVendor), 'Every vendor returned to State Admin is fully onboarded');
  }

  // District Admin test
  {
    const districtAdminUser = {
      role: 'district_admin',
      state: 'Tamil Nadu',
      district: 'Salem'
    };
    const { req, res } = createMockReqRes({ user: districtAdminUser, query: {} });
    await vendorController.getVendors(req, res);
    const data = res.getData();
    assert(data && data.success, 'District Admin getVendors succeeds');
    const returned = data.vendors || [];
    assert(returned.length > 0, `District Admin (Salem) received ${returned.length} vendors`);
    assert(returned.every(isFullyOnboardedVendor), 'Every vendor returned to District Admin is fully onboarded');
    assert(returned.every(v => (v.district || '').toLowerCase() === 'salem'), 'All returned vendors are within Salem district territory');
  }

  // Division Admin test
  {
    const divisionAdminUser = {
      role: 'division_admin',
      state: 'Tamil Nadu',
      district: 'Salem',
      division: 'Attur'
    };
    const { req, res } = createMockReqRes({ user: divisionAdminUser, query: {} });
    await vendorController.getVendors(req, res);
    const data = res.getData();
    assert(data && data.success, 'Division Admin getVendors succeeds');
    const returned = data.vendors || [];
    assert(returned.length > 0, `Division Admin (Attur) received ${returned.length} vendors`);
    assert(returned.every(isFullyOnboardedVendor), 'Every vendor returned to Division Admin is fully onboarded');
    assert(returned.every(v => (v.division || '').toLowerCase().replace(/\s+division$/i, '') === 'attur'), 'All returned vendors are within Attur Division territory');
  }

  // Pincode Admin test
  {
    const pincodeAdminUser = {
      role: 'pincode_admin',
      state: 'Tamil Nadu',
      district: 'Salem',
      division: 'Attur',
      pincode: '636102'
    };
    const { req, res } = createMockReqRes({ user: pincodeAdminUser, query: {} });
    await vendorController.getVendors(req, res);
    const data = res.getData();
    assert(data && data.success, 'Pincode Admin getVendors succeeds');
    const returned = data.vendors || [];
    assert(returned.length > 0, `Pincode Admin (636102) received ${returned.length} vendors`);
    assert(returned.every(isFullyOnboardedVendor), 'Every vendor returned to Pincode Admin is fully onboarded');
    assert(returned.every(v => String(v.pincode).trim() === '636102'), 'All returned vendors are within Pincode 636102 territory');
  }

  // 4. Verify Vendor Requests Endpoint Retains All Request Records
  console.log('\n[4] Testing vendorController.getVendorRequests for all request statuses...');
  {
    const subAdminUser = {
      role: 'state_admin',
      state: 'Tamil Nadu'
    };
    const { req, res } = createMockReqRes({ user: subAdminUser, query: {} });
    await vendorController.getVendorRequests(req, res);
    const data = res.getData();
    assert(data && data.success, 'getVendorRequests succeeds');
    const requests = data.requests || [];
    assert(requests.length > 0, `getVendorRequests returned ${requests.length} total request records`);

    // Verify requests contains pending or incomplete records
    const pendingReqs = requests.filter(r => (r.status || '').toLowerCase().includes('pending') || (r.kycStatus || '').toLowerCase().includes('pending'));
    const rejectedReqs = requests.filter(r => (r.status || '').toLowerCase().includes('reject') || (r.kycStatus || '').toLowerCase().includes('reject'));
    console.log(`- Vendor Requests pending: ${pendingReqs.length}`);
    console.log(`- Vendor Requests rejected: ${rejectedReqs.length}`);
    assert(pendingReqs.length > 0, 'Vendor Requests retains pending request records');
    assert(rejectedReqs.length > 0, 'Vendor Requests retains rejected request records');
  }

  console.log(`\n========================================`);
  console.log(`Total tests passed: ${passed}`);
  console.log(`Total tests failed: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSubAdminVendorVerification().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
