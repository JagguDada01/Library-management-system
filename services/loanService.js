const Book = require('../models/Book');
const User = require('../models/User');
const Request = require('../models/Request');
const Loan = require('../models/Loan');
const { ROLES, REQUEST_STATUS, LOAN_STATUS, MAX_ACTIVE_LOANS, LOAN_DURATION_DAYS } = require('../config/constants');
const { calculateFine } = require('../utils/fineCalculator');

class LoanService {
  /**
   * Member submits a book request.
   */
  async requestBook(memberId, bookId) {
    // 1. Check member
    const member = await User.findById(memberId);
    if (!member || member.role !== ROLES.MEMBER) {
      throw new Error('Invalid member account');
    }

    // 2. Check book exists and is active
    const book = await Book.findById(bookId);
    if (!book) {
      throw new Error('Book not found');
    }
    if (book.isActive === false) {
      throw new Error('This book is currently archived and unavailable for request');
    }

    // 3. Check book availability
    if (book.availableCopies <= 0) {
      throw new Error('No copies of this book are currently available');
    }

    // 4. Check borrowing limit (Edge Case 2)
    const activeLoansCount = await Loan.countDocuments({
      member: memberId,
      status: LOAN_STATUS.ISSUED
    });
    if (activeLoansCount >= MAX_ACTIVE_LOANS) {
      throw new Error(`You have reached the maximum active borrowing limit of ${MAX_ACTIVE_LOANS} books`);
    }

    // 5. Check duplicate active loan (Edge Case 3)
    const existingActiveLoan = await Loan.findOne({
      member: memberId,
      book: bookId,
      status: LOAN_STATUS.ISSUED
    });
    if (existingActiveLoan) {
      throw new Error('You already have an active loan for this book');
    }

    // 6. Check existing pending request
    const existingPendingRequest = await Request.findOne({
      member: memberId,
      book: bookId,
      status: REQUEST_STATUS.PENDING
    });
    if (existingPendingRequest) {
      throw new Error('You already have a pending request for this book');
    }

    // Create request
    const request = new Request({
      book: bookId,
      member: memberId,
      status: REQUEST_STATUS.PENDING,
      requestedAt: new Date()
    });

    return await request.save();
  }

  /**
   * Librarian approves request and issues book.
   * Concurrency-safe atomic inventory decrement (Edge Case 1 & 8 & 10).
   */
  async approveRequest(requestId, librarianId) {
    const request = await Request.findById(requestId).populate('book member');
    if (!request) {
      throw new Error('Request not found');
    }

    // Edge Case 10: Cannot approve if not pending
    if (request.status !== REQUEST_STATUS.PENDING) {
      throw new Error(`Cannot approve a request with status: ${request.status}`);
    }

    const member = request.member;
    const book = request.book;

    if (!member) {
      throw new Error('Request member no longer exists');
    }
    if (!book || book.isActive === false) {
      throw new Error('Book is no longer available in catalog');
    }

    // Check member active loans limit
    const activeLoansCount = await Loan.countDocuments({
      member: member._id,
      status: LOAN_STATUS.ISSUED
    });
    if (activeLoansCount >= MAX_ACTIVE_LOANS) {
      throw new Error(`Member has already reached the maximum active loan limit (${MAX_ACTIVE_LOANS})`);
    }

    // Check member duplicate loan
    const existingLoan = await Loan.findOne({
      member: member._id,
      book: book._id,
      status: LOAN_STATUS.ISSUED
    });
    if (existingLoan) {
      throw new Error('Member already has an active loan for this book');
    }

    // Atomic book inventory decrement with condition availableCopies > 0
    // Prevents race conditions / negative inventory (Edge Case 1 & 8)
    const updatedBook = await Book.findOneAndUpdate(
      {
        _id: book._id,
        isActive: { $ne: false },
        availableCopies: { $gt: 0 }
      },
      {
        $inc: { availableCopies: -1 }
      },
      {
        returnDocument: 'after'
      }
    );

    if (!updatedBook) {
      throw new Error('Cannot approve request: No copies are currently available for this book');
    }

    // Calculate due date
    const issuedAt = new Date();
    const dueDate = new Date(issuedAt.getTime() + LOAN_DURATION_DAYS * 24 * 60 * 60 * 1000);

    // Create loan
    const loan = new Loan({
      book: book._id,
      member: member._id,
      issuedBy: librarianId,
      issuedAt,
      dueDate,
      status: LOAN_STATUS.ISSUED,
      fine: 0
    });
    await loan.save();

    // Mark request approved
    request.status = REQUEST_STATUS.APPROVED;
    request.processedAt = new Date();
    request.processedBy = librarianId;
    await request.save();

    return { request, loan, updatedBook };
  }

