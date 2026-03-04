/**
 * API INTEGRATION TESTS — /api/auth
 *
 * Uses Node's built-in http module only — no supertest, no fetch polyfill.
 * Compatible with Jest 25 + Node 18+.
 * DB is mocked; no real database connection needed.
 *
 * Run: npm run test:api -- --testPathPattern=auth.api
 */

process.env.JWT_SECRET = 'test-secret-key-insuredesk';
process.env.NODE_ENV   = 'test';

const mockQuery = jest.fn();
jest.mock('../../src/config/db',     () => ({ query: mockQuery }));
jest.mock('../../src/config/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

const http    = require('http');
const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');

const authRouter = require('../../src/routes/auth');

// ── Minimal Express app ────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

// ── Server lifecycle ───────────────────────────────────────────────────────

let server, baseURL;

beforeAll(done => {
  server = http.createServer(app).listen(0, '127.0.0.1', () => {
    baseURL = `http://127.0.0.1:${server.address().port}`;
    done();
  });
});

afterAll(done => server.close(done));
beforeEach(() => mockQuery.mockReset());

// ── HTTP helper (http.request, no fetch) ───────────────────────────────────

function apiRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseURL + path);
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname, method, headers },
      res => {
        let raw = '';
        res.on('data', c => { raw += c; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
          catch (e) { resolve({ status: res.statusCode, body: raw }); }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const post = (path, body, token) => apiRequest('POST', path, body, token);
const get  = (path, token)       => apiRequest('GET',  path, null, token);

function makeToken(role = 'admin', userId = 1) {
  return jwt.sign({ userId, email: `${role}@test.com`, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

// ── POST /api/auth/login ───────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  test('400 when email missing', async () => {
    const { status, body } = await post('/api/auth/login', { password: 'any' });
    expect(status).toBe(400);
    expect(body.error).toMatch(/required/i);
  });

  test('400 when password missing', async () => {
    const { status, body } = await post('/api/auth/login', { email: 'a@b.com' });
    expect(status).toBe(400);
    expect(body.error).toMatch(/required/i);
  });

  test('401 when user does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const { status, body } = await post('/api/auth/login', { email: 'ghost@x.com', password: 'any' });
    expect(status).toBe(401);
    expect(body.error).toMatch(/invalid credentials/i);
  });

  test('401 when password is wrong', async () => {
    const hash = await bcrypt.hash('CorrectPwd@1', 10);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'admin@test.com', password_hash: hash, role: 'admin', full_name: 'Admin' }],
    });
    const { status } = await post('/api/auth/login', { email: 'admin@test.com', password: 'WrongPwd@1' });
    expect(status).toBe(401);
  });

  test('200 returns token on valid credentials', async () => {
    const hash = await bcrypt.hash('Admin@123', 10);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, email: 'admin@test.com', password_hash: hash, role: 'admin', full_name: 'Admin' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const { status, body } = await post('/api/auth/login', { email: 'admin@test.com', password: 'Admin@123' });
    expect(status).toBe(200);
    expect(body.token).toBeDefined();
    expect(body.user.role).toBe('admin');
    const decoded = jwt.verify(body.token, process.env.JWT_SECRET);
    expect(decoded.userId).toBe(1);
  });
});

// ── POST /api/auth/register ────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  const newUser = { email: 'new@test.com', password: 'NewUser@123', full_name: 'New User', role: 'agent' };

  test('401 without auth token', async () => {
    const { status } = await post('/api/auth/register', newUser);
    expect(status).toBe(401);
  });

  test('403 when caller is a customer', async () => {
    const { status } = await post('/api/auth/register', newUser, makeToken('customer'));
    expect(status).toBe(403);
  });

  test('403 when caller is an agent', async () => {
    const { status } = await post('/api/auth/register', newUser, makeToken('agent'));
    expect(status).toBe(403);
  });

  test('400 when full_name is missing', async () => {
    const { status, body } = await post('/api/auth/register',
      { email: 'x@y.com', password: 'Pwd@1234', role: 'agent' },
      makeToken('admin')
    );
    expect(status).toBe(400);
    expect(body.error).toMatch(/required/i);
  });

  test('400 when role is invalid', async () => {
    const { status, body } = await post('/api/auth/register', { ...newUser, role: 'superuser' }, makeToken('admin'));
    expect(status).toBe(400);
    expect(body.error).toMatch(/invalid role/i);
  });

  test('400 when password is too short', async () => {
    const { status, body } = await post('/api/auth/register', { ...newUser, password: 'short' }, makeToken('admin'));
    expect(status).toBe(400);
    expect(body.error).toMatch(/8 characters/i);
  });

  test('403 when non-admin tries to create admin user', async () => {
    const { status } = await post('/api/auth/register', { ...newUser, role: 'admin' }, makeToken('manager'));
    expect(status).toBe(403);
  });

  test('201 creates user successfully', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 11, email: 'new@test.com', full_name: 'New User', role: 'agent', is_active: true, created_at: new Date() }],
    });
    const { status, body } = await post('/api/auth/register', newUser, makeToken('admin'));
    expect(status).toBe(201);
    expect(body.user.email).toBe('new@test.com');
    expect(body.user.role).toBe('agent');
  });

  test('409 when email already exists', async () => {
    const err = new Error('dup'); err.code = '23505';
    mockQuery.mockRejectedValueOnce(err);
    const { status, body } = await post('/api/auth/register', newUser, makeToken('admin'));
    expect(status).toBe(409);
    expect(body.error).toMatch(/already exists/i);
  });

  test('all four valid roles accepted by admin', async () => {
    for (const role of ['agent', 'manager', 'customer', 'admin']) {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 20, email: `r_${role}@x.com`, full_name: 'X', role, is_active: true, created_at: new Date() }],
      });
      const { status } = await post('/api/auth/register', { ...newUser, role }, makeToken('admin'));
      expect(status).toBe(201);
    }
  });
});

// ── GET /api/auth/me ───────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  test('401 without auth token', async () => {
    const { status } = await get('/api/auth/me');
    expect(status).toBe(401);
  });

  test('401 when user not found in DB', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const { status, body } = await get('/api/auth/me', makeToken('admin', 1));
    expect(status).toBe(401);
    expect(body.error).toMatch(/not found|deactivated/i);
  });

  test('401 when account is deactivated', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'admin@test.com', is_active: false }],
    });
    const { status } = await get('/api/auth/me', makeToken('admin', 1));
    expect(status).toBe(401);
  });

  test('200 returns current user data', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'admin@test.com', full_name: 'Admin User', role: 'admin', is_active: true, last_login: new Date() }],
    });
    const { status, body } = await get('/api/auth/me', makeToken('admin', 1));
    expect(status).toBe(200);
    expect(body.user.email).toBe('admin@test.com');
    expect(body.user.role).toBe('admin');
  });
});
