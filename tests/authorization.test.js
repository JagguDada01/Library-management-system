const request = require('supertest');
const { app, connectTestDB, clearTestDB, closeTestDB, getAuthenticatedAgent } = require('./testHelper');
const User = require('../models/User');
const { ROLES } = require('../config/constants');

describe('Role Authorization & Privilege Escalation Protection', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  describe('Edge Case 9: Role Escalation Prevention', () => {
    it('should ignore role parameter on registration and force MEMBER role', async () => {
      const res = await request(app)
        .post('/register')
        .set('x-test-skip-csrf', 'true')
        .send({
          name: 'Hacker Attempt',
          email: 'hacker@example.com',
          password: 'Password123',
          role: ROLES.LIBRARIAN // Tampering attempt
        });

      expect(res.status).toBe(302);
      const user = await User.findOne({ email: 'hacker@example.com' });
      expect(user.role).toBe(ROLES.MEMBER);
      expect(user.role).not.toBe(ROLES.LIBRARIAN);
    });
  });

  describe('Server-Side Route Protection', () => {
    it('should return 403 Forbidden when a member accesses GET /librarian/dashboard', async () => {
      const { agent } = await getAuthenticatedAgent(ROLES.MEMBER);
      const res = await agent.get('/librarian/dashboard');
      expect(res.status).toBe(403);
      expect(res.text).toContain('403 - Forbidden');
    });

    it('should return 403 Forbidden when a member submits POST /librarian/books', async () => {
      const { agent } = await getAuthenticatedAgent(ROLES.MEMBER);
      const res = await agent
        .post('/librarian/books')
        .set('x-test-skip-csrf', 'true')
        .send({
          title: 'Unauthorized Book',
          author: 'Attacker',
          ISBN: '978-9999999999',
          category: 'Fiction',
          totalCopies: 5
        });

      expect(res.status).toBe(403);
    });

    it('should allow a librarian to access GET /librarian/dashboard', async () => {
      const { agent } = await getAuthenticatedAgent(ROLES.LIBRARIAN);
      const res = await agent.get('/librarian/dashboard');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Librarian Analytics & Operations');
    });

    it('should allow a librarian to access GET /librarian/books', async () => {
      const { agent } = await getAuthenticatedAgent(ROLES.LIBRARIAN);
      const res = await agent.get('/librarian/books');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Book Inventory Management');
    });
  });
});
