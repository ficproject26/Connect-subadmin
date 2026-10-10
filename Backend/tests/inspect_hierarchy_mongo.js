require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { getMongoDb } = require('../config/mongo');

(async () => {
  try {
    const mongoDb = await getMongoDb();
    const states = await mongoDb.collection('states').find({}).toArray();
    const districts = await mongoDb.collection('districts').find({}).toArray();
    const divisions = await mongoDb.collection('divisions').find({}).toArray();
    const pincodesCount = await mongoDb.collection('pincodes').countDocuments({});
    
    console.log('States in Atlas:', states);
    console.log('Districts in Atlas:', districts);
    console.log('Divisions in Atlas:', divisions);
    console.log('Total pincodes count in Atlas:', pincodesCount);

    const admins = await mongoDb.collection('users').find({
      $or: [
        { role: { $regex: 'admin', $options: 'i' } },
        { adminRole: { $regex: 'admin', $options: 'i' } }
      ]
    }).toArray();

    console.log('\nAll Admin users in Atlas:');
    admins.forEach(a => {
      console.log({
        id: a._id,
        name: a.name,
        role: a.role,
        adminRole: a.adminRole,
        adminLevel: a.adminLevel,
        state: a.state || a.assignedState,
        district: a.district || a.assignedDistrict,
        division: a.division || a.assignedDivision,
        pincode: a.pincode || a.assignedPincode
      });
    });

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
