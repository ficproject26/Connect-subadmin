require('dotenv').config();
const { db, initDatabase } = require('../config/db');

(async () => {
  await initDatabase();
  console.log('Total db.users:', db.users.length);
  const kUsers = Array.from(db.users).filter(u => {
    const s = String(u.state || u.assignedState || '').toLowerCase();
    return s.includes('karnataka');
  });
  console.log('db.users in Karnataka:', kUsers.map(u => ({
    _id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    state: u.state,
    assignedState: u.assignedState
  })));

  console.log('Total db.managers:', db.managers ? db.managers.length : 'none');
  if (db.managers) {
    const kMgrs = Array.from(db.managers).filter(m => {
      const s = String(m.state || m.assignedState || '').toLowerCase();
      return s.includes('karnataka');
    });
    console.log('db.managers in Karnataka:', kMgrs.map(m => ({
      _id: m._id,
      name: m.name,
      role: m.role,
      status: m.status,
      state: m.state,
      assignedState: m.assignedState
    })));
  }

  process.exit(0);
})();
