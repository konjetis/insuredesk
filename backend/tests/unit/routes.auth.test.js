/**
 * UNIT TESTS — src/routes/auth.js
 * All DB and external calls are mocked — no real DB needed.
 * Run: npm test -- --testPathPattern=routes.auth
 */

process.env.JWT_SECRET   = 'test-secret-key-insuredesk';
process.env.NODE_ENV     = 'test';

const bcrypt = require('bcrypt');

// ── Mock pg pool ───────────────────────────────────────────────────────────
const mockQuery = jest.fn();
jest.mock('../../src/config/db', () => ({ query: mockQuery }));

// ── Mock logger (suppress noise) ──────────────────────────────────────────
jest.mock('../../src/config/logger', () => ({
  info:  jest.fn(),
  error: jest.fn(),
  warn:  jest.fn(),
}));

const express    = require('express');
const authRouter = require('../../src/routes/auth');

// Minimal Express app for testing
const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

// We use a lightweight HTTP test helper (http.request)
const http    = require('http');
const server  = http.createServer(app);

let base;
beforeAll(done => { server.listen(0, () => { base = `http://localhost:${server.address().port}`; done(); }); });
afterAll(done  => { server.close(done); });
beforeEach(()  => { mockQuery.mockReset(); });

async function post(path, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req  = http.request(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw || '{}') }));
    });
    req.write(data);
    req.end();
  });
}

async function get(path, token) {
  return new Promise((resolve) => {
    const req = http.request(`${base}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw || '{}') }));
    });
    req.end();
  });
}

// ── POST /api/auth/login ───────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  test('400 when email missing', async () => {
    const res = await post('/api/auth/login', { password: 'pass' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  test('400 when password missing', async () => {
    const res = await post('/api/auth/login', { email: 'test@test.com' });
    expect(res.status).toBe(400);
  });

  test('401 when user not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // no user found
    const res = await post('/api/auth/login', { email: 'x@x.com', password: 'pass' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  test('401 when password is wrong', async () => {
    const hash = await bcrypt.hash('correctpass', 10);
    mockQuery.mockResolvedValueOnce({ rows: [{ id:1, email:'a@b.com', password_hash: hash, role:'agent', full_name:'Test' }] });
    const res = await post('/api/auth/login', { email: 'a@b.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  test('200 with token on valid credentials', async () => {
    const hash = await bcrypt.hash('Agent@123', 10);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id:1, email:'agent@insuredesk.com', password_hash: hash, role:'agent', full_name:'Alex Johnson' }] })
      .mockResolvedValueOnce({ rows: [] })   // UPDATE last_login
      .mockResolvedValueOnce({ rows: [] });  // audit log INSERT

    const res = await post('/api/auth/login', { email: 'agent@insuredesk.com', password: 'Agent@123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('agent');
    expect(res.body.user.email).toBe('agent@insuredesk.com');
  });
});

// ── POST /api/auth/register ───────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  const jwt = require('jsonwebtoken');
  function adminToken() { return jwt.sign({ userId:1, role:'admin', email:'admin@insuredesk.com' }, process.env.JWT_SECRET, { expiresIn:'1h' }); }
  function agentToken()  { return jwt.sign({ userId:2, role:'agent',  email:'agent@insuredesk.com'  }, process.env.JWT_SECRET, { expiresIn:'1h' }); }

  async function postAuth(body, token) {
    return new Promise((resolve) => {
      const data = JSON.stringify(body);
      const req  = http.request(`${base}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Content-Length': Buffer.byteLength(data), 'Authorization': `Bearer ${token}` }
      }, (res) => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw || '{}') }));
      });
      req.write(data);
      req.end();
    });
  }

  test('403 when called without a token', async () => {
    const res = await post('/api/auth/register', { email:'x@x.com', password:'Test@123', full_name:'X', role:'agent' });
    expect(res.status).toBe(401);
  });

  test('403 when called by agent role', async () => {
    const res = await postAuth({ email:'x@x.com', password:'Test@123', full_name:'X', role:'agent' }, agentToken());
    expect(res.status).toBe(403);
  });

  test('400 when required fields missing', async () => {
    const res = await postAuth({ email:'x@x.com' }, adminToken());
    expect(res.status).toBe(400);
  });

  test('400 when role is invalid', async () => {
    const res = await postAuth({ email:'x@x.com', password:'Test@123', full_name:'X', role:'superuser' }, adminToken());
    expect(res.status).toBe(400);
  });

  test('400 when password shorter than 8 chars', async () => {
    const res = await postAuth({ email:'x@x.com', password:'short', full_name:'X', role:'agent' }, adminToken());
    expect(res.status).toBe(400);
  });

  test('409 when email already exists', async () => {
    const err  = new Error('duplicate'); err.code = '23505';
    mockQuery.mockRejectedValueOnce(err);
    const res = await postAuth({ email:'taken@x.com', password:'Test@123', full_name:'X', role:'agent' }, adminToken());
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  test('201 on successful registration by admin', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id:99, email:'new@x.com', full_name:'New User', role:'agent' }] });
    const res = await postAuth({ email:'new@x.com', password:'Test@123', full_name:'New User', role:'agent' }, adminToken());
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('new@x.com');
  });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  const jwt = require('jsonwebtoken');
  function token(id) { return jwt.sign({ userId:id, role:'agent' }, process.env.JWT_SECRET, { expiresIn:'1h' }); }

  test('401 when no token', async () => {
    const res = await get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('401 when user not found in DB', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await get('/api/auth/me', token(999));
    expect(res.status).toBe(401);
  });

  test('200 returns user data on valid token', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id:1, email:'a@b.com', full_name:'Agent A', role:'agent', is_active:true }] });
    const res = await get('/api/auth/me', token(1));
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('a@b.com');
  });
});

// ── DB error paths (500 responses) ────────────────────────────────────────

describe('DB error handling — 500 responses', () => {
  const jwt = require('jsonwebtoken');
  function adminToken() {
    return jwt.sign({ userId:1, role:'admin', email:'admin@x.com' }, process.env.JWT_SECRET, { expiresIn:'1h' });
  }

  async function postWithToken(path, body, tok) {
    return new Promise((resolve) => {
      const data = JSON.stringify(body);
      const r = http.request(`${base}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type':'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...(tok ? { 'Authorization': `Bearer ${tok}` } : {})
        }
      }, (res) => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw || '{}') }));
      });
      r.write(data);
      r.end();
    });
  }

  test('POST /api/auth/login returns 500 on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB down'));
    const res = await post('/api/auth/login', { email: 'x@x.com', password: 'pass' });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Login failed/i);
  });

  test('POST /api/auth/register returns 500 on unexpected DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB exploded'));
    const res = await postWithToken('/api/auth/register',
      { email:'z@x.com', password:'Test@1234', full_name:'Z', role:'agent' },
      adminToken()
    );
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Registration failed/i);
  });

  test('GET /api/auth/me returns 500 on DB error', async () => {
    const tok = jwt.sign({ userId:1, role:'agent' }, process.env.JWT_SECRET, { expiresIn:'1h' });
    mockQuery.mockRejectedValueOnce(new Error('DB down'));
    const res = await get('/api/auth/me', tok);
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Failed to fetch user/i);
  });
});
