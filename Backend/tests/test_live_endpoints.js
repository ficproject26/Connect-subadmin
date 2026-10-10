require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { initDatabase, db } = require('../config/db');
const adminController = require('../controllers/adminController');

(async () => {
  try {
    console.log('Initializing database...');
    await initDatabase();
    console.log('Database initialized successfully.');

    const stateAdminUser = {
      _id: '6ab4c2ec5df0d82cb7a09cac',
      id: '6ab4c2ec5df0d82cb7a09cac',
      name: 'Dhanu',
      role: 'State Admin',
      adminRole: 'branch-admin',
      adminLevel: 'state',
      state: 'Tamil Nadu'
    };

    const runEndpoint = async (fn, query = {}) => {
      let result = null;
      const req = { user: stateAdminUser, query, params: {}, headers: {} };
      const res = {
        json: (data) => { result = data; return data; },
        status: () => res
      };
      await fn(req, res);
      return result;
    };

    console.log('\n--- 1. Testing getDistricts ---');
    const dists = await runEndpoint(adminController.getDistricts, { state: 'Tamil Nadu' });
    console.log('getDistricts result:', dists?.districts?.length, dists?.districts?.map(d => ({
      name: d.name,
      adminName: d.adminName,
      adminEmail: d.adminEmail,
      state: d.state
    })));

    console.log('\n--- 2. Testing getDivisions ---');
    const divs = await runEndpoint(adminController.getDivisions, { state: 'Tamil Nadu' });
    console.log('getDivisions result:', divs?.divisions?.length, divs?.divisions?.map(d => ({
      name: d.name,
      district: d.district,
      adminName: d.adminName,
      adminEmail: d.adminEmail
    })));

    console.log('\n--- 3. Testing getPincodes ---');
    const pins = await runEndpoint(adminController.getPincodes, { state: 'Tamil Nadu' });
    console.log('getPincodes result:', pins?.pincodes?.length, pins?.pincodes?.map(p => ({
      code: p.code,
      district: p.district,
      division: p.division,
      adminName: p.adminName,
      adminEmail: p.adminEmail
    })));

    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
})();
