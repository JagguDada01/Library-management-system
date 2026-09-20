const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { redirectIfAuth, requireAuth } = require('../middleware/auth');

// Public auth routes (redirect if already logged in)
router.get('/login', redirectIfAuth, authController.showLogin);
router.post('/login', redirectIfAuth, authController.login);
router.get('/register', redirectIfAuth, authController.showRegister);
router.post('/register', redirectIfAuth, authController.register);

// Logout route
router.post('/logout', requireAuth, authController.logout);
router.get('/logout', (req, res) => res.redirect('/login'));

module.exports = router;
