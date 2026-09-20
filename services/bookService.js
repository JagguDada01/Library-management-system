const Book = require('../models/Book');
const Category = require('../models/Category');
const Loan = require('../models/Loan');
const { LOAN_STATUS, CATEGORIES } = require('../config/constants');

class BookService {
  /**
   * Retrieves all available categories, merging predefined constants and DB categories.
   */
  async getAllCategories() {
    try {
      const dbCategories = await Category.find({}).lean();
      const names = new Set(CATEGORIES);
      dbCategories.forEach(cat => {
        if (cat && cat.name) names.add(cat.name);
      });
      return Array.from(names);
    } catch (e) {
      return CATEGORIES;
    }
  }

  /**
   * Creates a new book in the catalog.
   */
  async createBook(data) {
    const totalCopies = parseInt(data.totalCopies, 10);
    if (isNaN(totalCopies) || totalCopies < 0) {
      throw new Error('Total copies must be a non-negative number');
    }

    const cleanISBN = (data.ISBN || data.isbn || '').trim().toUpperCase();
    const existing = await Book.findOne({
      $or: [{ ISBN: cleanISBN }, { isbn: cleanISBN }]
    });
    if (existing) {
      throw new Error(`A book with ISBN ${cleanISBN} already exists`);
    }

    const book = new Book({
      title: data.title?.trim(),
      author: data.author?.trim(),
      ISBN: cleanISBN,
      isbn: cleanISBN,
      category: data.category?.trim(),
      totalCopies,
      availableCopies: totalCopies, // Initially, all copies are available
      description: data.description?.trim() || '',
      isActive: true
    });

    return await book.save();
  }

  /**
   * Updates an existing book while preserving inventory consistency.
   * Edge Case 6 & 7 handled here.
   */
  async updateBook(id, data) {
    const book = await Book.findById(id);
    if (!book) {
      throw new Error('Book not found');
    }

    // Check ISBN uniqueness if changed
    const incomingISBN = (data.ISBN || data.isbn || '').trim().toUpperCase();
    if (incomingISBN) {
      const currentISBN = book.ISBN || book.isbn;
      if (incomingISBN !== currentISBN) {
        const existing = await Book.findOne({
          $or: [{ ISBN: incomingISBN }, { isbn: incomingISBN }]
        });
        if (existing && existing._id.toString() !== book._id.toString()) {
          throw new Error(`A book with ISBN ${incomingISBN} already exists`);
        }
        book.ISBN = incomingISBN;
        book.isbn = incomingISBN;
      }
    }

    // Handle inventory update with safety invariants
    if (data.totalCopies !== undefined && data.totalCopies !== '') {
      const newTotalCopies = parseInt(data.totalCopies, 10);
      if (isNaN(newTotalCopies) || newTotalCopies < 0) {
        throw new Error('Total copies must be a non-negative integer');
      }

      // Calculate currently issued copies: totalCopies - availableCopies
      const issuedCopies = book.totalCopies - book.availableCopies;

      // Edge Case 7: Cannot reduce total copies below issued copies
      if (newTotalCopies < issuedCopies) {
        throw new Error(
          `Cannot reduce total copies to ${newTotalCopies}. There are currently ${issuedCopies} copy/copies issued on loan.`
        );
      }

      // Edge Case 6: availableCopies adjusts to preserve issued copies
      const newAvailableCopies = newTotalCopies - issuedCopies;
      book.totalCopies = newTotalCopies;
      book.availableCopies = newAvailableCopies;
    }

    if (data.title) book.title = data.title.trim();
    if (data.author) book.author = data.author.trim();
    if (data.category) book.category = data.category.trim();
    if (data.description !== undefined) book.description = data.description.trim();
    if (data.isActive !== undefined) {
      book.isActive = data.isActive === 'true' || data.isActive === true;
    }

    return await book.save();
  }

  /**
   * Safely archives a book (sets isActive = false) rather than hard deleting,
   * preserving historical loans.
   */
  async archiveBook(id) {
    const book = await Book.findById(id);
    if (!book) {
      throw new Error('Book not found');
    }

    // Check if there are active loans
    const activeLoans = await Loan.countDocuments({ book: id, status: LOAN_STATUS.ISSUED });
    book.isActive = false;
    await book.save();

    return { book, hasActiveLoans: activeLoans > 0, activeLoansCount: activeLoans };
  }

  /**
   * Reactivates an archived book.
   */
  async restoreBook(id) {
    const book = await Book.findById(id);
    if (!book) {
      throw new Error('Book not found');
    }
    book.isActive = true;
    return await book.save();
  }

  /**
   * Retrieves books with search, filters, and pagination.
   */
  async getBooks({
    search = '',
    category = '',
    availability = 'all',
    page = 1,
    limit = 10,
    includeInactive = false,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  }) {
    const query = {};

    if (!includeInactive) {
      query.isActive = { $ne: false };
    }

    if (category && category !== 'all') {
      // Could match category name or ObjectId
      const catObj = await Category.findOne({ name: category });
      if (catObj) {
        query.$or = [{ category: category }, { category: catObj._id }];
      } else {
        query.category = category;
      }
    }

    if (availability === 'available') {
      query.availableCopies = { $gt: 0 };
    } else if (availability === 'unavailable') {
      query.availableCopies = 0;
    }

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const searchConditions = [
        { title: searchRegex },
        { author: searchRegex },
        { ISBN: searchRegex },
        { isbn: searchRegex }
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchConditions }];
        delete query.$or;
      } else {
        query.$or = searchConditions;
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [books, total, categoriesList] = await Promise.all([
      Book.find(query).sort(sortOptions).skip(skip).limit(limitNum).lean(),
      Book.countDocuments(query),
      Category.find({}).lean().catch(() => [])
    ]);

    const categoryMap = new Map();
    if (categoriesList) {
      categoriesList.forEach(c => {
        if (c && c._id) categoryMap.set(c._id.toString(), c.name);
      });
    }

    // Normalize category display name and ISBN on all returned books
    const normalizedBooks = books.map(book => {
      let categoryName = book.category;
      if (book.category && categoryMap.has(book.category.toString())) {
        categoryName = categoryMap.get(book.category.toString());
      } else if (typeof book.category === 'object' && book.category) {
        categoryName = book.category.name || book.category.toString();
      }

      return {
        ...book,
        ISBN: book.ISBN || book.isbn,
        categoryName: categoryName || 'General'
      };
    });

    const totalPages = Math.ceil(total / limitNum) || 1;

    return {
      books: normalizedBooks,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    };
  }

  /**
   * Get single book by ID.
   */
  async getBookById(id) {
    const book = await Book.findById(id).lean();
    if (!book) return null;

    book.ISBN = book.ISBN || book.isbn;
    if (book.category) {
      const cat = await Category.findById(book.category).lean().catch(() => null);
      if (cat) {
        book.category = cat;
      }
    }
    return book;
  }
}

module.exports = new BookService();
