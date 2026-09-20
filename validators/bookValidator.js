function validateBook(data, isUpdate = false) {
  const errors = [];

  const title = (data.title || '').trim();
  const author = (data.author || '').trim();
  const ISBN = (data.ISBN || '').trim().toUpperCase();
  const category = (data.category || '').trim();
  const description = (data.description || '').trim();

  if (!isUpdate || data.title !== undefined) {
    if (!title) {
      errors.push('Book title is required');
    } else if (title.length > 200) {
      errors.push('Title cannot exceed 200 characters');
    }
  }

  if (!isUpdate || data.author !== undefined) {
    if (!author) {
      errors.push('Author name is required');
    } else if (author.length > 100) {
      errors.push('Author name cannot exceed 100 characters');
    }
  }

  if (!isUpdate || data.ISBN !== undefined) {
    if (!ISBN) {
      errors.push('ISBN is required');
    } else if (ISBN.length < 5 || ISBN.length > 20) {
      errors.push('ISBN must be between 5 and 20 characters');
    }
  }

  if (!isUpdate || data.category !== undefined) {
    if (!category) {
      errors.push('Category is required');
    }
  }

  let totalCopies;
  if (!isUpdate || data.totalCopies !== undefined) {
    totalCopies = parseInt(data.totalCopies, 10);
    // Edge Case 5: Negative copies
    if (isNaN(totalCopies) || totalCopies < 0) {
      errors.push('Total copies must be a non-negative integer (0 or greater)');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      title,
      author,
      ISBN,
      category,
      totalCopies,
      description
    }
  };
}

module.exports = {
  validateBook
};
