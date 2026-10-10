require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { getMongoDb } = require('../config/mongo');

(async () => {
  try {
    const mongoDb = await getMongoDb();
    const pin1 = await mongoDb.collection('pincodes').findOne({ $or: [{ code: '635126' }, { pincode: '635126' }] });
    const pin2 = await mongoDb.collection('pincodes').findOne({ $or: [{ code: '636112' }, { pincode: '636112' }] });
    console.log('Pin 635126:', pin1);
    console.log('Pin 636112:', pin2);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
