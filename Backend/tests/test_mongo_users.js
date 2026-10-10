require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { getMongoDb } = require('../config/mongo');

(async () => {
  try {
    const mongoDb = await getMongoDb();
    console.log('Connected to MongoDB Atlas');
    const usersCount = await mongoDb.collection('users').countDocuments({});
    console.log('Total users count in MongoDB Atlas:', usersCount);

    const admins = await mongoDb.collection('users').find(
      {
        $or: [
          { role: { $regex: 'admin', $options: 'i' } },
          { adminRole: { $regex: 'admin', $options: 'i' } },
          { adminLevel: { $regex: 'state|district|division|pincode|main|super', $options: 'i' } }
        ]
      },
      {
        projection: {
          'kyc.aadhaarImage': 0,
          'kyc.panImage': 0,
          'kyc.selfie': 0,
          aadhaarImage: 0,
          panImage: 0,
          selfie: 0
        }
      }
    ).toArray();

    console.log(`Found ${admins.length} admins matching query:`);
    admins.forEach(a => {
      console.log({
        id: a._id,
        name: a.name,
        email: a.email,
        role: a.role,
        adminRole: a.adminRole,
        adminLevel: a.adminLevel,
        status: a.status,
        state: a.state || a.assignedState,
        district: a.district || a.assignedDistrict,
        division: a.division || a.assignedDivision,
        pincode: a.pincode || a.assignedPincode
      });
    });

    process.exit(0);
  } catch (e) {
    console.error('Mongo error:', e);
    process.exit(1);
  }
})();
