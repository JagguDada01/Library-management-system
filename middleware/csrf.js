const crypto = require('crypto');

function csrfProtection(req, res, next) {
  // Ensure session exists
  if (!req.session) {
    return next();
  }

  // Generate token if not already present
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  // Make token available to all EJS templates
  res.locals.csrfToken = req.session.csrfToken;

  // Safe HTTP methods don't mutate state
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Bypass for test environment if header specified or test mode without token
  if (process.env.NODE_ENV === 'test' && req.headers['x-test-skip-csrf'] === 'true') {
    return next();
  }

  const clientToken =
    (req.body && req.body._csrf) ||
    req.headers['x-csrf-token'] ||
    (req.query && req.query._csrf);

  if (!clientToken || clientToken !== req.session.csrfToken) {
    res.locals.currentUser = res.locals.currentUser || (req.session && req.session.user) || null;
    res.locals.currentPath = res.locals.currentPath || req.path || '/';
    res.locals.appName = res.locals.appName || 'BiblioTech Library';
    res.locals.csrfToken = res.locals.csrfToken || req.session.csrfToken || '';

    if (req.accepts('html')) {
      return res.status(403).render('errors/403', {
        title: '403 - Forbidden',
        message: 'Security check failed (Invalid or missing CSRF token). Please refresh the page and try again.'
      });
    }
    return res.status(403).json({ error: 'Invalid or missing CSRF token' });
  }

  next();
}

module.exports = { csrfProtection };
