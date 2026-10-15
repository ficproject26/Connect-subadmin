require('dotenv').config();
const { getMongoDb } = require('../config/mongo');

(async () => {
  try {
    const mdb = await getMongoDb();
    if (!mdb) {
      console.log('No MongoDB');
      process.exit(1);
    }

    console.log('--- Checking managerrequests for Karnataka ---');
    const kReqs = await mdb.collection('managerrequests').find({
      $or: [
        { assignedState: { $regex: /karnataka/i } },
        { state: { $regex: /karnataka/i } }
      ]
    }).toArray();
    console.log(`Found ${kReqs.length} in managerrequests:`, kReqs.map(r => ({
      _id: r._id,
      name: r.name,
      level: r.level,
      role: r.role,
      status: r.status,
      assignedState: r.assignedState,
      assignedDistrict: r.assignedDistrict
    })));

    console.log('\n--- Checking users for Karnataka ---');
    const kUsers = await mdb.collection('users').find({
      $or: [
        { assignedState: { $regex: /karnataka/i } },
        { state: { $regex: /karnataka/i } }
      ]
    }).toArray();
    console.log(`Found ${kUsers.length} in users:`, kUsers.map(u => ({
      _id: u._id,
      name: u.name,
      role: u.role,
      status: u.status,
      state: u.state,
      assignedState: u.assignedState,
      district: u.district,
      assignedDistrict: u.assignedDistrict
    })));

    console.log('\n--- Checking managers collection for Karnataka ---');
    const kManagers = await mdb.collection('managers').find({
      $or: [
        { assignedState: { $regex: /karnataka/i } },
        { state: { $regex: /karnataka/i } }
      ]
    }).toArray();
    console.log(`Found ${kManagers.length} in managers collection:`, kManagers.map(m => ({
      _id: m._id,
      name: m.name,
      role: m.role,
      status: m.status,
      state: m.state,
      assignedState: m.assignedState
    })));

    console.log('\n--- Checking submitted_reports (reports) ---');
    const reports = await mdb.collection('reports').find({}).toArray();
    console.log(`Found ${reports.length} total reports:`, reports.slice(0, 5).map(r => ({
      _id: r._id,
      managerId: r.managerId,
      managerName: r.managerName,
      state: r.state,
      district: r.district,
      division: r.division,
      pincode: r.pincode,
      reportPeriod: r.reportPeriod
    })));

    console.log('\n--- Checking notifications ---');
    const notifications = await mdb.collection('notifications').find({}).limit(10).toArray();
    console.log(`Found notifications sample:`, notifications.map(n => ({
      _id: n._id,
      recipientId: n.recipientId,
      recipientRole: n.recipientRole,
      title: n.title,
      state: n.state,
      district: n.district,
      division: n.division,
      pincode: n.pincode,
      territory: n.territory
    })));

  } catch (err) {
    console.error(err);
  }
  process.exit(0);
})();
