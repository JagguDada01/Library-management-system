const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const requestController = require('../controllers/requestController');
const loanController = require('../controllers/loanController');
const { requireAuth } = require('../middleware/auth');
const { requireMember } = require('../middleware/role');

// All member routes require auth and MEMBER role
router.use(requireAuth, requireMember);

router.get('/dashboard', dashboardController.memberDashboard);
router.get('/profile', dashboardController.memberProfile);

// Requests
router.get('/requests', requestController.listMemberRequests);
router.post('/books/:id/request', requestController.submitRequest);

// Loans & History
router.get('/loans', loanController.listMemberLoans);
router.get('/history', loanController.listMemberHistory);

module.exports = router;
