require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const adminController = require('../controllers/adminController');
const { getMongoDb } = require('../config/mongo');

(async () => {
  try {
    const mdb = await getMongoDb();
    console.log('Testing directories with direct MongoDB data...');

    // Mock req, res
    const createMockReqRes = (user, query = {}) => {
      let responseData = null;
      let statusCode = 200;
      return {
        req: {
          user,
          query,
          headers: {}
        },
        res: {
          status: (code) => {
            statusCode = code;
            return {
              json: (data) => { responseData = data; return data; }
            };
          },
          json: (data) => {
            responseData = data;
            return data;
          }
        },
        getResponse: () => ({ statusCode, data: responseData })
      };
    };

    const stateAdminUser = {
      _id: '6ab4c2ec5df0d82cb7a09cac',
      id: '6ab4c2ec5df0d82cb7a09cac',
      name: 'Dhanu',
      role: 'State Admin',
      adminRole: 'branch-admin',
      adminLevel: 'state',
      state: 'Tamil Nadu'
    };

    const { db, initDatabase } = require('../config/db');
    await initDatabase();

    console.log('db.users count in memory:', db.users.length);

    // Test getDistricts
    const testDist = createMockReqRes(stateAdminUser, { state: 'Tamil Nadu' });
    await adminController.getDistricts(testDist.req, testDist.res);
    const distResult = testDist.getResponse();
    console.log('getDistricts result count:', distResult.data?.districts?.length);
    console.log('Districts:', JSON.stringify(distResult.data?.districts?.map(d => ({ name: d.name, adminName: d.adminName, id: d.id }))));

    // Test getDivisions
    const testDiv = createMockReqRes(stateAdminUser, { state: 'Tamil Nadu' });
    await adminController.getDivisions(testDiv.req, testDiv.res);
    const divResult = testDiv.getResponse();
    console.log('getDivisions result count:', divResult.data?.divisions?.length);
    console.log('Divisions:', JSON.stringify(divResult.data?.divisions?.map(d => ({ name: d.name, adminName: d.adminName, district: d.district }))));

    // Test getPincodes
    const testPin = createMockReqRes(stateAdminUser, { state: 'Tamil Nadu' });
    await adminController.getPincodes(testPin.req, testPin.res);
    const pinResult = testPin.getResponse();
    console.log('getPincodes result count:', pinResult.data?.pincodes?.length);
    console.log('Pincodes:', JSON.stringify(pinResult.data?.pincodes?.map(p => ({ code: p.code, adminName: p.adminName, division: p.division, district: p.district }))));

    process.exit(0);
  } catch (err) {
    console.error('Test directory error:', err);
    process.exit(1);
  }
})();
