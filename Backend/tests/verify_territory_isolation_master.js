require('dotenv').config();
const { db, initDatabase } = require('../config/db');
const managerDirectoryController = require('../controllers/managerDirectoryController');
const reportController = require('../controllers/reportController');
const notificationController = require('../controllers/notificationController');
const executiveController = require('../controllers/executiveController');

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

async function runMasterVerification() {
  console.log('========================================================================');
  console.log('🚀 RUNNING MASTER VERIFICATION: STATE ADMIN DATA ISOLATION & APPROVAL');
  console.log('========================================================================\n');

  await initDatabase();

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} - ${details}`);
      failed++;
    }
  }

  // 1. Identify Test Users in DB
  const karnatakaAdmin = Array.from(db.users).find(u => u.email === 'dinesh12@gmail.com') || {
    id: 'karnataka_admin_1',
    _id: 'karnataka_admin_1',
    name: 'Dinesh',
    email: 'dinesh12@gmail.com',
    role: 'admin',
    adminRole: 'state-admin',
    adminLevel: 'state',
    state: 'Karnataka'
  };

  const tnAdmin = Array.from(db.users).find(u => u.email === 'stateadmin_tn@connect.com') ||
                  Array.from(db.users).find(u => u.role === 'State Admin' && u.state === 'Tamil Nadu') || {
    id: 'tn_admin_1',
    _id: 'tn_admin_1',
    name: 'Tamil Nadu State Admin',
    email: 'stateadmin_tn@connect.com',
    role: 'State Admin',
    adminRole: 'state-admin',
    adminLevel: 'state',
    state: 'Tamil Nadu'
  };

  console.log(`Found Karnataka Admin: ${karnatakaAdmin.name} (${karnatakaAdmin.email}), State: ${karnatakaAdmin.state}`);
  console.log(`Found Tamil Nadu Admin: ${tnAdmin.name} (${tnAdmin.email}), State: ${tnAdmin.state}\n`);

  // ── TEST SUITE 1: MANAGER DIRECTORY DATA ISOLATION & BALA RETRIEVAL ──
  console.log('--- Test Suite 1: Manager Directory Isolation (Issue 1) ---');
  {
    const { req, res } = createMockReqRes({
      user: karnatakaAdmin,
      query: { level: 'state', status: 'active' }
    });
    await managerDirectoryController.getLowerLevelManagers(req, res);
    const data = res.getData();
    const subs = data?.subordinates || [];
    
    assert(res.getStatusCode() === 200, 'Karnataka State Admin manager query returns HTTP 200');
    assert(subs.length > 0, `Karnataka State Admin retrieves manager records (count: ${subs.length})`);
    
    const balaFound = subs.some(m => m.name.toLowerCase().includes('bala') && m.state === 'Karnataka');
    assert(balaFound, 'Karnataka State Admin successfully sees Bala (State Manager, Karnataka)');

    const tnLeaked = subs.some(m => (m.state && m.state.toLowerCase() === 'tamil nadu'));
    assert(!tnLeaked, 'Zero Tamil Nadu managers leaked to Karnataka State Admin');
  }

  // Check Tamil Nadu Admin does not see Bala
  {
    const { req, res } = createMockReqRes({
      user: tnAdmin,
      query: { level: 'state', status: 'active' }
    });
    await managerDirectoryController.getLowerLevelManagers(req, res);
    const data = res.getData();
    const subs = data?.subordinates || [];

    const balaInTn = subs.some(m => m.name.toLowerCase().includes('bala') || m.state === 'Karnataka');
    assert(!balaInTn, 'Tamil Nadu Admin sees 0 Karnataka managers (Bala not visible in TN)');
  }

  // ── TEST SUITE 2: BUSINESS REPORTS DATA ISOLATION & TERRITORY ENRICHMENT ──
  console.log('\n--- Test Suite 2: Business Reports Data Isolation (Issue 2) ---');
  {
    const { req, res } = createMockReqRes({
      user: karnatakaAdmin,
      query: {}
    });
    await reportController.getSubmittedReports(req, res);
    const data = res.getData();
    const reports = data?.data || data?.reports || [];

    assert(res.getStatusCode() === 200, 'Karnataka State Admin reports query returns HTTP 200');
    assert(reports.length === 2, `Karnataka State Admin retrieves exactly 2 reports for Karnataka (got: ${reports.length})`);

    const allKarnataka = reports.every(r => (r.state && r.state.toLowerCase() === 'karnataka') || (r.territory && r.territory.toLowerCase().includes('karnataka')));
    assert(allKarnataka, 'All reports returned belong exclusively to Karnataka territory');

    const tnReportLeaked = reports.some(r => (r.state && r.state.toLowerCase() === 'tamil nadu') || (r.territory && r.territory.toLowerCase().includes('tamil nadu')));
    assert(!tnReportLeaked, 'Zero Tamil Nadu reports leaked to Karnataka State Admin');

    const hasEmptyTerritory = reports.some(r => !r.territory || r.territory.trim() === '—' || r.territory.trim() === '-');
    assert(!hasEmptyTerritory, 'All Karnataka reports have properly formatted territory (no "—")');
  }

  // ── TEST SUITE 3: NOTIFICATIONS TERRITORY SCOPING ──
  console.log('\n--- Test Suite 3: Notifications Territory Scoping (Issue 3) ---');
  {
    const { req, res } = createMockReqRes({
      user: karnatakaAdmin,
      query: {}
    });
    await notificationController.getNotifications(req, res);
    const data = res.getData();
    const notifs = data?.notifications || [];

    assert(res.getStatusCode() === 200, 'Karnataka State Admin notifications query returns HTTP 200');
    
    const tnNotifsLeaked = notifs.some(n => {
      const msg = (n.message || '').toLowerCase();
      const scope = (n.scope || '').toLowerCase();
      return msg.includes('salem') || msg.includes('thalaivasal') || msg.includes('tamil nadu') || scope.includes('tamil nadu') || scope.includes('salem');
    });
    assert(!tnNotifsLeaked, `Zero Tamil Nadu events leaked to Karnataka State Admin (total notifs: ${notifs.length})`);
  }

  // ── TEST SUITE 4: AGENT REGISTRATION & APPROVAL WORKFLOW ──
  console.log('\n--- Test Suite 4: Agent Registration & Approval Workflow (Issue 4) ---');
  {
    // A. Verify canAdminViewAgent vs isRelatedAdminForAgent logic
    const divisionalAgent = {
      _id: 'test_div_agent_1',
      id: 'test_div_agent_1',
      name: 'Ravi Kumar',
      role: 'division',
      level: 3,
      state: 'Tamil Nadu',
      district: 'Salem',
      division: 'Thalaivasal',
      pincode: '636112',
      status: 'pending'
    };

    const divisionAdminThalaivasal = Array.from(db.users).find(u => u.email === 'selvi@gmail.com') || {
      _id: 'div_admin_thalaivasal',
      id: 'div_admin_thalaivasal',
      name: 'Selvi',
      email: 'selvi@gmail.com',
      role: 'Division Admin',
      adminRole: 'division-admin',
      adminLevel: 'division',
      state: 'Tamil Nadu',
      district: 'Salem',
      division: 'Thalaivasal'
    };
    if (!divisionAdminThalaivasal.division) {
      divisionAdminThalaivasal.division = 'Thalaivasal';
    }

    // State Admin viewing Divisional Agent within same state:
    const canStateAdminView = executiveController.canAdminViewAgent(tnAdmin, divisionalAgent);
    assert(canStateAdminView === true, 'Tamil Nadu State Admin can VIEW Divisional Agent request in their state');

    // State Admin attempting to APPROVE Divisional Agent:
    const canStateAdminApprove = executiveController.isRelatedAdminForAgent(tnAdmin, divisionalAgent);
    assert(canStateAdminApprove === false, 'Tamil Nadu State Admin CANNOT approve Divisional Agent request (canApprove = false)');

    // Divisional Admin attempting to APPROVE Divisional Agent:
    const canDivAdminApprove = executiveController.isRelatedAdminForAgent(divisionAdminThalaivasal, divisionalAgent);
    assert(canDivAdminApprove === true, 'Thalaivasal Division Admin CAN approve Divisional Agent request (canApprove = true)');

    // Cross-state State Admin viewing Divisional Agent:
    const canKarnatakaAdminViewTnAgent = executiveController.canAdminViewAgent(karnatakaAdmin, divisionalAgent);
    assert(canKarnatakaAdminViewTnAgent === false, 'Karnataka State Admin CANNOT view Tamil Nadu Divisional Agent request');

    // B. Test API Level Enforcement: State Admin calling approveAgent on Divisional Agent
    // Ensure agent exists in db
    if (!db.agents) db.agents = [];
    const existingIdx = db.agents.findIndex(a => String(a.id || a._id) === divisionalAgent.id);
    if (existingIdx >= 0) {
      db.agents[existingIdx] = divisionalAgent;
    } else {
      db.agents.push(divisionalAgent);
    }
    if (db.users) {
      const uIdx = db.users.findIndex(u => String(u.id || u._id) === divisionalAgent.id);
      if (uIdx >= 0) db.users[uIdx] = divisionalAgent;
      else db.users.push(divisionalAgent);
    }

    const { req: approveReq, res: approveRes } = createMockReqRes({
      user: tnAdmin, // State Admin
      params: { id: divisionalAgent.id }
    });
    await executiveController.approveAgent(approveReq, approveRes);
    
    assert(approveRes.getStatusCode() === 403, `State Admin calling approveAgent on Divisional Agent rejected with HTTP 403 (got: ${approveRes.getStatusCode()})`);
  }

  // ── TEST SUITE 5: DYNAMIC TERRITORY & ZERO HARDCODING CHECK ──
  console.log('\n--- Test Suite 5: Dynamic Territory Check ---');
  {
    // A. Check that an admin with state 'Maharashtra' gets strictly scoped without errors
    const maharashtraAdmin = {
      id: 'mh_admin',
      _id: 'mh_admin',
      name: 'Pooja',
      role: 'admin',
      adminRole: 'state-admin',
      adminLevel: 'state',
      state: 'Maharashtra'
    };

    const { req, res } = createMockReqRes({
      user: maharashtraAdmin,
      query: {}
    });
    await reportController.getSubmittedReports(req, res);
    const data = res.getData();
    assert(res.getStatusCode() === 200, 'Dynamic state (Maharashtra) handled gracefully without hardcoded defaults');
    assert((data?.data || data?.reports || []).length === 0, 'Maharashtra State Admin gets 0 reports (no leakage from TN or KA)');
  }

  console.log('\n========================================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runMasterVerification().catch(err => {
  console.error('Fatal error during master verification:', err);
  process.exit(1);
});
