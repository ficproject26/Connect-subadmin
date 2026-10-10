require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { db, initDatabase } = require('../config/db');

(async () => {
  try {
    await initDatabase();
    const users = Array.from(db.users || []);
    console.log('Total db.users:', users.length);
    const admins = users.filter(u => {
      const r = String(u.role || '').toLowerCase();
      const ar = String(u.adminRole || '').toLowerCase();
      return r.includes('admin') || ar.includes('admin') || r.includes('state');
    });
    console.log(`Found ${admins.length} admins in db.users:`);
    admins.forEach(u => {
      console.log({
        id: u._id || u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        adminRole: u.adminRole,
        adminLevel: u.adminLevel,
        level: u.level,
        state: u.state || u.assignedState,
        district: u.district || u.assignedDistrict,
        division: u.division || u.assignedDivision,
        pincode: u.pincode || u.assignedPincode
      });
    });

    const dbAdmins = Array.from(db.admins || []);
    console.log('Total db.admins:', dbAdmins.length);
    dbAdmins.forEach(a => {
      console.log('Admin in db.admins:', {
        id: a._id || a.id,
        name: a.name,
        email: a.email,
        role: a.role,
        state: a.state,
        district: a.district
      });
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
