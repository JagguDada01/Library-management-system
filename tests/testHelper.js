require('dotenv').config();
const os = require('os');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const { ROLES } = require('../config/constants');

const TEST_DB_URI = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/library_management_test';

async function connectTestDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  return await mongoose.connect(TEST_DB_URI, {
    serverSelectionTimeoutMS: 5000,
    runtimeAdapters: { os }
  });
}

async function clearTestDB() {
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    await mongoose.connection.db.dropDatabase();
  }
}

async function closeTestDB() {
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    await mongoose.connection.db.dropDatabase();
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

/**
 * Creates and logs in a test user, returning the supertest agent with session cookie.
 */
async function getAuthenticatedAgent(role = ROLES.MEMBER, userData = {}) {
  const agent = request.agent(app);

  const email = userData.email || (role === ROLES.LIBRARIAN ? `lib_${Date.now()}_${Math.random()}@example.com` : `member_${Date.now()}_${Math.random()}@example.com`);
  const password = userData.password || 'Secret123!';
  const name = userData.name || (role === ROLES.LIBRARIAN ? 'Test Librarian' : 'Test Member');

  const user = new User({
    name,
    email,
    password,
    role
  });
  await user.save();

  // Perform login to establish session
  const res = await agent
    .post('/login')
    .set('x-test-skip-csrf', 'true')
    .send({ email, password });

  return { agent, user, loginRes: res };
}

module.exports = {
  app,
  connectTestDB,
  clearTestDB,
  closeTestDB,
  getAuthenticatedAgent
};
