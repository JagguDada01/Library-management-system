const bookService = require('../services/bookService');
const Loan = require('../models/Loan');
const Request = require('../models/Request');
const { CATEGORIES, LOAN_STATUS, REQUEST_STATUS } = require('../config/constants');
const { validateBook } = require('../validators/bookValidator');

class BookController {
  /**
   * Public / Member catalog view
   */
  async listBooks(req, res, next) {
    try {
      const { search, category, availability, page } = req.query;

      const [result, categories] = await Promise.all([
        bookService.getBooks({
          search,
          category,
          availability,
          page: page || 1,
          limit: 9,
          includeInactive: false
        }),
        bookService.getAllCategories()
      ]);

      res.render('books/index', {
        title: 'Browse Library Catalog',
        books: result.books,
        pagination: result.pagination,
        categories,
        query: {
          search: search || '',
          category: category || 'all',
          availability: availability || 'all'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * View details of a single book
   */
  async getBookDetail(req, res, next) {
    try {
      const book = await bookService.getBookById(req.params.id);
      if (!book) {
        return res.status(404).render('errors/404', {
          title: 'Book Not Found',
          message: 'The requested book could not be found.'
        });
      }

      let userHasActiveLoan = false;
      let userHasPendingRequest = false;

      if (req.session?.user) {
        const memberId = req.session.user._id;
        const [activeLoan, pendingReq] = await Promise.all([
          Loan.findOne({ book: book._id, member: memberId, status: LOAN_STATUS.ISSUED }),
          Request.findOne({ book: book._id, member: memberId, status: REQUEST_STATUS.PENDING })
        ]);
        userHasActiveLoan = !!activeLoan;
        userHasPendingRequest = !!pendingReq;
      }

      res.render('books/detail', {
        title: book.title,
        book,
        userHasActiveLoan,
        userHasPendingRequest
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Librarian inventory list view
   */
  async listLibrarianBooks(req, res, next) {
    try {
      const { search, category, availability, page, status } = req.query;
      const includeInactive = status === 'all' || status === 'archived';

      const [result, categories] = await Promise.all([
        bookService.getBooks({
          search,
          category,
          availability,
          page: page || 1,
          limit: 10,
          includeInactive: true
        }),
        bookService.getAllCategories()
      ]);

      // Filter by archived if specifically requested
      let books = result.books;
      if (status === 'archived') {
        books = books.filter(b => !b.isActive);
      } else if (status === 'active') {
        books = books.filter(b => b.isActive);
      }

      res.render('librarian/books/index', {
        title: 'Manage Book Inventory',
        books,
        pagination: result.pagination,
        categories,
        query: {
          search: search || '',
          category: category || 'all',
          availability: availability || 'all',
          status: status || 'all'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async showCreateForm(req, res) {
    const categories = await bookService.getAllCategories();
    res.render('librarian/books/new', {
      title: 'Add New Book',
      categories,
      errors: [],
      formData: {}
    });
  }

  async createBook(req, res, next) {
    try {
      const { isValid, errors, sanitized } = validateBook(req.body);

      if (!isValid) {
        const categories = await bookService.getAllCategories();
        return res.status(400).render('librarian/books/new', {
          title: 'Add New Book',
          categories,
          errors,
          formData: req.body
        });
      }

      await bookService.createBook(sanitized);
      req.session.success_msg = `Book "${sanitized.title}" successfully added to the catalog!`;
      res.redirect('/librarian/books');
    } catch (error) {
      const categories = await bookService.getAllCategories();
      res.status(400).render('librarian/books/new', {
        title: 'Add New Book',
        categories,
        errors: [error.message],
        formData: req.body
      });
    }
  }

  async showEditForm(req, res, next) {
    try {
      const [book, categories] = await Promise.all([
        bookService.getBookById(req.params.id),
        bookService.getAllCategories()
      ]);
      if (!book) {
        return res.status(404).render('errors/404', {
          title: 'Book Not Found',
          message: 'Book not found'
        });
      }

      // Calculate currently issued copies to inform librarian
      const issuedCopies = book.totalCopies - book.availableCopies;

      res.render('librarian/books/edit', {
        title: `Edit: ${book.title}`,
        book,
        issuedCopies,
        categories,
        errors: []
      });
    } catch (error) {
      next(error);
    }
  }

  async updateBook(req, res, next) {
    const bookId = req.params.id;
    try {
      const { isValid, errors, sanitized } = validateBook(req.body, true);

      if (!isValid) {
        const book = await bookService.getBookById(bookId);
        const issuedCopies = book ? book.totalCopies - book.availableCopies : 0;
        return res.status(400).render('librarian/books/edit', {
          title: `Edit Book`,
          book: { ...req.body, _id: bookId },
          issuedCopies,
          categories: CATEGORIES,
          errors
        });
      }

      await bookService.updateBook(bookId, req.body);
      req.session.success_msg = 'Book details and inventory updated successfully.';
      res.redirect('/librarian/books');
    } catch (error) {
      const book = await bookService.getBookById(bookId);
      const issuedCopies = book ? book.totalCopies - book.availableCopies : 0;
      res.status(400).render('librarian/books/edit', {
        title: `Edit Book`,
        book: { ...req.body, _id: bookId },
        issuedCopies,
        categories: CATEGORIES,
        errors: [error.message]
      });
    }
  }

  async archiveBook(req, res, next) {
    try {
      const { book, hasActiveLoans, activeLoansCount } = await bookService.archiveBook(req.params.id);
      if (hasActiveLoans) {
        req.session.success_msg = `Book "${book.title}" has been archived. Note: There are still ${activeLoansCount} active loan(s) that can be returned.`;
      } else {
        req.session.success_msg = `Book "${book.title}" has been safely archived.`;
      }
      res.redirect('/librarian/books');
    } catch (error) {
      req.session.error_msg = error.message;
      res.redirect('/librarian/books');
    }
  }

  async restoreBook(req, res, next) {
    try {
      const book = await bookService.restoreBook(req.params.id);
      req.session.success_msg = `Book "${book.title}" has been reactivated.`;
      res.redirect('/librarian/books');
    } catch (error) {
      req.session.error_msg = error.message;
      res.redirect('/librarian/books');
    }
  }
}

module.exports = new BookController();
