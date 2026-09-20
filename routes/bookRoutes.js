const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');

// Public catalog routes
router.get('/', bookController.listBooks);
router.get('/books', bookController.listBooks);
router.get('/books/:id', bookController.getBookDetail);

module.exports = router;
