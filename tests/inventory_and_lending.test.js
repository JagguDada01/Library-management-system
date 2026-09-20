const { connectTestDB, clearTestDB, closeTestDB } = require('./testHelper');
const bookService = require('../services/bookService');
const loanService = require('../services/loanService');
const Book = require('../models/Book');
const User = require('../models/User');
const Loan = require('../models/Loan');
const Request = require('../models/Request');
const { ROLES, LOAN_STATUS, REQUEST_STATUS, MAX_ACTIVE_LOANS } = require('../config/constants');

describe('Inventory & Lending Edge Cases (Sections 20-25, 48)', () => {
  let librarian;
  let member;

  beforeAll(async () => {
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    librarian = await new User({
      name: 'Test Librarian',
      email: 'lib@example.com',
      password: 'Password123',
      role: ROLES.LIBRARIAN
    }).save();

    member = await new User({
      name: 'Test Member',
      email: 'mem@example.com',
      password: 'Password123',
      role: ROLES.MEMBER
    }).save();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  describe('Edge Case 1: Last Copy Handling', () => {
    it('should successfully issue the last copy and reject subsequent issue attempts', async () => {
      const book = await new Book({
        title: 'Only One Copy Book',
        author: 'Unique Author',
        ISBN: '978-0000000001',
        category: 'Fiction',
        totalCopies: 1,
        availableCopies: 1,
        isActive: true
      }).save();

      // Issue the only copy
      const issue1 = await loanService.directIssue(member._id, book._id, librarian._id);
      expect(issue1.loan.status).toBe(LOAN_STATUS.ISSUED);
      expect(issue1.updatedBook.availableCopies).toBe(0);

      // Create another member to attempt 2nd issue
      const member2 = await new User({
        name: 'Second Member',
        email: 'mem2@example.com',
        password: 'Password123',
        role: ROLES.MEMBER
      }).save();

      // Attempting second issue must be rejected
      await expect(
        loanService.directIssue(member2._id, book._id, librarian._id)
      ).rejects.toThrow(/No copies of this book are currently available/);

      // Verify copies never dropped below 0
      const refreshedBook = await Book.findById(book._id);
      expect(refreshedBook.availableCopies).toBe(0);
    });
  });

  describe('Edge Case 2: Borrowing Limit (MAX_ACTIVE_LOANS)', () => {
    it(`should reject borrowing when member reaches ${MAX_ACTIVE_LOANS} active loans`, async () => {
      // Create 6 books
      const books = [];
      for (let i = 1; i <= 6; i++) {
        const b = await new Book({
          title: `Book ${i}`,
          author: 'Author',
          ISBN: `978-00000000${i}0`,
          category: 'Fiction',
          totalCopies: 2,
          availableCopies: 2
        }).save();
        books.push(b);
      }

      // Issue 5 books (reaching limit)
      for (let i = 0; i < MAX_ACTIVE_LOANS; i++) {
        await loanService.directIssue(member._id, books[i]._id, librarian._id);
      }

      const activeCount = await Loan.countDocuments({ member: member._id, status: LOAN_STATUS.ISSUED });
      expect(activeCount).toBe(MAX_ACTIVE_LOANS);

      // 6th issue attempt must be rejected
      await expect(
        loanService.directIssue(member._id, books[5]._id, librarian._id)
      ).rejects.toThrow(new RegExp(`limit of ${MAX_ACTIVE_LOANS} active loans`));

      // 6th request attempt must also be rejected
      await expect(
        loanService.requestBook(member._id, books[5]._id)
      ).rejects.toThrow(new RegExp(`limit of ${MAX_ACTIVE_LOANS} books`));
    });
  });

  describe('Edge Case 3: Duplicate Book Loan Prevention', () => {
    it('should reject request or issue if member already has an active loan for the same book', async () => {
      const book = await new Book({
        title: 'Single User Book',
        author: 'Author',
        ISBN: '978-0000000033',
        category: 'Science & Technology',
        totalCopies: 5,
        availableCopies: 5
      }).save();

      // Issue first copy to member
      await loanService.directIssue(member._id, book._id, librarian._id);

      // Attempting to request the same book while holding active loan must be rejected
      await expect(
        loanService.requestBook(member._id, book._id)
      ).rejects.toThrow(/already have an active loan for this book/);

      // Attempting direct issue again for the same book must be rejected
      await expect(
        loanService.directIssue(member._id, book._id, librarian._id)
      ).rejects.toThrow(/already has an active loan for this book/);
    });
  });

  describe('Edge Case 4: Double Return Protection', () => {
    it('should prevent double return and prevent duplicate inventory increment', async () => {
      const book = await new Book({
        title: 'Double Return Book',
        author: 'Author',
        ISBN: '978-0000000044',
        category: 'Literature',
        totalCopies: 3,
        availableCopies: 3
      }).save();

      const { loan } = await loanService.directIssue(member._id, book._id, librarian._id);

      const bookAfterIssue = await Book.findById(book._id);
      expect(bookAfterIssue.availableCopies).toBe(2);

      // First return succeeds
      const return1 = await loanService.returnBook(loan._id);
      expect(return1.loan.status).toBe(LOAN_STATUS.RETURNED);
      expect(return1.book.availableCopies).toBe(3);

      // Second return attempt must be rejected
      await expect(
        loanService.returnBook(loan._id)
      ).rejects.toThrow(/already been returned/);

      // Available copies must NOT have incremented again to 4
      const bookAfterSecondReturn = await Book.findById(book._id);
      expect(bookAfterSecondReturn.availableCopies).toBe(3);
      expect(bookAfterSecondReturn.availableCopies).toBeLessThanOrEqual(bookAfterSecondReturn.totalCopies);
    });
  });

  describe('Edge Case 6: Inventory Increase Preserving Issued Copies', () => {
    it('should adjust availableCopies correctly when totalCopies is increased', async () => {
      // Start with total 10, available 10
      const book = await new Book({
        title: 'Inventory Expansion Book',
        author: 'Author',
        ISBN: '978-0000000066',
        category: 'Computer Science',
        totalCopies: 10,
        availableCopies: 10
      }).save();

      // Issue 4 copies to different members (total: 10, available: 6, issued: 4)
      for (let i = 1; i <= 4; i++) {
        const u = await new User({
          name: `Member ${i}`,
          email: `m${i}_${Date.now()}@example.com`,
          password: 'Password123',
          role: ROLES.MEMBER
        }).save();
        await loanService.directIssue(u._id, book._id, librarian._id);
      }

      const bookBeforeUpdate = await Book.findById(book._id);
      expect(bookBeforeUpdate.totalCopies).toBe(10);
      expect(bookBeforeUpdate.availableCopies).toBe(6);

      // Update totalCopies to 12
      const updated = await bookService.updateBook(book._id, { totalCopies: 12 });
      expect(updated.totalCopies).toBe(12);
      // Available copies must now be 12 - 4 = 8 (NOT 12)
      expect(updated.availableCopies).toBe(8);
    });
  });

  describe('Edge Case 7: Lower Total Copies Below Issued Copies', () => {
    it('should reject lowering totalCopies below currently issued copies', async () => {
      // total: 10, available: 10
      const book = await new Book({
        title: 'Inventory Reduction Book',
        author: 'Author',
        ISBN: '978-0000000077',
        category: 'Philosophy',
        totalCopies: 10,
        availableCopies: 10
      }).save();

      // Issue 4 copies
      for (let i = 1; i <= 4; i++) {
        const u = await new User({
          name: `User ${i}`,
          email: `u${i}_${Date.now()}@example.com`,
          password: 'Password123',
          role: ROLES.MEMBER
        }).save();
        await loanService.directIssue(u._id, book._id, librarian._id);
      }

      // There are 4 copies currently issued. Attempt to set totalCopies = 2
      await expect(
        bookService.updateBook(book._id, { totalCopies: 2 })
      ).rejects.toThrow(/Cannot reduce total copies to 2.*4 copy\/copies issued/);

      // Verify totalCopies and availableCopies remained unchanged
      const bookAfterAttempt = await Book.findById(book._id);
      expect(bookAfterAttempt.totalCopies).toBe(10);
      expect(bookAfterAttempt.availableCopies).toBe(6);
    });
  });

  describe('Edge Case 8: Concurrency & Atomic Decrement on Last Copy', () => {
    it('should allow only one loan when two operations race for the last copy', async () => {
      const book = await new Book({
        title: 'Single Copy Race Book',
        author: 'Author',
        ISBN: '978-0000000088',
        category: 'History',
        totalCopies: 1,
        availableCopies: 1
      }).save();

      const memberA = await new User({
        name: 'Member A',
        email: 'memA@example.com',
        password: 'Password123',
        role: ROLES.MEMBER
      }).save();

      const memberB = await new User({
        name: 'Member B',
        email: 'memB@example.com',
        password: 'Password123',
        role: ROLES.MEMBER
      }).save();

      // Simulate simultaneous direct issues
      const results = await Promise.allSettled([
        loanService.directIssue(memberA._id, book._id, librarian._id),
        loanService.directIssue(memberB._id, book._id, librarian._id)
      ]);

      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      // Exactly one must succeed, one must fail
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      // Available copies must be exactly 0, never -1
      const finalBook = await Book.findById(book._id);
      expect(finalBook.availableCopies).toBe(0);
    });
  });

  describe('Edge Case 10: Invalid Request Approval', () => {
    it('should reject approval of an already rejected request and create no loan', async () => {
      const book = await new Book({
        title: 'Request Approval Book',
        author: 'Author',
        ISBN: '978-0000000100',
        category: 'Fiction',
        totalCopies: 2,
        availableCopies: 2
      }).save();

      const request = await loanService.requestBook(member._id, book._id);
      expect(request.status).toBe(REQUEST_STATUS.PENDING);

      // Reject the request
      await loanService.rejectRequest(request._id, librarian._id, 'Duplicate request');

      const rejectedReq = await Request.findById(request._id);
      expect(rejectedReq.status).toBe(REQUEST_STATUS.REJECTED);

      // Attempting to approve the rejected request must throw error
      await expect(
        loanService.approveRequest(request._id, librarian._id)
      ).rejects.toThrow(/Cannot approve a request with status: REJECTED/);

      // Verify no loan was created
      const loanCount = await Loan.countDocuments({ book: book._id });
      expect(loanCount).toBe(0);

      // Verify available copies remained 2
      const freshBook = await Book.findById(book._id);
      expect(freshBook.availableCopies).toBe(2);
    });
  });
});
