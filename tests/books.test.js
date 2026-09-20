const request = require('supertest');
const { app, connectTestDB, clearTestDB, closeTestDB, getAuthenticatedAgent } = require('./testHelper');
const Book = require('../models/Book');
const { ROLES } = require('../config/constants');

describe('Book Catalog and CRUD Operations', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  describe('Book Creation & Validation', () => {
    it('should allow librarian to create book with availableCopies equal to totalCopies', async () => {
      const { agent } = await getAuthenticatedAgent(ROLES.LIBRARIAN);

      const res = await agent
        .post('/librarian/books')
        .set('x-test-skip-csrf', 'true')
        .send({
          title: 'Structure and Interpretation of Computer Programs',
          author: 'Harold Abelson and Gerald Jay Sussman',
          ISBN: '978-0262510875',
          category: 'Computer Science',
          totalCopies: 5,
          description: 'A classic computer science textbook.'
        });

      expect(res.status).toBe(302);

      const book = await Book.findOne({ ISBN: '978-0262510875' });
      expect(book).not.toBeNull();
      expect(book.title).toBe('Structure and Interpretation of Computer Programs');
      expect(book.totalCopies).toBe(5);
      expect(book.availableCopies).toBe(5);
      expect(book.isActive).toBe(true);
    });

    it('should reject book creation with duplicate ISBN', async () => {
      const { agent } = await getAuthenticatedAgent(ROLES.LIBRARIAN);

      await new Book({
        title: 'Original Title',
        author: 'Original Author',
        ISBN: '978-1111111111',
        category: 'Fiction',
        totalCopies: 2,
        availableCopies: 2
      }).save();

      const res = await agent
        .post('/librarian/books')
        .set('x-test-skip-csrf', 'true')
        .send({
          title: 'Duplicate ISBN Title',
          author: 'Another Author',
          ISBN: '978-1111111111',
          category: 'Philosophy',
          totalCopies: 4
        });

      expect(res.status).toBe(400);
      expect(res.text).toContain('already exists');
    });

    it('should reject creation with negative total copies (Edge Case 5)', async () => {
      const { agent } = await getAuthenticatedAgent(ROLES.LIBRARIAN);

      const res = await agent
        .post('/librarian/books')
        .set('x-test-skip-csrf', 'true')
        .send({
          title: 'Invalid Copies Book',
          author: 'Author',
          ISBN: '978-2222222222',
          category: 'Science & Technology',
          totalCopies: -1
        });

      expect(res.status).toBe(400);
      expect(res.text).toContain('non-negative');
    });
  });

  describe('Search & Filter', () => {
    beforeEach(async () => {
      await Book.insertMany([
        {
          title: 'JavaScript: The Good Parts',
          author: 'Douglas Crockford',
          ISBN: '978-0596517748',
          category: 'Computer Science',
          totalCopies: 3,
          availableCopies: 3,
          isActive: true
        },
        {
          title: 'You Don\'t Know JS Yet',
          author: 'Kyle Simpson',
          ISBN: '978-1098171056',
          category: 'Computer Science',
          totalCopies: 2,
          availableCopies: 0,
          isActive: true
        },
        {
          title: 'A People\'s History of the United States',
          author: 'Howard Zinn',
          ISBN: '978-0060838652',
          category: 'History',
          totalCopies: 4,
          availableCopies: 4,
          isActive: true
        }
      ]);
    });

    it('should search books by title query', async () => {
      const res = await request(app).get('/books?search=Good+Parts');
      expect(res.status).toBe(200);
      expect(res.text).toContain('JavaScript: The Good Parts');
      expect(res.text).not.toContain('Howard Zinn');
    });

    it('should search books by author query', async () => {
      const res = await request(app).get('/books?search=Simpson');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Kyle Simpson');
      expect(res.text).not.toContain('Howard Zinn');
    });

    it('should filter books by category', async () => {
      const res = await request(app).get('/books?category=History');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Howard Zinn');
      expect(res.text).not.toContain('JavaScript: The Good Parts');
    });

    it('should filter books by availability', async () => {
      const res = await request(app).get('/books?availability=unavailable');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Kyle Simpson');
      expect(res.text).not.toContain('JavaScript: The Good Parts');
    });
  });

  describe('Book Archival', () => {
    it('should safely archive a book (isActive = false) preserving data', async () => {
      const { agent } = await getAuthenticatedAgent(ROLES.LIBRARIAN);

      const book = await new Book({
        title: 'Title to Archive',
        author: 'Author',
        ISBN: '978-3333333333',
        category: 'Literature',
        totalCopies: 2,
        availableCopies: 2,
        isActive: true
      }).save();

      const res = await agent
        .post(`/librarian/books/${book._id}/archive`)
        .set('x-test-skip-csrf', 'true');

      expect(res.status).toBe(302);

      const updated = await Book.findById(book._id);
      expect(updated.isActive).toBe(false);

      // Archived book should not appear in member catalog
      const catalogRes = await request(app).get('/books');
      expect(catalogRes.text).not.toContain('Title to Archive');
    });
  });
});
