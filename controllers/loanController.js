const loanService = require('../services/loanService');
const Loan = require('../models/Loan');
const User = require('../models/User');
const Book = require('../models/Book');
const { ROLES, LOAN_STATUS } = require('../config/constants');
const { calculateFine, isLoanOverdue } = require('../utils/fineCalculator');

class LoanController {
  /**
   * Member views their active loans
   */
  async listMemberLoans(req, res, next) {
    try {
      const memberId = req.session.user._id;
      const activeLoans = await loanService.getMemberActiveLoans(memberId);

      res.render('member/loans', {
        title: 'My Active Borrowed Books',
        loans: activeLoans
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Member views complete borrowing history
   */
  async listMemberHistory(req, res, next) {
    try {
      const memberId = req.session.user._id;
      const page = parseInt(req.query.page, 10) || 1;

      const result = await loanService.getMemberLoanHistory(memberId, page, 10);

      res.render('member/history', {
        title: 'Borrowing History',
        loans: result.loans,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Librarian views all loans (filter by status: all, ISSUED, RETURNED, overdue)
   */
  async listLibrarianLoans(req, res, next) {
    try {
      const { status = 'all', page = 1 } = req.query;
      const pageNum = parseInt(page, 10) || 1;
      const limit = 10;
      const skip = (pageNum - 1) * limit;

      const now = new Date();
      const filter = {};

      if (status === 'ISSUED') {
        filter.status = LOAN_STATUS.ISSUED;
      } else if (status === 'RETURNED') {
        filter.status = LOAN_STATUS.RETURNED;
      } else if (status === 'OVERDUE') {
        filter.status = LOAN_STATUS.ISSUED;
        filter.dueDate = { $lt: now };
      }

      const [loans, total] = await Promise.all([
        Loan.find(filter)
          .populate('book member issuedBy')
          .sort({ status: 1, dueDate: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Loan.countDocuments(filter)
      ]);

      const enrichedLoans = loans.map(loan => {
        if (loan.status === LOAN_STATUS.ISSUED) {
          const { fine, overdueDays, isOverdue } = calculateFine(loan.dueDate, now);
          return { ...loan, calculatedFine: fine, overdueDays, isOverdue };
        }
        return {
          ...loan,
          calculatedFine: loan.fine,
          overdueDays: calculateFine(loan.dueDate, loan.returnedAt).overdueDays,
          isOverdue: loan.fine > 0
        };
      });

      const totalPages = Math.ceil(total / limit) || 1;

      res.render('librarian/loans/index', {
        title: 'Manage Book Loans',
        loans: enrichedLoans,
        currentStatus: status,
        pagination: {
          total,
          page: pageNum,
          limit,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Show direct issue form
   */
  async showDirectIssueForm(req, res, next) {
    try {
      const [members, books] = await Promise.all([
        User.find({ role: ROLES.MEMBER }).sort({ name: 1 }).lean(),
        Book.find({ isActive: true, availableCopies: { $gt: 0 } }).sort({ title: 1 }).lean()
      ]);

      res.render('librarian/loans/issue', {
        title: 'Direct Issue Book',
        members,
        books,
        errors: []
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Process direct issue
   */
  async directIssue(req, res, next) {
    const librarianId = req.session.user._id;
    const { memberId, bookId } = req.body;

    try {
      if (!memberId || !bookId) {
        throw new Error('Please select both a member and an available book');
      }

      const { loan, updatedBook } = await loanService.directIssue(memberId, bookId, librarianId);
      req.session.success_msg = `Book "${updatedBook.title}" successfully issued!`;
      res.redirect('/librarian/loans');
    } catch (error) {
      const [members, books] = await Promise.all([
        User.find({ role: ROLES.MEMBER }).sort({ name: 1 }).lean(),
        Book.find({ isActive: true, availableCopies: { $gt: 0 } }).sort({ title: 1 }).lean()
      ]);

      res.status(400).render('librarian/loans/issue', {
        title: 'Direct Issue Book',
        members,
        books,
        errors: [error.message]
      });
    }
  }

  /**
   * Librarian processes book return
   */
  async returnBook(req, res) {
    const loanId = req.params.id;

    try {
      const { loan, fine, overdueDays } = await loanService.returnBook(loanId);
      if (fine > 0) {
        req.session.success_msg = `Book returned successfully! Loan was overdue by ${overdueDays} day(s). Fine assessed: $${fine.toFixed(2)}.`;
      } else {
        req.session.success_msg = 'Book returned successfully on time! Inventory updated.';
      }
    } catch (error) {
      req.session.error_msg = error.message;
    }

    res.redirect('/librarian/loans');
  }

  /**
   * Librarian views member accounts
   */
  async listMembers(req, res, next) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = 10;
      const skip = (page - 1) * limit;

      const [members, total] = await Promise.all([
        User.find({ role: ROLES.MEMBER })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        User.countDocuments({ role: ROLES.MEMBER })
      ]);

      // Enrich with active loan count and total borrowed count
      const enrichedMembers = await Promise.all(
        members.map(async member => {
          const [activeCount, totalCount] = await Promise.all([
            Loan.countDocuments({ member: member._id, status: LOAN_STATUS.ISSUED }),
            Loan.countDocuments({ member: member._id })
          ]);
          return {
            ...member,
            activeLoansCount: activeCount,
            totalLoansCount: totalCount
          };
        })
      );

      const totalPages = Math.ceil(total / limit) || 1;

      res.render('librarian/members/index', {
        title: 'Library Members',
        members: enrichedMembers,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new LoanController();
