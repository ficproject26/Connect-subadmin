require('dotenv').config();
const assert = require('assert');
const { db, initDatabase } = require('../config/db');
const executiveController = require('../controllers/executiveController');
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

async function runRegressionSuite() {
  console.log('========================================================================');
  console.log('🧪 RUNNING TARGETED BUG FIXES & TERRITORY FILTERS REGRESSION SUITE');
  console.log('========================================================================\n');

  await initDatabase();

  let passed = 0;
  let failed = 0;

  function test(condition, name, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  // Define test administrators
  const stateAdmin = {
    id: 'test_state_admin_tn',
    _id: 'test_state_admin_tn',
    name: 'Tamil Nadu State Admin',
    email: 'tn_admin@connect.com',
    role: 'State Admin',
    state: 'Tamil Nadu'
  };

  const salemDistrictAdmin = {
    id: 'test_district_admin_salem',
    _id: 'test_district_admin_salem',
    name: 'Salem District Admin',
    email: 'salem_admin@connect.com',
    role: 'District Admin',
    state: 'Tamil Nadu',
    district: 'Salem'
  };

  const atturDivisionAdmin = {
    id: 'test_div_admin_attur',
    _id: 'test_div_admin_attur',
    name: 'Attur Division Admin',
    email: 'attur_admin@connect.com',
    role: 'Division Admin',
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Attur'
  };

  const pincodeAdmin = {
    id: 'test_pin_admin_636102',
    _id: 'test_pin_admin_636102',
    name: 'Attur Pincode Admin',
    email: 'pin636102@connect.com',
    role: 'Pincode Admin',
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Attur',
    pincode: '636102'
  };

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 1: AGENT REQUESTS - PENDING REASON & APPROVAL WORKFLOW
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 1. Testing Agent Request Pending & Approval Workflow ---');

  // Create a mock agent application
  const testAgentId = `test_agent_${Date.now()}`;
  const mockAgent = {
    _id: testAgentId,
    id: testAgentId,
    name: 'Test Onboarding Agent',
    email: `test_agent_${Date.now()}@connect.com`,
    phone: '9876543210',
    role: 'District Agent',
    level: 'district',
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Attur',
    pincode: '636102',
    territory: {
      state: 'Tamil Nadu',
      district: 'Salem',
      division: 'Attur',
      pincode: '636102'
    },
    status: 'pending',
    adminApprovalStatus: 'pending',
    pendingReason: 'Please upload a clear copy of Bank passbook.',
    adminNotes: 'Please upload a clear copy of Bank passbook.',
    adminPendingBy: 'Salem District Admin',
    adminPendingByRole: 'District Admin',
    adminPendingAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  await db.agents.insertOne(mockAgent);

  // 1.1 Verify pending agent returns pendingReason when pending
  const { req: getReq1, res: getRes1 } = createMockReqRes({
    user: stateAdmin
  });
  await executiveController.getAgentRequests(getReq1, getRes1);
  const get1Data = getRes1.getData();
  const foundAgent1 = (get1Data.requests || []).find(r => r.id === testAgentId);
  test(
    foundAgent1 && foundAgent1.pendingReason === 'Please upload a clear copy of Bank passbook.' && foundAgent1.reviewerReason === 'Please upload a clear copy of Bank passbook.',
    'Pending agent request displays current pending reason when status is pending'
  );

  // 1.2 Approve the agent request as authorized approver
  const { req: approveReq, res: approveRes } = createMockReqRes({
    user: salemDistrictAdmin,
    params: { id: testAgentId }
  });
  await executiveController.approveAgent(approveReq, approveRes);
  const approveData = approveRes.getData();
  test(
    approveRes.getStatusCode() === 200 && approveData.success === true,
    'Authorized District Admin can approve subordinate agent request'
  );

  // 1.3 Verify that once approved, pendingReason is cleared and not displayed as active reason
  const { req: getReq2, res: getRes2 } = createMockReqRes({
    user: stateAdmin
  });
  await executiveController.getAgentRequests(getReq2, getRes2);
  const get2Data = getRes2.getData();
  const foundAgent2 = (get2Data.requests || []).find(r => r.id === testAgentId);
  test(
    foundAgent2 && (foundAgent2.status === 'Active' || foundAgent2.status === 'approved'),
    'Approved agent status updated to Active / approved'
  );
  test(
    foundAgent2 && foundAgent2.pendingReason === null,
    'Approved agent pendingReason is cleared in backend response (obsolete reason removed)'
  );
  test(
    foundAgent2 && foundAgent2.reviewerReason && foundAgent2.reviewerReason.includes('Approved by Salem District Admin'),
    'Approved agent reviewerReason shows Approval attribution instead of stale pending reason'
  );
  test(
    foundAgent2 && Array.isArray(foundAgent2.reviewHistory) && foundAgent2.reviewHistory.length > 0 && foundAgent2.reviewHistory.some(h => h.action === 'APPROVED'),
    'Review history audit trail preserved in agent document'
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 2: VENDOR TERRITORY FILTERING & STRICT ISOLATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 2. Testing Vendor Territory Hierarchy Filters & Security Isolation ---');

  // Insert test vendors across different districts & divisions
  const vSalemAttur = {
    _id: `v_salem_attur_${Date.now()}`,
    id: `v_salem_attur_${Date.now()}`,
    name: 'Attur Spices',
    businessName: 'Attur Spices',
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Attur',
    pincode: '636102',
    category: 'Daily Needs',
    status: 'Active',
    kycStatus: 'Verified'
  };

  const vSalemOmalur = {
    _id: `v_salem_omalur_${Date.now()}`,
    id: `v_salem_omalur_${Date.now()}`,
    name: 'Omalur Silks',
    businessName: 'Omalur Silks',
    state: 'Tamil Nadu',
    district: 'Salem',
    division: 'Omalur',
    pincode: '636455',
    category: 'Product',
    status: 'Active',
    kycStatus: 'Verified'
  };

  const vMadurai = {
    _id: `v_madurai_${Date.now()}`,
    id: `v_madurai_${Date.now()}`,
    name: 'Madurai Textiles',
    businessName: 'Madurai Textiles',
    state: 'Tamil Nadu',
    district: 'Madurai',
    division: 'Vadipatti',
    pincode: '625214',
    category: 'Product',
    status: 'Active',
    kycStatus: 'Verified'
  };

  const vBangalore = {
    _id: `v_blr_${Date.now()}`,
    id: `v_blr_${Date.now()}`,
    name: 'Bangalore Tech Shop',
    businessName: 'Bangalore Tech Shop',
    state: 'Karnataka',
    district: 'Bangalore Urban',
    division: 'South',
    pincode: '560001',
    category: 'Services',
    status: 'Active',
    kycStatus: 'Verified'
  };

  db.vendors.push(vSalemAttur, vSalemOmalur, vMadurai, vBangalore);

  // 2.1 State Admin gets all TN vendors, never Karnataka
  const { req: vReqState, res: vResState } = createMockReqRes({
    user: stateAdmin
  });
  await vendorController.getVendors(vReqState, vResState);
  if (vResState.getStatusCode() !== 200) {
    console.error('getVendors ERROR:', vResState.getStatusCode(), vResState.getData());
  }
  const stateVendors = vResState.getData()?.vendors || [];
  test(
    stateVendors.some(v => v.id === vSalemAttur.id) &&
    stateVendors.some(v => v.id === vMadurai.id) &&
    !stateVendors.some(v => v.id === vBangalore.id),
    'State Admin sees all state vendors (Salem, Madurai) and never cross-state vendors (Bangalore)'
  );

  // 2.2 State Admin cascading drill-down by District
  const { req: vReqDist, res: vResDist } = createMockReqRes({
    user: stateAdmin,
    query: { district: 'Salem' }
  });
  await vendorController.getVendors(vReqDist, vResDist);
  const salemVendors = vResDist.getData().vendors || [];
  test(
    salemVendors.some(v => v.id === vSalemAttur.id) &&
    salemVendors.some(v => v.id === vSalemOmalur.id) &&
    !salemVendors.some(v => v.id === vMadurai.id),
    'State Admin filtering by District=Salem returns only Salem vendors'
  );

  // 2.3 State Admin cascading drill-down by Division
  const { req: vReqDiv, res: vResDiv } = createMockReqRes({
    user: stateAdmin,
    query: { district: 'Salem', division: 'Attur' }
  });
  await vendorController.getVendors(vReqDiv, vResDiv);
  const atturVendors = vResDiv.getData().vendors || [];
  test(
    atturVendors.some(v => v.id === vSalemAttur.id) &&
    !atturVendors.some(v => v.id === vSalemOmalur.id),
    'State Admin filtering by District=Salem & Division=Attur returns only Attur vendors'
  );

  // 2.4 State Admin cascading drill-down by Pincode
  const { req: vReqPin, res: vResPin } = createMockReqRes({
    user: stateAdmin,
    query: { district: 'Salem', division: 'Attur', pincode: '636102' }
  });
  await vendorController.getVendors(vReqPin, vResPin);
  const pinVendors = vResPin.getData().vendors || [];
  test(
    pinVendors.some(v => v.id === vSalemAttur.id) &&
    !pinVendors.some(v => v.id === vSalemOmalur.id),
    'State Admin filtering by Pincode=636102 returns exact pincode vendors'
  );

  // 2.5 Security Enforcement: District Admin can NEVER retrieve vendors from another district
  const { req: vReqDistSec, res: vResDistSec } = createMockReqRes({
    user: salemDistrictAdmin,
    query: { district: 'Madurai' } // Attempt to bypass or request another district
  });
  await vendorController.getVendors(vReqDistSec, vResDistSec);
  const distSecVendors = vResDistSec.getData().vendors || [];
  test(
    !distSecVendors.some(v => v.id === vMadurai.id) &&
    distSecVendors.every(v => (v.district || '').toLowerCase() === 'salem'),
    'Security: District Admin cannot bypass district scope even if passing another district parameter'
  );

  // 2.6 Security Enforcement: Division Admin can NEVER retrieve vendors outside assigned division
  const { req: vReqDivSec, res: vResDivSec } = createMockReqRes({
    user: atturDivisionAdmin,
    query: { division: 'Omalur' }
  });
  await vendorController.getVendors(vReqDivSec, vResDivSec);
  const divSecVendors = vResDivSec.getData().vendors || [];
  test(
    !divSecVendors.some(v => v.id === vSalemOmalur.id) &&
    divSecVendors.every(v => (v.division || '').toLowerCase().includes('attur')),
    'Security: Division Admin strictly restricted to Attur division'
  );

  // 2.7 Security Enforcement: Pincode Admin strictly restricted to assigned pincode
  const { req: vReqPinSec, res: vResPinSec } = createMockReqRes({
    user: pincodeAdmin
  });
  await vendorController.getVendors(vReqPinSec, vResPinSec);
  const pinSecVendors = vResPinSec.getData().vendors || [];
  test(
    pinSecVendors.some(v => v.id === vSalemAttur.id) &&
    !pinSecVendors.some(v => v.id === vSalemOmalur.id) &&
    !pinSecVendors.some(v => v.id === vMadurai.id),
    'Security: Pincode Admin strictly restricted to assigned pincode 636102'
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 3: DIVISIONAL AGENT REGISTRY UI SPECIFICATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 3. Testing Divisional Agent Registry UI Columns ---');

  const fs = require('fs');
  const path = require('path');

  // Verify state-admin/Agents.jsx excludes Wallet Balance for divisional agents
  const stateAgentsCode = fs.readFileSync(path.join(__dirname, '../../Frontend/src/pages/state-admin/Agents.jsx'), 'utf-8');
  test(
    stateAgentsCode.includes("activeLevel === 'divisional' ? [] :") &&
    stateAgentsCode.includes("header: 'Wallet Balance'"),
    'state-admin/Agents.jsx conditionally removes Wallet Balance column for divisional agents'
  );

  // Verify district-admin/Agents.jsx excludes Wallet Balance for divisional agents
  const districtAgentsCode = fs.readFileSync(path.join(__dirname, '../../Frontend/src/pages/district-admin/Agents.jsx'), 'utf-8');
  test(
    districtAgentsCode.includes("activeLevel === 'divisional' ? [] :") &&
    districtAgentsCode.includes("header: 'Wallet Balance'"),
    'district-admin/Agents.jsx conditionally removes Wallet Balance column for divisional agents'
  );

  // Verify divisional-admin/Agents.jsx does not have Wallet Balance column in columns array
  const divAgentsCode = fs.readFileSync(path.join(__dirname, '../../Frontend/src/pages/divisional-admin/Agents.jsx'), 'utf-8');
  test(
    !divAgentsCode.includes("header: 'Wallet Balance'"),
    'divisional-admin/Agents.jsx has Wallet Balance column removed from columns array'
  );

  console.log('\n========================================================================');
  console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runRegressionSuite().catch(err => {
  console.error('Fatal error during test suite execution:', err);
  process.exit(1);
});
