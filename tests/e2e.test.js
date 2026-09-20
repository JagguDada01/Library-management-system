const request = require('supertest');
const { app, connectTestDB, clearTestDB, closeTestDB } = require('./testHelper');
const Book = require('../models/Book');
const User = require('../models/User');
const Loan = require('../models/Loan');
const Request = require('../models/Request');
const { ROLES, LOAN_STATUS, REQUEST_STATUS } = require('../config/constants');
const { calculateFine } = require('../utils/fineCalculator');

describe('Section 59: Complete End-to-End Full Workflow Test', () => {
  beforeAll(async () => {
    await connectTestDB();
    await clearTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  it('should execute the exact 21-step workflow described in Section 59', async () => {
    // 0. Setup a book in inventory with 2 copies
    const book = await new Book({
      title: 'The Pragmatic Programmer',
      author: 'Andy Hunt and Dave Thomas',
      ISBN: '978-0135957059',
      category: 'Computer Science',
      totalCopies: 2,
      availableCopies: 2,
      isActive: true
    }).save();

    // Setup librarian
    const librarian = await new User({
      name: 'Head Librarian',
      email: 'librarian@example.com',
      password: 'AdminPassword123',
      role: ROLES.LIBRARIAN
    }).save();

    // STEP 1: Register Member
    const memberAgent = request.agent(app);
    const registerRes = await memberAgent
      .post('/register')
      .set('x-test-skip-csrf', 'true')
      .send({
        name: 'Sarah Reader',
        email: 'sarah@example.com',
        password: 'Password123'
      });
    expect(registerRes.status).toBe(302);
    expect(registerRes.headers.location).toBe('/member/dashboard');

    // STEP 2: Login as Member
    const memberLoginRes = await memberAgent
      .post('/login')
      .set('x-test-skip-csrf', 'true')
      .send({
        email: 'sarah@example.com',
        password: 'Password123'
      });
    expect(memberLoginRes.status).toBe(302);

    // STEP 3: Browse Books
    const browseRes = await memberAgent.get('/books');
    expect(browseRes.status).toBe(200);
    expect(browseRes.text).toContain('The Pragmatic Programmer');

    // STEP 4: Search Book
    const searchRes = await memberAgent.get('/books?search=Pragmatic');
    expect(searchRes.status).toBe(200);
    expect(searchRes.text).toContain('The Pragmatic Programmer');

    // STEP 5: Filter Book
    const filterRes = await memberAgent.get('/books?category=Computer+Science');
    expect(filterRes.status).toBe(200);
    expect(filterRes.text).toContain('The Pragmatic Programmer');

    // STEP 6: Request Book
    const requestRes = await memberAgent
      .post(`/member/books/${book._id}/request`)
      .set('x-test-skip-csrf', 'true');
    expect(requestRes.status).toBe(302);
    expect(requestRes.headers.location).toBe('/member/requests');

    const createdRequest = await Request.findOne({ book: book._id });
    expect(createdRequest).not.toBeNull();
    expect(createdRequest.status).toBe(REQUEST_STATUS.PENDING);

    // STEP 7: Logout
    const logoutRes = await memberAgent
      .post('/logout')
      .set('x-test-skip-csrf', 'true');
    expect(logoutRes.status).toBe(302);

    // STEP 8: Login as Librarian
    const librarianAgent = request.agent(app);
    const libLoginRes = await librarianAgent
      .post('/login')
      .set('x-test-skip-csrf', 'true')
      .send({
        email: 'librarian@example.com',
        password: 'AdminPassword123'
      });
    expect(libLoginRes.status).toBe(302);
    expect(libLoginRes.headers.location).toBe('/librarian/dashboard');

    // STEP 9: View Pending Request
    const pendingRequestsRes = await librarianAgent.get('/librarian/requests?status=PENDING');
    expect(pendingRequestsRes.status).toBe(200);
    expect(pendingRequestsRes.text).toContain('The Pragmatic Programmer');
    expect(pendingRequestsRes.text).toContain('Sarah Reader');

    // STEP 10: Approve Request
    const approveRes = await librarianAgent
      .post(`/librarian/requests/${createdRequest._id}/approve`)
      .set('x-test-skip-csrf', 'true');
    expect(approveRes.status).toBe(302);

    const approvedRequest = await Request.findById(createdRequest._id);
    expect(approvedRequest.status).toBe(REQUEST_STATUS.APPROVED);

    // STEP 11 & 12: Verify Book Issued & Available Copies Decreased
    const activeLoan = await Loan.findOne({ book: book._id, status: LOAN_STATUS.ISSUED });
    expect(activeLoan).not.toBeNull();
    expect(activeLoan.member.toString()).toBe(createdRequest.member.toString());

    const bookAfterIssue = await Book.findById(book._id);
    expect(bookAfterIssue.availableCopies).toBe(1); // 2 -> 1
    expect(bookAfterIssue.totalCopies).toBe(2);

    // STEP 13 & 14: View Active Loan & Verify Due Date
    const memberLoansRes = await memberAgent.get('/member/loans');
    // Active loan due date is 14 days after issue
    const expectedDueDate = new Date(activeLoan.issuedAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    expect(new Date(activeLoan.dueDate).toDateString()).toBe(expectedDueDate.toDateString());

    // STEP 15 & 16: Simulate Overdue & Verify Fine
    // Set due date to 2 days and 23 hours in the past so ceiling yields exactly 3 days
    activeLoan.dueDate = new Date(Date.now() - (3 * 24 * 60 * 60 * 1000 - 60 * 60 * 1000));
    await activeLoan.save();

    const fineCalculation = calculateFine(activeLoan.dueDate, new Date());
    expect(fineCalculation.isOverdue).toBe(true);
    expect(fineCalculation.overdueDays).toBe(3);
    expect(fineCalculation.fine).toBe(15); // 3 * $5 = $15

    // STEP 17: Return Book
    const returnRes = await librarianAgent
      .post(`/librarian/loans/${activeLoan._id}/return`)
      .set('x-test-skip-csrf', 'true');
    expect(returnRes.status).toBe(302);

    // STEP 18: Verify Available Copies Increased
    const bookAfterReturn = await Book.findById(book._id);
    expect(bookAfterReturn.availableCopies).toBe(2); // Restored from 1 back to 2

    // STEP 19: Verify Final Fine
    const returnedLoan = await Loan.findById(activeLoan._id);
    expect(returnedLoan.status).toBe(LOAN_STATUS.RETURNED);
    expect(returnedLoan.returnedAt).not.toBeNull();
    expect(returnedLoan.fine).toBe(15);

    // STEP 20: Member logs back in to verify personal borrowing history
    await memberAgent
      .post('/login')
      .set('x-test-skip-csrf', 'true')
      .send({
        email: 'sarah@example.com',
        password: 'Password123'
      });

    const historyRes = await memberAgent.get('/member/history');
    expect(historyRes.status).toBe(200);
    expect(historyRes.text).toContain('The Pragmatic Programmer');
    expect(historyRes.text).toContain('$15.00');

    // STEP 21: Verify Dashboard Statistics
    const libDashRes = await librarianAgent.get('/librarian/dashboard');
    expect(libDashRes.status).toBe(200);
    expect(libDashRes.text).toContain('The Pragmatic Programmer');
    expect(libDashRes.text).toContain('Total Physical Copies');
    expect(libDashRes.text).toContain('Available Copies');
  });
});
