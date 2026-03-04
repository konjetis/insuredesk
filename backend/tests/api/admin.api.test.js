/**
 * API INTEGRATION TESTS — /api/admin
 *
 * Uses Node's built-in http + fetch (Node 18+) — no supertest required.
 * DB is mocked; no real database connection needed.
 *
 * Run: npm run test:api -- --testPathPattern=admin.api
 */

process.env.JWT_SECRET = 'test-secret-key-insuredesk';
process.env.NODE_ENV   = 'test';

const mockQuery = jest.fn();
jest.mock('../../src/config/db',     () => ({ query: mockQuery }));
jest.mock('../../src/config/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

const http    = require('http');
const express = require('express');
const jwt     = require('jsonwebtoken');

const adminRouter = require('../../src/routes/admin-routes');

// ── Minimal Express app ────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);

// ── Server lifecycle ───────────────────────────────────────────────────────

let server, baseURL;

beforeAll(done => {
  server = http.createServer(app).listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    baseURL = `http://127.0.0.1:${port}`;
    done();
  });
});

afterAll(done => server.close(done));
beforeEach(() => mockQuery.mockReset());

// ── Helpers ────────────────────────────────────────────────────────────────

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${baseURL}${path}`, opts);
  return { status: res.status, body: await res.json() };
}

const get  = (path, token)       => req('GET',    path, null, token);
const post = (path, body, token) => req('POST',   path, body, token);
const put  = (path, body, token) => req('PUT',    path, body, token);
const del  = (path, token)       => req('DELETE', path, null, token);

function makeToken(role, userId = 1) {
  return jwt.sign({ userId, email: `${role}@test.com`, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

// ── GET /api/admin/users ───────────────────────────────────────────────────

describe('GET /api/admin/users', () => {
  test('401 without token', async () => {
    const { status } = await get('/api/admin/users');
    expect(status).toBe(401);
  });

  test('403 for agent role', async () => {
    const { status } = await get('/api/admin/users', makeToken('agent'));
    expect(status).toBe(403);
  });

  test('403 for customer role', async () => {
    const { status } = await get('/api/admin/users', makeToken('customer'));
    expect(status).toBe(403);
  });

  test('200 returns users array for admin', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 1, email: 'admin@test.com',   full_name: 'Admin',   role: 'admin',   is_active: true },
        { id: 2, email: 'agent@test.com',   full_name: 'Agent',   role: 'agent',   is_active: true },
        { id: 3, email: 'manager@test.com', full_name: 'Manager', role: 'manager', is_active: true },
      ],
    });
    const { status, body } = await get('/api/admin/users', makeToken('admin'));
    expect(status).toBe(200);
    expect(Array.isArray(body.users)).toBe(true);
    expect(body.users).toHaveLength(3);
  });

  test('200 returns users array for manager', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const { status, body } = await get('/api/admin/users', makeToken('manager'));
    expect(status).toBe(200);
    expect(body.users).toHaveLength(0);
  });

  test('500 on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB down'));
    const { status } = await get('/api/admin/users', makeToken('admin'));
    expect(status).toBe(500);
  });
});

// ── GET /api/admin/agents ──────────────────────────────────────────────────

describe('GET /api/admin/agents', () => {
  const agentRow = {
    id: 2, full_name: 'Alex Johnson', email: 'alex@test.com', is_active: true,
    calls_handled: 24, avg_handle_time: 272, first_call_resolution: 87, csat_score: 4.8, escalations: 0,
  };

  test('200 returns agent performance data for manager', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [agentRow] });
    const { status, body } = await get('/api/admin/agents', makeToken('manager'));
    expect(status).toBe(200);
    expect(body.agents[0].full_name).toBe('Alex Johnson');
    expect(body.agents[0].csat_score).toBe(4.8);
  });

  test('200 returns agent performance data for admin', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [agentRow] });
    const { status } = await get('/api/admin/agents', makeToken('admin'));
    expect(status).toBe(200);
  });

  test('403 for agent role', async () => {
    const { status } = await get('/api/admin/agents', makeToken('agent'));
    expect(status).toBe(403);
  });

  test('200 returns empty array when no agents', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const { status, body } = await get('/api/admin/agents', makeToken('manager'));
    expect(status).toBe(200);
    expect(body.agents).toHaveLength(0);
  });
});

// ── POST /api/admin/users ──────────────────────────────────────────────────

describe('POST /api/admin/users', () => {
  const newUser = { email: 'new@test.com', password: 'NewUser@123', full_name: 'New User', role: 'agent' };

  test('401 without token', async () => {
    const { status } = await post('/api/admin/users', newUser);
    expect(status).toBe(401);
  });

  test('403 for agent role', async () => {
    const { status } = await post('/api/admin/users', newUser, makeToken('agent'));
    expect(status).toBe(403);
  });

  test('400 when required fields missing', async () => {
    const { status, body } = await post('/api/admin/users', { email: 'x@x.com' }, makeToken('admin'));
    expect(status).toBe(400);
    expect(body.error).toMatch(/required/i);
  });

  test('400 when role is invalid', async () => {
    const { status, body } = await post('/api/admin/users', { ...newUser, role: 'superadmin' }, makeToken('admin'));
    expect(status).toBe(400);
    expect(body.error).toMatch(/invalid role/i);
  });

  test('201 creates user successfully', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 10, email: 'new@test.com', full_name: 'New User', role: 'agent', is_active: true, created_at: new Date() }] })
      .mockResolvedValueOnce({ rows: [] }); // audit log
    const { status, body } = await post('/api/admin/users', newUser, makeToken('admin'));
    expect(status).toBe(201);
    expect(body.user.email).toBe('new@test.com');
    expect(body.user.role).toBe('agent');
  });

  test('409 when email already exists', async () => {
    const err = new Error('dup'); err.code = '23505';
    mockQuery.mockRejectedValueOnce(err);
    const { status, body } = await post('/api/admin/users', newUser, makeToken('admin'));
    expect(status).toBe(409);
    expect(body.error).toMatch(/already exists/i);
  });

  test('all four valid roles accepted', async () => {
    for (const role of ['agent', 'manager', 'customer', 'admin']) {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 20, email: `r_${role}@x.com`, full_name: 'X', role, is_active: true, created_at: new Date() }] })
        .mockResolvedValueOnce({ rows: [] });
      const { status } = await post('/api/admin/users', { ...newUser, role }, makeToken('admin'));
      expect(status).toBe(201);
    }
  });
});

// ── PUT /api/admin/users/:id ───────────────────────────────────────────────

describe('PUT /api/admin/users/:id', () => {
  const updatePayload = { full_name: 'Updated Name', role: 'manager', is_active: true };

  test('401 without token', async () => {
    const { status } = await put('/api/admin/users/2', updatePayload);
    expect(status).toBe(401);
  });

  test('403 for agent role', async () => {
    const { status } = await put('/api/admin/users/2', updatePayload, makeToken('agent'));
    expect(status).toBe(403);
  });

  test('200 updates user successfully', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 2, email: 'a@b.com', full_name: 'Updated Name', role: 'manager', is_active: true }] })
      .mockResolvedValueOnce({ rows: [] }); // audit
    const { status, body } = await put('/api/admin/users/2', updatePayload, makeToken('admin'));
    expect(status).toBe(200);
    expect(body.user.full_name).toBe('Updated Name');
    expect(body.user.role).toBe('manager');
  });

  test('404 when user does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const { status, body } = await put('/api/admin/users/9999', updatePayload, makeToken('admin'));
    expect(status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  test('200 allows deactivating a user (is_active: false)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 5, email: 'x@y.com', full_name: 'X', role: 'agent', is_active: false }] })
      .mockResolvedValueOnce({ rows: [] });
    const { status, body } = await put('/api/admin/users/5', { ...updatePayload, is_active: false }, makeToken('admin'));
    expect(status).toBe(200);
    expect(body.user.is_active).toBe(false);
  });
});

// ── DELETE /api/admin/users/:id ────────────────────────────────────────────

describe('DELETE /api/admin/users/:id', () => {
  test('401 without token', async () => {
    const { status } = await del('/api/admin/users/3');
    expect(status).toBe(401);
  });

  test('403 for agent role', async () => {
    const { status } = await del('/api/admin/users/5', makeToken('agent', 99));
    expect(status).toBe(403);
  });

  test('400 when admin deletes own account', async () => {
    const { status, body } = await del('/api/admin/users/1', makeToken('admin', 1));
    expect(status).toBe(400);
    expect(body.error).toMatch(/own account/i);
  });

  test('404 when user not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const { status } = await del('/api/admin/users/999', makeToken('admin', 1));
    expect(status).toBe(404);
  });

  test('200 deactivates a user successfully', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 3, email: 'bye@test.com' }] })
      .mockResolvedValueOnce({ rows: [] }); // audit
    const { status, body } = await del('/api/admin/users/3', makeToken('admin', 1));
    expect(status).toBe(200);
    expect(body.message).toMatch(/deactivated/i);
  });
});
