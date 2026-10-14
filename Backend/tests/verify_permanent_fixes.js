const assert = require('assert');
const bcrypt = require('bcryptjs');
const { formatCapitalizedName, validateName, getPasswordValidationState } = require('../utils/validation');
const { formatActorRole } = require('../controllers/vendorController');
const authController = require('../controllers/authController');
const managerDirectoryController = require('../controllers/managerDirectoryController');
const { initDatabase, db } = require('../config/db');

async function runTests() {
  console.log('=== STARTING PERMANENT FIXES VERIFICATION ===\n');

  // TEST 1: Vendor Directory Onboarding Role Formatting
  console.log('--- Test 1: Vendor Directory Onboarding Role Formatting ---');
  assert.strictEqual(formatActorRole('pincode', 'Agent'), 'Pincode Agent', 'Legacy "pincode" with Agent fallback formats to "Pincode Agent"');
  assert.strictEqual(formatActorRole('pin code', 'Agent'), 'Pincode Agent', 'Legacy "pin code" formats to "Pincode Agent"');
  assert.strictEqual(formatActorRole('pincodeagent', 'Agent'), 'Pincode Agent', '"pincodeagent" formats to "Pincode Agent"');
  assert.strictEqual(formatActorRole('district', 'Agent'), 'District Agent', '"district" formats to "District Agent"');
  assert.strictEqual(formatActorRole('division', 'Agent'), 'Divisional Agent', '"division" formats to "Divisional Agent"');
  assert.strictEqual(formatActorRole('state', 'Agent'), 'State Agent', '"state" formats to "State Agent"');
  assert.strictEqual(formatActorRole('pincode', 'Manager'), 'Pincode Manager', '"pincode" with Manager fallback formats to "Pincode Manager"');
  assert.strictEqual(formatActorRole('state_manager'), 'State Manager', '"state_manager" formats to "State Manager"');
  assert.strictEqual(formatActorRole('district_manager'), 'District Manager', '"district_manager" formats to "District Manager"');
  assert.strictEqual(formatActorRole('division_manager'), 'Divisional Manager', '"division_manager" formats to "Divisional Manager"');
  assert.strictEqual(formatActorRole('pincode_manager'), 'Pincode Manager', '"pincode_manager" formats to "Pincode Manager"');
  assert.strictEqual(formatActorRole('State Admin'), 'State Admin', '"State Admin" preserved');
  console.log('✓ All vendor directory role format tests passed.\n');

  // TEST 2: Name Formatting & Capitalization
  console.log('--- Test 2: Name Validation & Capitalization ---');
  assert.strictEqual(formatCapitalizedName('ravi kumar'), 'Ravi Kumar', 'Capitalizes simple names');
  assert.strictEqual(formatCapitalizedName('dinesh k'), 'Dinesh K', 'Capitalizes single letter last name');
  assert.strictEqual(formatCapitalizedName('mary-jane o\'connor'), 'Mary-Jane O\'Connor', 'Preserves hyphens and apostrophes');
  assert.strictEqual(formatCapitalizedName('   ananya   iyer   '), 'Ananya Iyer', 'Trims whitespace');
  assert.strictEqual(validateName('Ravi Kumar'), null, 'Valid name passes validation');
  assert.notStrictEqual(validateName('R'), null, 'Single letter name fails validation');
  console.log('✓ Name validation and capitalization tests passed.\n');

  // TEST 3: Password Validation Criteria
  console.log('--- Test 3: Password Security Requirements ---');
  const weak1 = getPasswordValidationState('short');
  assert.strictEqual(weak1.isValid, false, 'Short password rejected');

  const weak2 = getPasswordValidationState('alllowercase123!');
  assert.strictEqual(weak2.hasUpper, false, 'Missing uppercase detected');
  assert.strictEqual(weak2.isValid, false, 'Missing uppercase rejected');

  const weak3 = getPasswordValidationState('NoNumberHere!');
  assert.strictEqual(weak3.hasNumber, false, 'Missing number detected');
  assert.strictEqual(weak3.isValid, false, 'Missing number rejected');

  const weak4 = getPasswordValidationState('NoSpecialChar123');
  assert.strictEqual(weak4.hasSpecial, false, 'Missing special char detected');
  assert.strictEqual(weak4.isValid, false, 'Missing special char rejected');

  const strong = getPasswordValidationState('StrongPass123!');
  assert.strictEqual(strong.minLength, true, 'Length passed');
  assert.strictEqual(strong.hasUpper, true, 'Uppercase passed');
  assert.strictEqual(strong.hasNumber, true, 'Number passed');
  assert.strictEqual(strong.hasSpecial, true, 'Special char passed');
  assert.strictEqual(strong.isValid, true, 'Strong password accepted');
  console.log('✓ Password validation tests passed.\n');

  // TEST 4: Sub-Admin Profile & Settings API Endpoints
  console.log('--- Test 4: Sub-Admin Profile & Settings API ---');
  await initDatabase();

  const mockRes = () => {
    const res = {};
    res.statusCode = 200;
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.data = data; return res; };
    return res;
  };

  // Find a state admin user
  const stateAdminUser = Array.from(db.users || []).find(u => (u.role || '').toLowerCase().includes('state'));
  if (stateAdminUser) {
    const adminId = stateAdminUser._id || stateAdminUser.id;

    // Test GET /auth/me returns all registration fields without password
    const meRes = mockRes();
    await authController.getMe({ user: { id: adminId, role: stateAdminUser.role } }, meRes);
    assert.strictEqual(meRes.data.success, true, 'getMe succeeded');
    const profile = meRes.data.user;
    assert.ok(profile.subAdminId, 'Profile has subAdminId');
    assert.ok(profile.name, 'Profile has name');
    assert.ok(profile.role, 'Profile has role');
    assert.strictEqual(profile.password, undefined, 'Password is NOT exposed');
    assert.strictEqual(profile.passwordHash, undefined, 'Password hash is NOT exposed');
    console.log('✓ Profile schema details returned safely without password exposure');

    // Test Security Rule: Name, username, subAdminId are strictly READ-ONLY
    const tamperRes = mockRes();
    await authController.updateProfile({
      user: { id: adminId, role: stateAdminUser.role },
      body: { name: 'Hacked Name' }
    }, tamperRes);
    assert.strictEqual(tamperRes.statusCode, 400, 'Tampering with name is rejected (400)');
    console.log('✓ Read-only constraint enforced: Name modification rejected');

    const tamperIdRes = mockRes();
    await authController.updateProfile({
      user: { id: adminId, role: stateAdminUser.role },
      body: { subAdminId: 'FAKE-ID-999' }
    }, tamperIdRes);
    assert.strictEqual(tamperIdRes.statusCode, 400, 'Tampering with subAdminId is rejected (400)');
    console.log('✓ Read-only constraint enforced: Sub-Admin ID modification rejected');

    // Test Password Change rejects weak passwords
    const weakPassRes = mockRes();
    await authController.changePassword({
      user: { id: adminId },
      body: { newPassword: 'weak', confirmPassword: 'weak' }
    }, weakPassRes);
    assert.strictEqual(weakPassRes.statusCode, 400, 'Weak password rejected (400)');

    const mismatchPassRes = mockRes();
    await authController.changePassword({
      user: { id: adminId },
      body: { newPassword: 'StrongPass123!', confirmPassword: 'DifferentPass123!' }
    }, mismatchPassRes);
    assert.strictEqual(mismatchPassRes.statusCode, 400, 'Mismatched confirm password rejected (400)');
    console.log('✓ Password change validation enforced on backend');
  }

  // TEST 5: Manager Registration Requests Routing (Strict Tier Isolation)
  console.log('\n--- Test 5: Manager Registration Requests Tier Routing ---');

  // State Admin: Only State Managers in their State
  const reqState = { user: { role: 'State Admin', state: 'Karnataka' }, query: {} };
  const resState = mockRes();
  await managerDirectoryController.getManagerRequests(reqState, resState);
  assert.strictEqual(resState.data.success, true);
  assert.ok(resState.data.count > 0, 'Karnataka State Admin found requests');
  resState.data.requests.forEach(r => {
    assert.strictEqual(r.role, 'state_manager', 'State Admin receives ONLY state_manager');
    assert.strictEqual(r.state.toLowerCase(), 'karnataka', 'State Admin receives ONLY requests in Karnataka');
  });
  console.log(`✓ State Admin: Exactly ${resState.data.count} State Managers in Karnataka, 0 leaks.`);

  // District Admin: Only District Managers in their District
  const reqDistrict = { user: { role: 'District Admin', state: 'Karnataka', district: 'Ballari' }, query: {} };
  const resDistrict = mockRes();
  await managerDirectoryController.getManagerRequests(reqDistrict, resDistrict);
  assert.strictEqual(resDistrict.data.success, true);
  resDistrict.data.requests.forEach(r => {
    assert.strictEqual(r.role, 'district_manager', 'District Admin receives ONLY district_manager');
    assert.strictEqual(r.district.toLowerCase(), 'ballari', 'District Admin receives ONLY Ballari district');
  });
  console.log(`✓ District Admin: Exactly ${resDistrict.data.count} District Managers in Ballari, 0 leaks.`);

  // Pincode Admin: Only Pincode Managers in their PIN
  const reqPin = { user: { role: 'Pincode Admin', state: 'Tamil Nadu', district: 'Madurai', division: 'Vadipatti', pincode: '625205' }, query: {} };
  const resPin = mockRes();
  await managerDirectoryController.getManagerRequests(reqPin, resPin);
  assert.strictEqual(resPin.data.success, true);
  resPin.data.requests.forEach(r => {
    assert.strictEqual(r.role, 'pincode_manager', 'Pincode Admin receives ONLY pincode_manager');
    assert.strictEqual(String(r.pincode), '625205', 'Pincode Admin receives ONLY 625205');
  });
  console.log(`✓ Pincode Admin: Exactly ${resPin.data.count} Pincode Managers in 625205, 0 leaks.`);

  // Super Admin: Sees all tiers
  const reqSuper = { user: { role: 'Super Admin' }, query: {} };
  const resSuper = mockRes();
  await managerDirectoryController.getManagerRequests(reqSuper, resSuper);
  assert.strictEqual(resSuper.data.success, true);
  const distinctRoles = Array.from(new Set(resSuper.data.requests.map(r => r.role)));
  assert.ok(distinctRoles.includes('state_manager'), 'Super Admin sees state_manager');
  assert.ok(distinctRoles.includes('district_manager'), 'Super Admin sees district_manager');
  assert.ok(distinctRoles.includes('division_manager'), 'Super Admin sees division_manager');
  assert.ok(distinctRoles.includes('pincode_manager'), 'Super Admin sees pincode_manager');
  console.log(`✓ Super Admin: Sees all ${resSuper.data.count} requests across all 4 manager tiers.`);

  console.log('\n=== ALL VERIFICATION TESTS PASSED SUCCESSFULLY ===');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
