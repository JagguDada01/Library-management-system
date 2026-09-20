const mongoose = require('mongoose');
const { LOAN_STATUS } = require('../config/constants');

const loanSchema = new mongoose.Schema(
  {
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: [true, 'Book is required']
    },
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Member is required']
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Librarian issuer is required']
    },
    issuedAt: {
      type: Date,
      default: Date.now
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required']
    },
    returnedAt: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: {
        values: [LOAN_STATUS.ISSUED, LOAN_STATUS.RETURNED],
        message: '{VALUE} is not a valid loan status'
      },
      default: LOAN_STATUS.ISSUED
    },
    fine: {
      type: Number,
      default: 0,
      min: [0, 'Fine cannot be negative']
    }
  },
  {
    timestamps: true
  }
);

loanSchema.index({ member: 1, status: 1 });
loanSchema.index({ book: 1, status: 1 });
loanSchema.index({ status: 1, dueDate: 1 });
loanSchema.index({ createdAt: -1 });

const Loan = mongoose.model('Loan', loanSchema);
module.exports = Loan;
