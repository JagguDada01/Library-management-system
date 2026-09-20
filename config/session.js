const os = require('os');
const session = require('express-session');
const connectMongo = require('connect-mongo');

const MongoStore = connectMongo.MongoStore || connectMongo.default || connectMongo;

const createSessionMiddleware = () => {
  const isProd = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/library_management';

  let store;
  if (!isTest) {
    store = MongoStore.create({
      mongoUrl: mongoURI,
      mongoOptions: {
        runtimeAdapters: { os }
      },
      collectionName: 'sessions',
      ttl: 24 * 60 * 60, // 1 day
      autoRemove: 'native'
    });
  }

  return session({
    name: 'library_session_id',
    secret: process.env.SESSION_SECRET || 'fallback_dev_secret_key_needs_override_in_env',
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  });
};

module.exports = { createSessionMiddleware };
