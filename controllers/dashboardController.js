const dashboardService = require('../services/dashboardService');
const User = require('../models/User');

class DashboardController {
  /**
   * Member dashboard view
   */
  async memberDashboard(req, res, next) {
    try {
      const memberId = req.session.user._id;
      const data = await dashboardService.getMemberDashboardData(memberId);

      res.render('member/dashboard', {
        title: 'Member Dashboard',
        stats: data.stats,
        activeLoans: data.activeLoans,
        recentRequests: data.recentRequests
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Librarian dashboard view
   */
  async librarianDashboard(req, res, next) {
    try {
      const data = await dashboardService.getLibrarianDashboardData();

      res.render('librarian/dashboard', {
        title: 'Librarian Dashboard & Analytics',
        stats: data.stats,
        mostBorrowedBooks: data.mostBorrowedBooks,
        overdueLoans: data.overdueLoansList,
        recentRequests: data.recentPendingRequests
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * View user profile
   */
  async memberProfile(req, res, next) {
    try {
      const user = await User.findById(req.session.user._id).lean();
      if (!user) {
        req.session.error_msg = 'User not found';
        return res.redirect('/login');
      }

      res.render('member/profile', {
        title: 'My Profile',
        user
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DashboardController();
