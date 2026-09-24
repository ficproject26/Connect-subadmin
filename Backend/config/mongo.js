const { MongoClient } = require('mongodb');

let client = null;
let db = null;

async function getMongoDb() {
  if (db) return db;
  const uri = process.env.MONGODB_URI || 'mongodb+srv://Connect-app:Connect123@cluster0.fzj1k5l.mongodb.net/test?retryWrites=true&w=majority';
  try {
    if (!client) {
      client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
      await client.connect();
    }
    db = client.db();
    return db;
  } catch (err) {
    console.warn('MongoDB Atlas connection error:', err.message);
    return null;
  }
}

module.exports = { getMongoDb };
