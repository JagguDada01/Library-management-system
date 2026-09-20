const User = require('../models/User');
const { ROLES } = require('../config/constants');
const { validateRegistration, validateLogin } = require('../validators/authValidator');

class AuthController {
  showRegister(req, res) {
    res.render('auth/register', {
      title: 'Member Registration',
      errors: [],
      formData: {}
    });
  }

  async register(req, res, next) {
    try {
      const { isValid, errors, sanitized } = validateRegistration(req.body);

      if (!isValid) {
        return res.status(400).render('auth/register', {
          title: 'Member Registration',
          errors,
          formData: { name: req.body.name, email: req.body.email }
        });
      }

      // Check duplicate email
      const existingUser = await User.findOne({ email: sanitized.email });
      if (existingUser) {
        return res.status(400).render('auth/register', {
          title: 'Member Registration',
          errors: ['An account with this email address already exists'],
          formData: { name: sanitized.name, email: sanitized.email }
        });
      }

      // Create new user (Role is strictly forced to MEMBER)
      const user = new User({
        name: sanitized.name,
        email: sanitized.email,
        password: sanitized.password,
        role: ROLES.MEMBER
      });

      await user.save();

      // Regenerate session upon registration for session fixation protection
      req.session.regenerate((err) => {
        if (err) return next(err);

        req.session.user = {
          _id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role
        };
        req.session.success_msg = `Welcome to BiblioTech Library, ${user.name}! Your account has been created.`;
        res.redirect('/member/dashboard');
      });
    } catch (error) {
      next(error);
    }
  }

  showLogin(req, res) {
    const returnTo = req.query.returnTo || '';
    res.render('auth/login', {
      title: 'Login to Your Account',
      errors: [],
      formData: {},
      returnTo
    });
  }

  async login(req, res, next) {
    try {
      const { isValid, errors, sanitized } = validateLogin(req.body);
      const returnTo = req.body.returnTo || '';

      if (!isValid) {
        return res.status(400).render('auth/login', {
          title: 'Login to Your Account',
          errors,
          formData: { email: req.body.email },
          returnTo
        });
      }

      const user = await User.findOne({ email: sanitized.email });
      if (!user) {
        return res.status(401).render('auth/login', {
          title: 'Login to Your Account',
          errors: ['Invalid email or password'],
          formData: { email: sanitized.email },
          returnTo
        });
      }

      const isMatch = await user.comparePassword(sanitized.password);
      if (!isMatch) {
        return res.status(401).render('auth/login', {
          title: 'Login to Your Account',
          errors: ['Invalid email or password'],
          formData: { email: sanitized.email },
          returnTo
        });
      }

      // Regenerate session upon successful login (Security Best Practice)
      req.session.regenerate((err) => {
        if (err) return next(err);

        let normalizedRole = (user.role || 'MEMBER').toUpperCase();
        if (normalizedRole === 'ADMIN') normalizedRole = ROLES.LIBRARIAN;

        req.session.user = {
          _id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: normalizedRole
        };

        req.session.success_msg = `Welcome back, ${user.name}!`;

        if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
          return res.redirect(returnTo);
        }

        if (normalizedRole === ROLES.LIBRARIAN) {
          return res.redirect('/librarian/dashboard');
        }
        return res.redirect('/member/dashboard');
      });
    } catch (error) {
      next(error);
    }
  }

  logout(req, res, next) {
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie('library_session_id');
      res.redirect('/login');
    });
  }
}

module.exports = new AuthController();
