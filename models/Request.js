const mongoose = require('mongoose');
const { REQUEST_STATUS } = require('../config/constants');

const requestSchema = new mongoose.Schema(
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
    status: {
      type: String,
      enum: {
        values: [REQUEST_STATUS.PENDING, REQUEST_STATUS.APPROVED, REQUEST_STATUS.REJECTED],
        message: '{VALUE} is not a valid request status'
      },
      default: REQUEST_STATUS.PENDING
    },
    requestedAt: {
      type: Date,
      default: Date.now
    },
    processedAt: {
      type: Date,
      default: null
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    rejectionReason: {
      type: String,
      default: null,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

requestSchema.index({ member: 1, status: 1 });
requestSchema.index({ book: 1, status: 1 });
requestSchema.index({ requestedAt: -1 });

const Request = mongoose.model('Request', requestSchema);
module.exports = Request;
