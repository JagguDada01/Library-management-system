const path = require('path');
const express = require('express');
const helmet = require('helmet');
const methodOverride = require('method-override');
const { createSessionMiddleware } = require('./config/session');
const { viewLocals } = require('./middleware/viewLocals');
const { csrfProtection } = require('./middleware/csrf');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const bookRoutes = require('./routes/bookRoutes');
const memberRoutes = require('./routes/memberRoutes');
const librarianRoutes = require('./routes/librarianRoutes');

const app = express();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Security headers with CSP configured for Bootstrap CDN
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
        fontSrc: ["'self'", 'https://cdn.jsdelivr.net'],
        imgSrc: ["'self'", 'data:', 'https:']
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// Body parsing
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(express.json({ limit: '10kb' }));

// Method override for PUT/DELETE in forms if needed
app.use(methodOverride('_method'));

// Static assets
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(createSessionMiddleware());

// CSRF token generation and validation
app.use(csrfProtection);

// View locals (user, alerts, app name)
app.use(viewLocals);

// Mount Routes
app.use('/', authRoutes);
app.use('/', bookRoutes);
app.use('/member', memberRoutes);
app.use('/librarian', librarianRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
