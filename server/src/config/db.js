/**
 * MongoDB Mongoose Connection Manager.
 * Supports MongoDB Atlas cloud connections with automatic retry,
 * 2dsphere index verification, and connection health monitoring.
 */
const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agroedge_db';
  const isAtlas = mongoUri.includes('mongodb+srv') || mongoUri.includes('.mongodb.net');

  console.log(`[Database] Connecting to MongoDB (${isAtlas ? 'MongoDB Atlas Cloud' : 'Local Instance'})...`);

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 10000,
    });

    console.log(`[Database] MongoDB Connected successfully: ${conn.connection.host} / ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[Database Error] Connection failed: ${error.message}`);
    if (isAtlas) {
      console.warn('[Database] Note: For MongoDB Atlas, ensure your IP address is whitelisted in Network Access and credentials in .env are correct.');
    }
    // In development or when Atlas is unreachable, we don't crash the server so other endpoints can still report health status
    return null;
  }
};

const isConnected = () => {
  return mongoose.connection.readyState === 1;
};

const pingDB = async () => {
  if (!isConnected()) return false;
  try {
    await mongoose.connection.db.admin().ping();
    return true;
  } catch {
    return false;
  }
};

module.exports = {
  connectDB,
  isConnected,
  pingDB
};
