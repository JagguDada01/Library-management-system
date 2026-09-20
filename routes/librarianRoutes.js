const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const bookController = require('../controllers/bookController');
const requestController = require('../controllers/requestController');
const loanController = require('../controllers/loanController');
const { requireAuth } = require('../middleware/auth');
const { requireLibrarian } = require('../middleware/role');

// All librarian routes require auth and LIBRARIAN role
router.use(requireAuth, requireLibrarian);

// Dashboard
router.get('/dashboard', dashboardController.librarianDashboard);

// Book Management
router.get('/books', bookController.listLibrarianBooks);
router.get('/books/new', bookController.showCreateForm);
router.post('/books', bookController.createBook);
router.get('/books/:id/edit', bookController.showEditForm);
router.post('/books/:id/update', bookController.updateBook);
router.post('/books/:id/archive', bookController.archiveBook);
router.post('/books/:id/restore', bookController.restoreBook);

// Request Processing
router.get('/requests', requestController.listLibrarianRequests);
router.post('/requests/:id/approve', requestController.approveRequest);
router.post('/requests/:id/reject', requestController.rejectRequest);

// Loan Management
router.get('/loans', loanController.listLibrarianLoans);
router.get('/loans/issue', loanController.showDirectIssueForm);
router.post('/loans/issue', loanController.directIssue);
router.post('/loans/:id/return', loanController.returnBook);

// Member Overview
router.get('/members', loanController.listMembers);

module.exports = router;
