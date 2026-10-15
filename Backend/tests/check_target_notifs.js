require('dotenv').config();
const { getMongoDb } = require('../config/mongo');

(async () => {
  const mdb = await getMongoDb();
  const notifs = await mdb.collection('notifications').find({
    $or: [
      { title: { $regex: /Verified Road Repair Inspection/i } },
      { title: { $regex: /Shop Visit/i } },
      { title: { $regex: /Main Admin Clearance/i } }
    ]
  }).toArray();
  console.log('Count:', notifs.length);
  console.log(JSON.stringify(notifs.slice(0, 5), null, 2));
  process.exit(0);
})();
