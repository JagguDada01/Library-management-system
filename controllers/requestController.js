const loanService = require('../services/loanService');
const Request = require('../models/Request');
const { REQUEST_STATUS } = require('../config/constants');

class RequestController {
  /**
   * Member submits a book request
   */
  async submitRequest(req, res) {
    const memberId = req.session.user._id;
    const bookId = req.params.id;

    try {
      await loanService.requestBook(memberId, bookId);
      req.session.success_msg = 'Book request submitted successfully! A librarian will review your request shortly.';
      res.redirect('/member/requests');
    } catch (error) {
      req.session.error_msg = error.message;
      res.redirect(`/books/${bookId}`);
    }
  }

  /**
   * Member views their requests
   */
  async listMemberRequests(req, res, next) {
    try {
      const memberId = req.session.user._id;
      const page = parseInt(req.query.page, 10) || 1;

      const result = await loanService.getMemberRequests(memberId, page, 10);

      res.render('member/requests', {
        title: 'My Book Requests',
        requests: result.requests,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Librarian views pending/all requests
   */
  async listLibrarianRequests(req, res, next) {
    try {
      const status = req.query.status || REQUEST_STATUS.PENDING;
      const page = parseInt(req.query.page, 10) || 1;
      const limit = 10;
      const skip = (page - 1) * limit;

      const filter = {};
      if (status !== 'all') {
        filter.status = status;
      }

      const [requests, total] = await Promise.all([
        Request.find(filter)
          .populate('book member processedBy')
          .sort({ requestedAt: status === REQUEST_STATUS.PENDING ? 1 : -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Request.countDocuments(filter)
      ]);

      const totalPages = Math.ceil(total / limit) || 1;

      res.render('librarian/requests/index', {
        title: 'Manage Book Requests',
        requests,
        currentStatus: status,
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

  /**
   * Librarian approves request
   */
  async approveRequest(req, res) {
    const requestId = req.params.id;
    const librarianId = req.session.user._id;

    try {
      const result = await loanService.approveRequest(requestId, librarianId);
      req.session.success_msg = `Request approved! Book "${result.request.book?.title || 'Book'}" has been issued to ${result.request.member?.name || 'member'}.`;
    } catch (error) {
      req.session.error_msg = error.message;
    }

    res.redirect('/librarian/requests');
  }

  /**
   * Librarian rejects request
   */
  async rejectRequest(req, res) {
    const requestId = req.params.id;
    const librarianId = req.session.user._id;
    const rejectionReason = req.body.rejectionReason || '';

    try {
      await loanService.rejectRequest(requestId, librarianId, rejectionReason);
      req.session.success_msg = 'Request has been rejected.';
    } catch (error) {
      req.session.error_msg = error.message;
    }

    res.redirect('/librarian/requests');
  }
}

module.exports = new RequestController();
