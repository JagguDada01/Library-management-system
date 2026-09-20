const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    author: {
      type: String,
      required: [true, 'Author is required'],
      trim: true,
      maxlength: [100, 'Author cannot exceed 100 characters']
    },
    ISBN: {
      type: String,
      trim: true,
      uppercase: true
    },
    isbn: {
      type: String,
      trim: true,
      uppercase: true
    },
    category: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Category is required']
    },
    totalCopies: {
      type: Number,
      required: [true, 'Total copies is required'],
      min: [0, 'Total copies cannot be negative']
    },
    availableCopies: {
      type: Number,
      required: [true, 'Available copies is required'],
      min: [0, 'Available copies cannot be negative']
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Map isbn <-> ISBN on initialization
bookSchema.pre('init', function (doc) {
  if (doc) {
    if (doc.isbn && !doc.ISBN) {
      doc.ISBN = doc.isbn;
    }
    if (doc.ISBN && !doc.isbn) {
      doc.isbn = doc.ISBN;
    }
    if (doc.isActive === undefined) {
      doc.isActive = true;
    }
  }
});

// Invariant validator: availableCopies <= totalCopies
bookSchema.pre('validate', function () {
  if (!this.ISBN && this.isbn) {
    this.ISBN = this.isbn;
  }
  if (!this.isbn && this.ISBN) {
    this.isbn = this.ISBN;
  }
  if (!this.ISBN && !this.isbn) {
    this.invalidate('ISBN', 'ISBN is required');
  }
  if (this.availableCopies > this.totalCopies) {
    this.invalidate('availableCopies', 'Available copies cannot exceed total copies');
  }
  if (this.availableCopies < 0) {
    this.invalidate('availableCopies', 'Available copies cannot be negative');
  }
  if (this.totalCopies < 0) {
    this.invalidate('totalCopies', 'Total copies cannot be negative');
  }
});

// Indexes for fast searching and filtering
bookSchema.index({ title: 1 });
bookSchema.index({ author: 1 });
bookSchema.index({ category: 1 });
bookSchema.index({ isActive: 1 });
bookSchema.index({ ISBN: 1 });
bookSchema.index({ isbn: 1 });
bookSchema.index({ title: 'text', author: 'text', description: 'text' });

const Book = mongoose.model('Book', bookSchema);
module.exports = Book;
