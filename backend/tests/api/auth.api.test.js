/**
 * API INTEGRATION TESTS — /api/auth
 * Uses Supertest against a real Express app with a mocked DB pool.
 * Run: npm test -- --testPathPattern=auth.api
 */

process.env.JWT_SECRET  = 'test-secret-key-insuredesk';
process.env.NODE_ENV    = 'test';

const mockQuery = jest.fn();
jest.mock('../../src/config/db',     () => ({ query: mockQuery }));
jest.mock('../../src/config/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

const bcrypt     = require('bcrypt');
const request    = require('supertest');
const express    = require('express');
const jwt        = require('jsonwebtoken');
const authRouter = require('../../src/routes/auth');

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

// ── Helpers ────────────────────────────────────────────────────────────────

function token(role = 'admin', userId = 1) {
  return jwt.sign({ userId, email: `${role}@insuredesk.com`, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

beforeEach(() => mockQuery.mockReset());

// ── POST /api/auth/login ───────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  test('400 when email or password missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'x@y.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  test('401 when user does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // no user found
    const res = await request(app).post('/api/auth/login').send({ email: 'ghost@x.com', password: 'any' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  test('401 when password is wrong', async () => {
    const hash = await bcrypt.hash('CorrectPwd@1', 10);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'admin@insuredesk.com', password_hash: hash, role: 'admin', full_name: 'Admin User' }],
    });
    // bcrypt.compare will return false for wrong password; no need to stub it
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@insuredesk.com', password: 'WrongPwd@1' });
    expect(res.status).toBe(401);
  });

  test('200 returns token on valid credentials', async () => {
    const hash = await bcrypt.hash('Admin@123', 10);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, email: 'admin@insuredesk.com', password_hash: hash, role: 'admin', full_name: 'Admin User' }] })
      .mockResolvedValueOnce({ rows: [] }) // UPDATE last_login
      .mockResolvedValueOnce({ rows: [] }); // audit log INSERT
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@insuredesk.com', password: 'Admin@123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('admin');
    // Token should be decodable
    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded.userId).toBe(1);
  });
});

// ── POST /api/auth/register ────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  const newUser = { email: 'new@insuredesk.com', password: 'NewUser@123', full_name: 'New User', role: 'agent' };

  test('401 without auth token', async () => {
    const res = await request(app).post('/api/auth/register').send(newUser);
    expect(res.status).toBe(401);
  });

  test('403 when caller is a customer', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${token('customer')}`)
      .send(newUser);
    expect(res.status).toBe(403);
  });

  test('403 when caller is an agent', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${token('agent')}`)
      .send(newUser);
    expect(res.status).toBe(403);
  });

  test('400 when required fields missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${token('admin')}`)
      .send({ email: 'x@y.com', password: 'Pwd@1234', role: 'agent' }); // missing full_name
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  test('400 when role is invalid', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${token('admin')}`)
      .send({ ...newUser, role: 'superuser' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid role/i);
  });

  test('400 when password is too short', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${token('admin')}`)
      .send({ ...newUser, password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/8 characters/i);
  });

  test('403 when non-admin tries to create admin', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${token('manager')}`)
      .send({ ...newUser, role: 'admin' });
    expect(res.status).toBe(403);
  });

  test('201 creates user successfully (admin caller)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 11, email: 'new@insuredesk.com', full_name: 'New User', role: 'agent' }],
    });
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${token('admin')}`)
      .send(newUser);
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('new@insuredesk.com');
  });

  test('409 when email already exists', async () => {
    const err = new Error('dup'); err.code = '23505';
    mockQuery.mockRejectedValueOnce(err);
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${token('admin')}`)
      .send(newUser);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });
});

// ── GET /api/auth/me ───────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  test('401 without auth token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('401 when user not found in DB', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token('admin', 1)}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/not found|deactivated/i);
  });

  test('401 when account is deactivated', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'admin@insuredesk.com', is_active: false }],
    });
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token('admin', 1)}`);
    expect(res.status).toBe(401);
  });

  test('200 returns current user data', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'admin@insuredesk.com', full_name: 'Admin User', role: 'admin', is_active: true, last_login: new Date() }],
    });
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token('admin', 1)}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('admin@insuredesk.com');
    expect(res.body.user.role).toBe('admin');
  });
});