  /**
   * Librarian rejects request with reason.
   */
  async rejectRequest(requestId, librarianId, rejectionReason = '') {
    const request = await Request.findById(requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    if (request.status !== REQUEST_STATUS.PENDING) {
      throw new Error(`Cannot reject a request with status: ${request.status}`);
    }

    request.status = REQUEST_STATUS.REJECTED;
    request.processedAt = new Date();
    request.processedBy = librarianId;
    request.rejectionReason = rejectionReason.trim() || 'Request rejected by librarian';
    return await request.save();
  }

  /**
   * Librarian directly issues a book to a member.
   */
  async directIssue(memberId, bookId, librarianId) {
    const member = await User.findById(memberId);
    if (!member || member.role !== ROLES.MEMBER) {
      throw new Error('Invalid member selected');
    }

    const book = await Book.findById(bookId);
    if (!book || book.isActive === false) {
      throw new Error('Selected book is not active or does not exist');
    }

    // Check member limits
    const activeLoans = await Loan.countDocuments({
      member: memberId,
      status: LOAN_STATUS.ISSUED
    });
    if (activeLoans >= MAX_ACTIVE_LOANS) {
      throw new Error(`Member has reached the limit of ${MAX_ACTIVE_LOANS} active loans`);
    }

    const existingLoan = await Loan.findOne({
      member: memberId,
      book: bookId,
      status: LOAN_STATUS.ISSUED
    });
    if (existingLoan) {
      throw new Error('Member already has an active loan for this book');
    }

    // Atomic decrement
    const updatedBook = await Book.findOneAndUpdate(
      {
        _id: bookId,
        isActive: { $ne: false },
        availableCopies: { $gt: 0 }
      },
      {
        $inc: { availableCopies: -1 }
      },
      {
        returnDocument: 'after'
      }
    );

    if (!updatedBook) {
      throw new Error('No copies of this book are currently available to issue');
    }

    const issuedAt = new Date();
    const dueDate = new Date(issuedAt.getTime() + LOAN_DURATION_DAYS * 24 * 60 * 60 * 1000);

    const loan = new Loan({
      book: bookId,
      member: memberId,
      issuedBy: librarianId,
      issuedAt,
      dueDate,
      status: LOAN_STATUS.ISSUED,
      fine: 0
    });

    await loan.save();
    return { loan, updatedBook };
  }

  /**
   * Returns a book loan with double return protection and fine calculation.
   * Edge Case 4 handled here.
   */
  async returnBook(loanId, returnDate = new Date()) {
    const loan = await Loan.findById(loanId).populate('book member');
    if (!loan) {
      throw new Error('Loan record not found');
    }

    // Edge Case 4: Double return protection
    if (loan.status === LOAN_STATUS.RETURNED || loan.returnedAt !== null) {
      throw new Error('This book has already been returned. Cannot process return twice.');
    }

    const retDate = new Date(returnDate);
    const { fine, overdueDays } = calculateFine(loan.dueDate, retDate);

    // Atomic loan update checking that status is still ISSUED and returnedAt is null
    const updatedLoan = await Loan.findOneAndUpdate(
      {
        _id: loanId,
        status: LOAN_STATUS.ISSUED,
        returnedAt: null
      },
      {
        $set: {
          status: LOAN_STATUS.RETURNED,
          returnedAt: retDate,
          fine: fine
        }
      },
      {
        returnDocument: 'after'
      }
    );

    if (!updatedLoan) {
      throw new Error('Return failed: Loan was already processed or is no longer active');
    }

    // Atomically increment book inventory
    const updatedBook = await Book.findByIdAndUpdate(
      loan.book._id || loan.book,
      {
        $inc: { availableCopies: 1 }
      },
      {
        returnDocument: 'after'
      }
    );

    return {
      loan: updatedLoan,
      book: updatedBook,
      fine,
      overdueDays
    };
  }

  /**
   * Retrieves active loans for a member.
   */
  async getMemberActiveLoans(memberId) {
    const loans = await Loan.find({
      member: memberId,
      status: LOAN_STATUS.ISSUED
    })
      .populate('book')
      .sort({ dueDate: 1 })
      .lean();

    const now = new Date();
    return loans.map(loan => {
      const { fine, overdueDays, isOverdue } = calculateFine(loan.dueDate, now);
      return {
        ...loan,
        currentFine: fine,
        overdueDays,
        isOverdue
      };
    });
  }

  /**
   * Retrieves loan history for a member.
   */
  async getMemberLoanHistory(memberId, page = 1, limit = 10) {
    const query = { member: memberId };
    const skip = (page - 1) * limit;

    const [loans, total] = await Promise.all([
      Loan.find(query)
        .populate('book issuedBy')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Loan.countDocuments(query)
    ]);

    const now = new Date();
    const enrichedLoans = loans.map(loan => {
      if (loan.status === LOAN_STATUS.ISSUED) {
        const { fine, overdueDays, isOverdue } = calculateFine(loan.dueDate, now);
        return { ...loan, currentFine: fine, overdueDays, isOverdue };
      }
      return {
        ...loan,
        currentFine: loan.fine,
        overdueDays: calculateFine(loan.dueDate, loan.returnedAt).overdueDays,
        isOverdue: loan.fine > 0
      };
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      loans: enrichedLoans,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }

  /**
   * Retrieves member's requests.
   */
  async getMemberRequests(memberId, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [requests, total] = await Promise.all([
      Request.find({ member: memberId })
        .populate('book processedBy')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Request.countDocuments({ member: memberId })
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      requests,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }
}

module.exports = new LoanService();
