require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { getMongoDb } = require('../config/mongo');

(async () => {
  try {
    const mongoDb = await getMongoDb();
    const cursor = mongoDb.collection('users').find({});
    let totalDocs = 0;
    let bigFields = {};
    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      totalDocs++;
      for (const [k, v] of Object.entries(doc)) {
        const len = JSON.stringify(v)?.length || 0;
        if (len > 50000) {
          bigFields[k] = (bigFields[k] || 0) + len;
        }
      }
    }
    console.log(`Examined ${totalDocs} users. Big fields:`, bigFields);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
