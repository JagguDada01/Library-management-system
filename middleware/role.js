const { ROLES } = require('../config/constants');

function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      req.session.error_msg = 'Please log in to proceed';
      return res.status(401).redirect('/login');
    }

    const userRole = req.session.user.role;
    if (!roles.includes(userRole)) {
      if (req.accepts('html')) {
        return res.status(403).render('errors/403', {
          title: '403 - Forbidden',
          message: 'You do not have permission to perform this action or access this area.'
        });
      }
      return res.status(403).json({ error: 'Access forbidden: insufficient permissions' });
    }

    next();
  };
}

const requireLibrarian = requireRole(ROLES.LIBRARIAN);
const requireMember = requireRole(ROLES.MEMBER);

module.exports = {
  requireRole,
  requireLibrarian,
  requireMember
};
