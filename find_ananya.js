const { MongoClient } = require('./Backend/node_modules/mongodb');
require('./Backend/node_modules/dotenv').config({ path: './Backend/.env' });

async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();
  const collections = await db.listCollections().toArray();
  console.log('Collections in Mongo:', collections.map(c => c.name));
  for (const col of collections) {
    const docs = await db.collection(col.name).find({
      $or: [
        { name: { $regex: 'ananya', $options: 'i' } },
        { email: { $regex: 'ananya', $options: 'i' } },
        { adminName: { $regex: 'ananya', $options: 'i' } }
      ]
    }).toArray();
    if (docs.length > 0) {
      console.log(`Found in collection "${col.name}":`, docs.length, JSON.stringify(docs[0], null, 2));
    }
  }
  await client.close();
  process.exit(0);
}

run().catch(console.error);
