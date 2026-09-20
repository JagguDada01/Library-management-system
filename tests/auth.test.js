const request = require('supertest');
const { app, connectTestDB, clearTestDB, closeTestDB } = require('./testHelper');
const User = require('../models/User');

describe('Authentication Module', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  describe('Registration', () => {
    it('should register a new member and hash password securely', async () => {
      const res = await request(app)
        .post('/register')
        .set('x-test-skip-csrf', 'true')
        .send({
          name: 'John Reader',
          email: 'john@example.com',
          password: 'Password123'
        });

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/member/dashboard');

      const savedUser = await User.findOne({ email: 'john@example.com' });
      expect(savedUser).not.toBeNull();
      expect(savedUser.name).toBe('John Reader');
      expect(savedUser.role).toBe('MEMBER');
      // Password must NOT be plain text
      expect(savedUser.password).not.toBe('Password123');
      expect(savedUser.password.startsWith('$2')).toBe(true);
    });

    it('should reject registration with duplicate email address', async () => {
      await new User({
        name: 'Existing User',
        email: 'duplicate@example.com',
        password: 'Password123',
        role: 'MEMBER'
      }).save();

      const res = await request(app)
        .post('/register')
        .set('x-test-skip-csrf', 'true')
        .send({
          name: 'New Person',
          email: 'duplicate@example.com',
          password: 'Password123'
        });

      expect(res.status).toBe(400);
      expect(res.text).toContain('already exists');
    });

    it('should reject registration with invalid email or short password', async () => {
      const res = await request(app)
        .post('/register')
        .set('x-test-skip-csrf', 'true')
        .send({
          name: 'A',
          email: 'invalid-email',
          password: '123'
        });

      expect(res.status).toBe(400);
      expect(res.text).toContain('Please correct the following errors');
    });
  });

  describe('Login & Logout', () => {
    beforeEach(async () => {
      await new User({
        name: 'Verified User',
        email: 'verified@example.com',
        password: 'CorrectPassword123',
        role: 'MEMBER'
      }).save();
    });

    it('should log in successfully with valid credentials and establish session', async () => {
      const agent = request.agent(app);
      const res = await agent
        .post('/login')
        .set('x-test-skip-csrf', 'true')
        .send({
          email: 'verified@example.com',
          password: 'CorrectPassword123'
        });

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/member/dashboard');

      // Check access to protected member route with the agent's cookie
      const memberRes = await agent.get('/member/dashboard');
      expect(memberRes.status).toBe(200);
      expect(memberRes.text).toContain('Member Dashboard');
    });

    it('should reject login with incorrect password', async () => {
      const res = await request(app)
        .post('/login')
        .set('x-test-skip-csrf', 'true')
        .send({
          email: 'verified@example.com',
          password: 'WrongPassword'
        });

      expect(res.status).toBe(401);
      expect(res.text).toContain('Invalid email or password');
    });

    it('should reject login with non-existent email', async () => {
      const res = await request(app)
        .post('/login')
        .set('x-test-skip-csrf', 'true')
        .send({
          email: 'nonexistent@example.com',
          password: 'SomePassword123'
        });

      expect(res.status).toBe(401);
      expect(res.text).toContain('Invalid email or password');
    });

    it('should log out successfully and destroy session', async () => {
      const agent = request.agent(app);
      await agent
        .post('/login')
        .set('x-test-skip-csrf', 'true')
        .send({
          email: 'verified@example.com',
          password: 'CorrectPassword123'
        });

      const logoutRes = await agent
        .post('/logout')
        .set('x-test-skip-csrf', 'true');

      expect(logoutRes.status).toBe(302);
      expect(logoutRes.headers.location).toBe('/login');

      // Following request to protected route should now redirect to login
      const followRes = await agent.get('/member/dashboard');
      expect(followRes.status).toBe(302);
      expect(followRes.headers.location).toContain('/login');
    });

    it('should redirect unauthenticated users accessing protected routes', async () => {
      const res = await request(app).get('/member/dashboard');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/login');
    });
  });
});
