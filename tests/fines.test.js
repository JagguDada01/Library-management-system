const { calculateFine, calculateOverdueDays, isLoanOverdue } = require('../utils/fineCalculator');
const { FINE_PER_DAY } = require('../config/constants');
const dashboardService = require('../services/dashboardService');
const loanService = require('../services/loanService');
const Book = require('../models/Book');
const User = require('../models/User');
const Loan = require('../models/Loan');
const { connectTestDB, clearTestDB, closeTestDB } = require('./testHelper');
const { ROLES, LOAN_STATUS } = require('../config/constants');

describe('Fines & Overdue Calculations (Sections 26-29, 32)', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  describe('Fine Calculator Utility', () => {
    it('should return 0 overdue days and 0 fine for return on or before due date', () => {
      const dueDate = new Date('2026-10-15T12:00:00Z');
      const returnDate = new Date('2026-10-14T12:00:00Z');

      const result = calculateFine(dueDate, returnDate);
      expect(result.overdueDays).toBe(0);
      expect(result.fine).toBe(0);
      expect(result.isOverdue).toBe(false);
    });

    it('should return 0 overdue days and 0 fine when returned exactly on due date', () => {
      const dueDate = new Date('2026-10-15T12:00:00Z');
      const returnDate = new Date('2026-10-15T12:00:00Z');

      const result = calculateFine(dueDate, returnDate);
      expect(result.overdueDays).toBe(0);
      expect(result.fine).toBe(0);
      expect(result.isOverdue).toBe(false);
    });

    it('should calculate exactly 1 day overdue and $5 fine for 1 day delay', () => {
      const dueDate = new Date('2026-10-15T12:00:00Z');
      const returnDate = new Date('2026-10-16T12:00:00Z');

      const result = calculateFine(dueDate, returnDate, FINE_PER_DAY);
      expect(result.overdueDays).toBe(1);
      expect(result.fine).toBe(5);
      expect(result.isOverdue).toBe(true);
    });

    it('should calculate multiple days overdue correctly (e.g. 7 days overdue = $35)', () => {
      const dueDate = new Date('2026-10-10T12:00:00Z');
      const returnDate = new Date('2026-10-17T12:00:00Z');

      const result = calculateFine(dueDate, returnDate, FINE_PER_DAY);
      expect(result.overdueDays).toBe(7);
      expect(result.fine).toBe(35);
      expect(result.isOverdue).toBe(true);
    });
  });

  describe('Return Workflow & Final Fine Persistence', () => {
    it('should record the final fine on returned loan and reset active borrowing status', async () => {
      const librarian = await new User({
        name: 'Lib Test',
        email: 'lib_fine@example.com',
        password: 'Password123',
        role: ROLES.LIBRARIAN
      }).save();

      const member = await new User({
        name: 'Member Fine',
        email: 'mem_fine@example.com',
        password: 'Password123',
        role: ROLES.MEMBER
      }).save();

      const book = await new Book({
        title: 'Overdue Test Book',
        author: 'Author',
        ISBN: '978-0000000555',
        category: 'Fiction',
        totalCopies: 3,
        availableCopies: 3
      }).save();

      // Issue book with a dueDate 4 days in the past
      const issuedAt = new Date(Date.now() - 18 * 24 * 60 * 60 * 1000);
      const dueDate = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);

      const loan = new Loan({
        book: book._id,
        member: member._id,
        issuedBy: librarian._id,
        issuedAt,
        dueDate,
        status: LOAN_STATUS.ISSUED,
        fine: 0
      });
      await loan.save();
      await Book.findByIdAndUpdate(book._id, { $inc: { availableCopies: -1 } });

      // Return the overdue book today
      const returnResult = await loanService.returnBook(loan._id, new Date());
      expect(returnResult.loan.status).toBe(LOAN_STATUS.RETURNED);
      expect(returnResult.loan.fine).toBeGreaterThanOrEqual(20); // 4 days * 5 = 20
      expect(returnResult.fine).toBeGreaterThanOrEqual(20);
      expect(returnResult.book.availableCopies).toBe(3);
    });
  });

  describe('Section 32: Most Borrowed Books Historical Aggregation', () => {
    it('should calculate popularity using both active and returned historical loans', async () => {
      const librarian = await new User({
        name: 'Lib Test',
        email: 'lib_agg@example.com',
        password: 'Password123',
        role: ROLES.LIBRARIAN
      }).save();

      const member = await new User({
        name: 'Member Agg',
        email: 'mem_agg@example.com',
        password: 'Password123',
        role: ROLES.MEMBER
      }).save();

      const bookPopular = await new Book({
        title: 'Highly Borrowed Book',
        author: 'Popular Author',
        ISBN: '978-9999999001',
        category: 'Technology',
        totalCopies: 5,
        availableCopies: 5
      }).save();

      const bookNormal = await new Book({
        title: 'Normal Book',
        author: 'Normal Author',
        ISBN: '978-9999999002',
        category: 'History',
        totalCopies: 5,
        availableCopies: 5
      }).save();

      // Create 3 returned loans and 1 active loan for Popular Book (Total: 4)
      for (let i = 0; i < 3; i++) {
        await new Loan({
          book: bookPopular._id,
          member: member._id,
          issuedBy: librarian._id,
          issuedAt: new Date(),
          dueDate: new Date(),
          returnedAt: new Date(),
          status: LOAN_STATUS.RETURNED,
          fine: 0
        }).save();
      }
      await new Loan({
        book: bookPopular._id,
        member: member._id,
        issuedBy: librarian._id,
        issuedAt: new Date(),
        dueDate: new Date(),
        status: LOAN_STATUS.ISSUED,
        fine: 0
      }).save();

      // Create 1 returned loan for Normal Book (Total: 1)
      await new Loan({
        book: bookNormal._id,
        member: member._id,
        issuedBy: librarian._id,
        issuedAt: new Date(),
        dueDate: new Date(),
        returnedAt: new Date(),
        status: LOAN_STATUS.RETURNED,
        fine: 0
      }).save();

      const dashboardData = await dashboardService.getLibrarianDashboardData();
      const mostBorrowed = dashboardData.mostBorrowedBooks;

      expect(mostBorrowed.length).toBeGreaterThanOrEqual(2);
      expect(mostBorrowed[0]._id.toString()).toBe(bookPopular._id.toString());
      expect(mostBorrowed[0].borrowCount).toBe(4);
      expect(mostBorrowed[1]._id.toString()).toBe(bookNormal._id.toString());
      expect(mostBorrowed[1].borrowCount).toBe(1);
    });
  });
});
