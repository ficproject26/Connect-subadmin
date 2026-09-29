const { MongoClient } = require('mongodb');

let client = null;
let db = null;

async function getMongoDb() {
  if (db) return db;
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not defined.');
  }
  try {
    if (!client) {
      client = new MongoClient(uri, { serverSelectionTimeoutMS: 20000, connectTimeoutMS: 20000 });
      await client.connect();
    }
    db = client.db();
    return db;
  } catch (err) {
    console.error('[MongoDB Atlas] Connection failed:', err.message);
    throw err;
  }
}

module.exports = { getMongoDb };
