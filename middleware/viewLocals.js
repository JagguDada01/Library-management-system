function viewLocals(req, res, next) {
  res.locals.currentUser = (req.session && req.session.user) ? req.session.user : null;
  res.locals.currentPath = req.path || '/';
  res.locals.appName = 'BiblioTech Library';
  res.locals.csrfToken = (req.session && req.session.csrfToken) ? req.session.csrfToken : '';

  // Flash messages stored in session
  res.locals.success_msg = req.session?.success_msg || null;
  res.locals.error_msg = req.session?.error_msg || null;

  if (req.session) {
    delete req.session.success_msg;
    delete req.session.error_msg;
  }

  next();
}

module.exports = { viewLocals };
