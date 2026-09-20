const Book = require('../models/Book');
const User = require('../models/User');
const Loan = require('../models/Loan');
const Request = require('../models/Request');
const { ROLES, REQUEST_STATUS, LOAN_STATUS } = require('../config/constants');
const { calculateFine } = require('../utils/fineCalculator');

class DashboardService {
  /**
   * Aggregates dashboard metrics for a member.
   */
  async getMemberDashboardData(memberId) {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const [activeLoans, pendingRequestsCount, totalBorrowedCount] = await Promise.all([
      Loan.find({ member: memberId, status: LOAN_STATUS.ISSUED }).populate('book').lean(),
      Request.countDocuments({ member: memberId, status: REQUEST_STATUS.PENDING }),
      Loan.countDocuments({ member: memberId })
    ]);

    let overdueCount = 0;
    let dueSoonCount = 0;
    let currentFineTotal = 0;

    const enrichedActiveLoans = activeLoans.map(loan => {
      const { fine, overdueDays, isOverdue } = calculateFine(loan.dueDate, now);
      if (isOverdue) {
        overdueCount++;
        currentFineTotal += fine;
      } else if (new Date(loan.dueDate) <= threeDaysFromNow) {
        dueSoonCount++;
      }
      return {
        ...loan,
        currentFine: fine,
        overdueDays,
        isOverdue,
        isDueSoon: !isOverdue && new Date(loan.dueDate) <= threeDaysFromNow
      };
    });

    // Recent requests
    const recentRequests = await Request.find({ member: memberId })
      .populate('book')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    return {
      stats: {
        activeLoansCount: activeLoans.length,
        pendingRequestsCount,
        overdueCount,
        dueSoonCount,
        totalBorrowedCount,
        currentFineTotal
      },
      activeLoans: enrichedActiveLoans,
      recentRequests
    };
  }

  /**
   * Aggregates dashboard metrics for librarians.
   */
  async getLibrarianDashboardData() {
    const now = new Date();

    const [
      booksAgg,
      totalTitles,
      totalMembers,
      pendingRequestsCount,
      activeLoans,
      mostBorrowedAgg
    ] = await Promise.all([
      Book.aggregate([
        { $match: { isActive: { $ne: false } } },
        {
          $group: {
            _id: null,
            totalPhysicalCopies: { $sum: '$totalCopies' },
            availableCopies: { $sum: '$availableCopies' }
          }
        }
      ]),
      Book.countDocuments({ isActive: { $ne: false } }),
      User.countDocuments({ role: { $in: [ROLES.MEMBER, 'member'] } }),
      Request.countDocuments({ status: REQUEST_STATUS.PENDING }),
      Loan.find({ status: LOAN_STATUS.ISSUED }).populate('book member').lean(),
      // Most borrowed books calculated from all historical loans (both ISSUED and RETURNED)
      Loan.aggregate([
        {
          $group: {
            _id: '$book',
            borrowCount: { $sum: 1 }
          }
        },
        { $sort: { borrowCount: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'books',
            localField: '_id',
            foreignField: '_id',
            as: 'bookDetails'
          }
        },
        { $unwind: '$bookDetails' },
        {
          $project: {
            _id: 1,
            borrowCount: 1,
            title: '$bookDetails.title',
            author: '$bookDetails.author',
            category: '$bookDetails.category',
            availableCopies: '$bookDetails.availableCopies',
            totalCopies: '$bookDetails.totalCopies'
          }
        }
      ])
    ]);

    const totalPhysicalCopies = booksAgg[0]?.totalPhysicalCopies || 0;
    const availableCopies = booksAgg[0]?.availableCopies || 0;
    const issuedBooksCount = activeLoans.length;

    let overdueCount = 0;
    let totalAccruedFine = 0;

    const overdueLoansList = [];

    activeLoans.forEach(loan => {
      const { fine, overdueDays, isOverdue } = calculateFine(loan.dueDate, now);
      if (isOverdue) {
        overdueCount++;
        totalAccruedFine += fine;
        overdueLoansList.push({
          ...loan,
          fine,
          overdueDays
        });
      }
    });

    // Also calculate fines accumulated from returned loans
    const returnedFinesAgg = await Loan.aggregate([
      { $match: { status: LOAN_STATUS.RETURNED } },
      { $group: { _id: null, totalReturnedFines: { $sum: '$fine' } } }
    ]);
    const returnedFinesTotal = returnedFinesAgg[0]?.totalReturnedFines || 0;

    // Recent 5 pending requests
    const recentPendingRequests = await Request.find({ status: REQUEST_STATUS.PENDING })
      .populate('book member')
      .sort({ requestedAt: 1 })
      .limit(5)
      .lean();

    return {
      stats: {
        totalTitles,
        totalPhysicalCopies,
        availableCopies,
        issuedBooksCount,
        overdueCount,
        pendingRequestsCount,
        totalMembers,
        totalAccruedFine,
        totalFinesOverall: totalAccruedFine + returnedFinesTotal
      },
      mostBorrowedBooks: mostBorrowedAgg,
      overdueLoansList: overdueLoansList.slice(0, 5),
      recentPendingRequests
    };
  }
}

module.exports = new DashboardService();
