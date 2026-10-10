require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { getMongoDb } = require('../config/mongo');

(async () => {
  try {
    const mongoDb = await getMongoDb();
    const user = await mongoDb.collection('users').findOne({});
    const sizes = {};
    for (const [k, v] of Object.entries(user)) {
      sizes[k] = JSON.stringify(v)?.length || 0;
    }
    console.log('Sample user field sizes:', sizes);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
