/**
 * UNIT TESTS — src/routes/admin-routes.js
 * All DB calls mocked — no real database needed.
 * Run: npm test -- --testPathPattern=routes.admin
 */

process.env.JWT_SECRET = 'test-secret-key-insuredesk';
process.env.NODE_ENV   = 'test';

const mockQuery = jest.fn();
jest.mock('../../src/config/db', () => ({ query: mockQuery }));
jest.mock('../../src/config/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

const express     = require('express');
const jwt         = require('jsonwebtoken');
const adminRouter = require('../../src/routes/admin-routes');

const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);

const http   = require('http');
const server = http.createServer(app);

let base;
beforeAll(done => { server.listen(0, () => { base = `http://localhost:${server.address().port}`; done(); }); });
afterAll(done  => { server.close(done); });
beforeEach(()  => { mockQuery.mockReset(); });

// ── Token helpers ──────────────────────────────────────────────────────────
function makeToken(role, userId = 1) {
  return jwt.sign({ userId, email: `${role}@insuredesk.com`, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

// ── HTTP helpers ───────────────────────────────────────────────────────────
async function req(method, path, token, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const r = http.request(`${base}${path}`, opts, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw || '{}') }));
    });
    if (data) r.write(data);
    r.end();
  });
}

// ── GET /api/admin/users ──────────────────────────────────────────────────

describe('GET /api/admin/users', () => {
  test('401 without token', async () => {
    const res = await req('GET', '/api/admin/users', '');
    expect(res.status).toBe(401);
  });

  test('403 when role is agent', async () => {
    const res = await req('GET', '/api/admin/users', makeToken('agent'));
    expect(res.status).toBe(403);
  });

  test('403 when role is customer', async () => {
    const res = await req('GET', '/api/admin/users', makeToken('customer'));
    expect(res.status).toBe(403);
  });

  test('200 returns users list for admin', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [
      { id:1, email:'admin@insuredesk.com', full_name:'Admin', role:'admin', is_active:true },
      { id:2, email:'agent@insuredesk.com', full_name:'Alex',  role:'agent', is_active:true },
    ]});
    const res = await req('GET', '/api/admin/users', makeToken('admin'));
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(2);
  });

  test('200 returns users list for manager', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await req('GET', '/api/admin/users', makeToken('manager'));
    expect(res.status).toBe(200);
  });
});

// ── GET /api/admin/agents ─────────────────────────────────────────────────

describe('GET /api/admin/agents', () => {
  test('200 returns agent performance data', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [
      { id:2, full_name:'Alex Johnson', email:'alex@insuredesk.com', is_active:true,
        calls_handled:24, avg_handle_time:272, first_call_resolution:87, csat_score:4.8, escalations:0 }
    ]});
    const res = await req('GET', '/api/admin/agents', makeToken('manager'));
    expect(res.status).toBe(200);
    expect(res.body.agents[0].full_name).toBe('Alex Johnson');
    expect(res.body.agents[0].calls_handled).toBe(24);
  });

  test('403 when role is agent', async () => {
    const res = await req('GET', '/api/admin/agents', makeToken('agent'));
    expect(res.status).toBe(403);
  });
});

// ── POST /api/admin/users ─────────────────────────────────────────────────

describe('POST /api/admin/users', () => {
  const newUser = { email:'new@insuredesk.com', password:'NewUser@123', full_name:'New User', role:'agent' };

  test('400 when fields missing', async () => {
    const res = await req('POST', '/api/admin/users', makeToken('admin'), { email:'x@x.com' });
    expect(res.status).toBe(400);
  });

  test('400 when role is invalid', async () => {
    const res = await req('POST', '/api/admin/users', makeToken('admin'), { ...newUser, role:'superuser' });
    expect(res.status).toBe(400);
  });

  test('201 creates user successfully', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id:10, email:'new@insuredesk.com', full_name:'New User', role:'agent', is_active:true, created_at: new Date() }] })
      .mockResolvedValueOnce({ rows: [] }); // audit log
    const res = await req('POST', '/api/admin/users', makeToken('admin'), newUser);
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('new@insuredesk.com');
  });

  test('409 when email already exists', async () => {
    const err = new Error('dup'); err.code = '23505';
    mockQuery.mockRejectedValueOnce(err);
    const res = await req('POST', '/api/admin/users', makeToken('admin'), newUser);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });
});

// ── PUT /api/admin/users/:id ──────────────────────────────────────────────

describe('PUT /api/admin/users/:id', () => {
  test('200 updates user name and role', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id:2, email:'a@b.com', full_name:'Updated', role:'manager', is_active:true }] })
      .mockResolvedValueOnce({ rows: [] }); // audit
    const res = await req('PUT', '/api/admin/users/2', makeToken('admin'), { full_name:'Updated', role:'manager', is_active:true });
    expect(res.status).toBe(200);
    expect(res.body.user.full_name).toBe('Updated');
  });

  test('404 when user does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await req('PUT', '/api/admin/users/9999', makeToken('admin'), { full_name:'X', role:'agent', is_active:true });
    expect(res.status).toBe(404);
  });

  test('403 when called by agent', async () => {
    const res = await req('PUT', '/api/admin/users/2', makeToken('agent'), { full_name:'X', role:'agent', is_active:true });
    expect(res.status).toBe(403);
  });
});

// ── DELETE /api/admin/users/:id ───────────────────────────────────────────

describe('DELETE /api/admin/users/:id', () => {
  test('200 deactivates user', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id:3, email:'bye@x.com' }] })
      .mockResolvedValueOnce({ rows: [] }); // audit
    const res = await req('DELETE', '/api/admin/users/3', makeToken('admin', 1));
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deactivated/i);
  });

  test('400 when admin tries to delete themselves', async () => {
    const res = await req('DELETE', '/api/admin/users/1', makeToken('admin', 1)); // same userId
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/own account/i);
  });

  test('404 when user not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await req('DELETE', '/api/admin/users/999', makeToken('admin', 1));
    expect(res.status).toBe(404);
  });
});

// ── DB error paths (500 responses) ────────────────────────────────────────

describe('DB error handling — 500 responses', () => {
  test('GET /api/admin/agents returns 500 on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB timeout'));
    const res = await req('GET', '/api/admin/agents', makeToken('admin'));
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Failed to fetch agent performance/i);
  });

  test('POST /api/admin/users returns 500 on unexpected DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('unexpected'));
    const res = await req('POST', '/api/admin/users', makeToken('admin'), {
      email: 'x@x.com', password: 'Test@1234', full_name: 'X', role: 'agent'
    });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Failed to create user/i);
  });

  test('PUT /api/admin/users/:id returns 500 on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('connection lost'));
    const res = await req('PUT', '/api/admin/users/2', makeToken('admin'), {
      full_name: 'X', role: 'agent', is_active: true
    });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Failed to update user/i);
  });

  test('DELETE /api/admin/users/:id returns 500 on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('connection lost'));
    const res = await req('DELETE', '/api/admin/users/5', makeToken('admin', 1));
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Failed to delete user/i);
  });
});

// ── PUT with password update ───────────────────────────────────────────────

describe('PUT /api/admin/users/:id — password change', () => {
  test('200 updates user with new password', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })   // UPDATE password_hash
      .mockResolvedValueOnce({ rows: [{ id:2, email:'a@b.com', full_name:'User', role:'agent', is_active:true }] })
      .mockResolvedValueOnce({ rows: [] });   // audit
    const res = await req('PUT', '/api/admin/users/2', makeToken('admin'), {
      full_name: 'User', role: 'agent', is_active: true, password: 'NewPass@123'
    });
    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledTimes(3);
  });
});
