require('dotenv').config();
const { db, initDatabase } = require('../config/db');
const managerDirectoryController = require('../controllers/managerDirectoryController');

function createMockReqRes({ user, query = {} }) {
  const req = {
    user,
    query,
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

(async () => {
  await initDatabase();

  const karnatakaAdmin = Array.from(db.users).find(u => u.email === 'dinesh12@gmail.com') || {
    id: 'karnataka_admin',
    role: 'State Admin',
    state: 'Karnataka'
  };

  console.log('Using admin:', {
    name: karnatakaAdmin.name,
    role: karnatakaAdmin.role,
    state: karnatakaAdmin.state,
    assignedState: karnatakaAdmin.assignedState
  });

  const { req, res } = createMockReqRes({
    user: karnatakaAdmin,
    query: { level: 'state', status: 'active' }
  });

  await managerDirectoryController.getLowerLevelManagers(req, res);
  const data = res.getData();
  console.log('Result status:', res.getStatusCode());
  console.log('Result count:', data?.count);
  console.log('Result managers:', (data?.subordinates || []).map(m => ({
    name: m.name,
    role: m.role,
    level: m.level,
    state: m.state,
    status: m.status
  })));

  process.exit(0);
})();
