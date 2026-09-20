const { FINE_PER_DAY } = require('../config/constants');

/**
 * Normalizes a date to midnight UTC to avoid hour/minute/second discrepancies
 * when comparing full calendar days.
 */
function normalizeDate(date) {
  if (!date) return null;
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Calculates overdue days between a due date and comparison date (return date or now).
 * @param {Date} dueDate
 * @param {Date} [comparisonDate=new Date()]
 * @returns {number} overdue days (>= 0)
 */
function calculateOverdueDays(dueDate, comparisonDate = new Date()) {
  if (!dueDate) return 0;

  const due = new Date(dueDate);
  const comp = new Date(comparisonDate);

  if (comp <= due) {
    return 0;
  }

  const diffMs = comp.getTime() - due.getTime();
  // Using ceiling of 24-hour periods
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

/**
 * Calculates fine based on due date and return/current date.
 * @param {Date} dueDate
 * @param {Date} [comparisonDate=new Date()]
 * @param {number} [ratePerDay=FINE_PER_DAY]
 * @returns {{ overdueDays: number, fine: number, isOverdue: boolean }}
 */
function calculateFine(dueDate, comparisonDate = new Date(), ratePerDay = FINE_PER_DAY) {
  const overdueDays = calculateOverdueDays(dueDate, comparisonDate);
  const fine = overdueDays * ratePerDay;
  return {
    overdueDays,
    fine,
    isOverdue: overdueDays > 0
  };
}

/**
 * Determines whether a loan is currently overdue
 * @param {Date} dueDate
 * @param {Date|null} returnedAt
 * @param {Date} [now=new Date()]
 * @returns {boolean}
 */
function isLoanOverdue(dueDate, returnedAt, now = new Date()) {
  if (returnedAt) {
    return new Date(returnedAt) > new Date(dueDate);
  }
  return new Date(now) > new Date(dueDate);
}

module.exports = {
  calculateOverdueDays,
  calculateFine,
  isLoanOverdue,
  normalizeDate
};
