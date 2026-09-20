const { ROLES } = require('../config/constants');

function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  req.session.error_msg = 'Please log in to access this page';
  const returnTo = req.originalUrl !== '/logout' ? req.originalUrl : '/';
  return res.redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
}

function redirectIfAuth(req, res, next) {
  if (req.session && req.session.user) {
    if (req.session.user.role === ROLES.LIBRARIAN) {
      return res.redirect('/librarian/dashboard');
    }
    return res.redirect('/member/dashboard');
  }
  next();
}

module.exports = {
  requireAuth,
  redirectIfAuth
};
