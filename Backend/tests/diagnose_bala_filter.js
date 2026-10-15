require('dotenv').config();
const { db, initDatabase } = require('../config/db');

(async () => {
  await initDatabase();
  const dinesh = Array.from(db.users).find(u => u.email === 'dinesh12@gmail.com');
  const bala = Array.from(db.users).find(u => u.name === 'Bala');

  console.log('Dinesh:', { role: dinesh.role, state: dinesh.state });
  console.log('Bala:', { role: bala.role, state: bala.state, status: bala.status, level: bala.level });

  // Test canAdminManage
  const cleanTerritory = (str) => String(str || '').trim().toLowerCase().replace(/\s+(district|division|taluk)$/, '').trim();
  const matchesState = (admin, manager) => {
    if (!admin || !manager) return false;
    const adminState = cleanTerritory(admin.state || admin.assignedState);
    if (!adminState || adminState === 'all india') return true;
    const mgrState = cleanTerritory(manager.state || manager.assignedState);
    return adminState === mgrState;
  };

  const adminRoleLower = (dinesh.role || '').toLowerCase().replace(/_/g, ' ');
  let rawMgrRole = String(bala.role || bala.level || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();
  const levelNumMap = { '1': 'state', '2': 'district', '3': 'division', '4': 'pincode' };
  if (levelNumMap[rawMgrRole]) rawMgrRole = levelNumMap[rawMgrRole];
  if (levelNumMap[String(bala.level || '').trim()]) rawMgrRole = levelNumMap[String(bala.level || '').trim()];

  console.log('matchesState:', matchesState(dinesh, bala));
  console.log('adminRoleLower:', adminRoleLower);
  console.log('rawMgrRole:', rawMgrRole);

  const canManage = (adminRoleLower.includes('state') || (adminRoleLower === 'admin' && dinesh.state)) && matchesState(dinesh, bala);
  console.log('canManage:', canManage);

  // Test level filter
  const levelMap = {
    'state': 'state_manager',
    'district': 'district_manager',
    'division': 'division_manager',
    'pincode': 'pincode_manager',
    '1': 'state_manager',
    '2': 'district_manager',
    '3': 'division_manager',
    '4': 'pincode_manager'
  };
  const targetRole = levelMap['state'];
  const passLevel = bala.role === targetRole || String(bala.level) === 'state';
  console.log('passLevel:', passLevel);

  // Test isAssignedManager
  const passAssigned = Boolean(bala.state || bala.assignedState || bala.stateId || bala.assignedStateId);
  console.log('passAssigned:', passAssigned);

  // Test isApprovedAndActive
  const s = (bala.status || '').toLowerCase().trim();
  const admApp = (bala.adminApprovalStatus || '').toLowerCase().trim();
  const kycStat = (bala.kycStatus || '').toLowerCase().trim();
  console.log('Status fields:', { s, admApp, kycStat, isActive: bala.isActive });

  const failCond1 = s === 'pending' || s === 'under_review' || s === 'pending_admin_approval';
  const failCond2 = admApp !== 'approved';
  const failCond3 = (kycStat !== 'verified' && kycStat !== 'approved');
  const failCond4 = bala.isActive === false;

  console.log('Fail conditions:', { failCond1, failCond2, failCond3, failCond4 });

  process.exit(0);
})();
