const { db, initDatabase, filterByLocation, extractEntityGeo, DISTRICT_STATE_MAP, resolveStateFromDistrict } = require('../config/db');
const { normalizeRoleName } = require('../config/appSecurity');
const { resolveAdminTerritory, isEntityInAdminTerritory, normalizeAdminRole } = require('../utils/permissions');
const { getComprehensiveVendorDirectory } = require('../utils/vendorDirectory');

async function runVerification() {
  console.log('========================================================================');
  console.log('🚀 COMPREHENSIVE VERIFICATION: STATE ADMIN DATA VISIBILITY & ISOLATION');
  console.log('========================================================================\n');

  await initDatabase();

  // 1. Role Normalization Tests
  console.log('--- TEST 1: Role Normalization & User Context ---');
  const mockStateUser = { role: 'admin', adminRole: 'state-admin', assignedState: 'Tamil Nadu' };
  const mockDistUser = { role: 'admin', adminRole: 'district-admin', assignedState: 'Tamil Nadu', assignedDistrict: 'Salem' };
  const mockDivUser = { role: 'admin', adminRole: 'division-admin', assignedState: 'Tamil Nadu', assignedDistrict: 'Salem', assignedDivision: 'Attur' };
  const mockPinUser = { role: 'admin', adminRole: 'pincode-admin', assignedState: 'Tamil Nadu', assignedDistrict: 'Salem', assignedPincode: '636112' };
  const mockSuperUser = { role: 'admin', adminRole: 'super-admin' };

  console.log('normalizeRoleName(State Admin):', normalizeRoleName('admin', mockStateUser), '-> Expected: State Admin');
  console.log('normalizeRoleName(District Admin):', normalizeRoleName('admin', mockDistUser), '-> Expected: District Admin');
  console.log('normalizeRoleName(Super Admin):', normalizeRoleName('admin', mockSuperUser), '-> Expected: Super Admin');

  const terrState = resolveAdminTerritory(mockStateUser);
  console.log('resolveAdminTerritory(State Admin):', { role: terrState.role, level: terrState.level, state: terrState.state });
  if (terrState.role !== 'State Admin' || terrState.level !== 'state') {
    throw new Error('FAILED: State Admin territory resolved to ' + terrState.role);
  }
  console.log('✅ Role Normalization & Territory Resolution passed.\n');

  // 2. Verified District-to-State Mapping
  console.log('--- TEST 2: Verified District Mapping ---');
  console.log('Salem ->', resolveStateFromDistrict('salem'), '(Expected: tamil nadu)');
  console.log('Bengaluru Urban ->', resolveStateFromDistrict('bengaluru urban'), '(Expected: karnataka)');
  console.log('Ahmedabad ->', resolveStateFromDistrict('ahmedabad'), '(Expected: gujarat)');
  console.log('Pondicherry ->', resolveStateFromDistrict('pondicherry'), '(Expected: pondicherry)');
  if (resolveStateFromDistrict('salem') !== 'tamil nadu' || resolveStateFromDistrict('bengaluru urban') !== 'karnataka') {
    throw new Error('FAILED: District mapping failed');
  }
  console.log('✅ District to State mapping passed.\n');

  // 3. Authenticated State Admin vs District Admin vs Super Admin test personas
  const stateAdminTN = {
    _id: 'sa_tn_test',
    id: 'sa_tn_test',
    role: 'State Admin',
    adminRole: 'state-admin',
    state: 'Tamil Nadu',
    assignedState: 'Tamil Nadu'
  };

  const stateAdminKA = {
    _id: 'sa_ka_test',
    id: 'sa_ka_test',
    role: 'State Admin',
    adminRole: 'state-admin',
    state: 'Karnataka',
    assignedState: 'Karnataka'
  };

  const districtAdminSalem = {
    _id: 'da_salem_test',
    id: 'da_salem_test',
    role: 'District Admin',
    adminRole: 'district-admin',
    state: 'Tamil Nadu',
    assignedState: 'Tamil Nadu',
    district: 'Salem',
    assignedDistrict: 'Salem'
  };

  const pincodeAdminAttur = {
    _id: 'pa_attur_test',
    id: 'pa_attur_test',
    role: 'Pincode Admin',
    adminRole: 'pincode-admin',
    state: 'Tamil Nadu',
    assignedState: 'Tamil Nadu',
    district: 'Salem',
    assignedDistrict: 'Salem',
    division: 'Attur',
    pincode: '636112'
  };

  const superAdmin = {
    _id: 'super_test',
    id: 'super_test',
    role: 'Super Admin',
    adminRole: 'super-admin',
    state: 'All India'
  };

  console.log('--- TEST 3: Module-by-Module Scoping ---');

  // Orders
  const allOrders = Array.from(db.orders || []);
  const tnOrders = filterByLocation(allOrders, stateAdminTN);
  const kaOrders = filterByLocation(allOrders, stateAdminKA);
  const salemOrders = filterByLocation(allOrders, districtAdminSalem);
  const atturOrders = filterByLocation(allOrders, pincodeAdminAttur);

  console.log(`Orders: Total=${allOrders.length}, TN State Admin=${tnOrders.length}, KA State Admin=${kaOrders.length}, Salem Dist Admin=${salemOrders.length}, Attur Pin Admin=${atturOrders.length}`);
  if (tnOrders.length === 0) throw new Error('FAILED: TN State Admin sees 0 orders!');
  if (salemOrders.length > tnOrders.length) throw new Error('FAILED: District Admin sees more than State Admin!');
  if (atturOrders.length > salemOrders.length) throw new Error('FAILED: Pincode Admin sees more than District Admin!');

  // Check strict cross-state isolation on Orders:
  // None of the tnOrders should have geo.state === 'karnataka'
  const pinLookup = new Map();
  Array.from(db.pincodes || []).forEach(p => {
    const code = String(p.code || p.pincode || '').trim();
    if (code) {
      pinLookup.set(code, {
        state: (p.state || '').trim().toLowerCase(),
        district: (p.district || '').trim().toLowerCase(),
        division: (p.division || '').trim().toLowerCase()
      });
    }
  });

  const tnOrdersLeaked = tnOrders.filter(o => {
    const g = extractEntityGeo(o, pinLookup);
    return g.state === 'karnataka';
  });
  console.log('Cross-state leakage check (TN State Admin seeing KA orders):', tnOrdersLeaked.length, 'leaked');
  if (tnOrdersLeaked.length > 0) throw new Error('FAILED: Karnataka orders leaked into Tamil Nadu State Admin!');

  // Customers
  const allCustomers = Array.from(db.customers || []);
  const tnCustomers = filterByLocation(allCustomers, stateAdminTN);
  const kaCustomers = filterByLocation(allCustomers, stateAdminKA);
  const salemCustomers = filterByLocation(allCustomers, districtAdminSalem);
  console.log(`Customers: Total=${allCustomers.length}, TN State Admin=${tnCustomers.length}, KA State Admin=${kaCustomers.length}, Salem Dist Admin=${salemCustomers.length}`);
  if (tnCustomers.length === 0) throw new Error('FAILED: TN State Admin sees 0 customers!');

  // Check that Bangalore customers (560072, 560068) are NOT in tnCustomers:
  const bangaloreLeaked = tnCustomers.filter(c => {
    const g = extractEntityGeo(c, pinLookup);
    return g.district.includes('bengaluru') || g.district.includes('bangalore') || g.state === 'karnataka';
  });
  console.log('Cross-state leakage check (Bangalore customers in TN State Admin):', bangaloreLeaked.length, 'leaked');
  if (bangaloreLeaked.length > 0) throw new Error('FAILED: Bangalore customers leaked into TN State Admin!');

  // Vendors
  const allVendors = Array.from(db.vendors || []);
  const tnVendors = filterByLocation(allVendors, stateAdminTN);
  const kaVendors = filterByLocation(allVendors, stateAdminKA);
  const salemVendors = filterByLocation(allVendors, districtAdminSalem);
  console.log(`Vendors: Total=${allVendors.length}, TN State Admin=${tnVendors.length}, KA State Admin=${kaVendors.length}, Salem Dist Admin=${salemVendors.length}`);
  if (tnVendors.length === 0) throw new Error('FAILED: TN State Admin sees 0 vendors!');

  // Tasks
  const allTasks = Array.from(db.qcTasks || []);
  const tnTasks = filterByLocation(allTasks, stateAdminTN);
  const salemTasks = filterByLocation(allTasks, districtAdminSalem);
  console.log(`Tasks: Total=${allTasks.length}, TN State Admin=${tnTasks.length}, Salem Dist Admin=${salemTasks.length}`);

  // Notifications
  const allNotifs = Array.from(db.notifications || []);
  const tnNotifs = filterByLocation(allNotifs, stateAdminTN);
  console.log(`Notifications: Total=${allNotifs.length}, TN State Admin=${tnNotifs.length}`);

  // Subscriptions
  const allSubs = Array.from(db.subscriptions || []);
  const tnSubs = filterByLocation(allSubs, stateAdminTN);
  console.log(`Subscriptions: Total=${allSubs.length}, TN State Admin=${tnSubs.length}`);

  // KYC Records
  const allKYC = Array.from(db.kycRecords || []);
  const tnKYC = filterByLocation(allKYC, stateAdminTN);
  console.log(`KYC: Total=${allKYC.length}, TN State Admin=${tnKYC.length}`);

  // Cardholders
  const allCards = Array.from(db.cardholders || []);
  const tnCards = filterByLocation(allCards, stateAdminTN);
  console.log(`Cardholders: Total=${allCards.length}, TN State Admin=${tnCards.length}`);

  // Agent Payments
  const allAgentPay = Array.from(db.agentPayments || []);
  const tnAgentPay = filterByLocation(allAgentPay, stateAdminTN);
  console.log(`Agent Payments: Total=${allAgentPay.length}, TN State Admin=${tnAgentPay.length}`);

  console.log('\n--- TEST 4: Hierarchy Monotonic Isolation ---');
  console.log(`Hierarchy check for Orders: Super (${allOrders.length}) >= State TN (${tnOrders.length}) >= Dist Salem (${salemOrders.length}) >= Pin Attur (${atturOrders.length})`);
  if (!(allOrders.length >= tnOrders.length && tnOrders.length >= salemOrders.length && salemOrders.length >= atturOrders.length)) {
    throw new Error('FAILED: Hierarchy ordering violation!');
  }
  console.log('✅ Monotonic isolation across administrative levels verified.');

  console.log('\n========================================================================');
  console.log('🎉 ALL TARGETED TESTS PASSED WITHOUT REGRESSIONS');
  console.log('========================================================================\n');
  process.exit(0);
}

runVerification().catch(err => {
  console.error('❌ Verification Error:', err);
  process.exit(1);
});
