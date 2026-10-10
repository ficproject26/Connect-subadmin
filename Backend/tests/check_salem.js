require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { getMongoDb } = require('../config/mongo');

(async () => {
  try {
    const mongoDb = await getMongoDb();
    const salemDivs = await mongoDb.collection('divisions').find({
      name: { $regex: 'thalaivasal', $options: 'i' }
    }).toArray();
    console.log('Thalaivasal divisions in Atlas:', salemDivs);

    const salemDist = await mongoDb.collection('districts').find({
      name: { $regex: 'salem', $options: 'i' }
    }).toArray();
    console.log('Salem districts in Atlas:', salemDist);

    const krishnagiriDist = await mongoDb.collection('districts').find({
      name: { $regex: 'krishnagiri', $options: 'i' }
    }).toArray();
    console.log('Krishnagiri districts in Atlas:', krishnagiriDist);

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
