require('dotenv').config();

module.exports = {
  ROLES: {
    MEMBER: 'MEMBER',
    LIBRARIAN: 'LIBRARIAN'
  },
  REQUEST_STATUS: {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED'
  },
  LOAN_STATUS: {
    ISSUED: 'ISSUED',
    RETURNED: 'RETURNED'
  },
  MAX_ACTIVE_LOANS: parseInt(process.env.MAX_ACTIVE_LOANS, 10) || 5,
  LOAN_DURATION_DAYS: parseInt(process.env.LOAN_DURATION_DAYS, 10) || 14,
  FINE_PER_DAY: parseFloat(process.env.FINE_PER_DAY) || 5,
  CATEGORIES: [
    'Fiction',
    'Non-Fiction',
    'Science & Technology',
    'Computer Science',
    'History',
    'Philosophy',
    'Literature',
    'Mathematics',
    'Business & Economics',
    'Art & Design',
    'Biography'
  ]
};
