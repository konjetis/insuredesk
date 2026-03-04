/**
 * API INTEGRATION TESTS — /api/admin
 * Uses Supertest against a real Express app with a mocked DB pool.
 * Run: npm test -- --testPathPattern=admin.api
 */

process.env.JWT_SECRET = 'test-secret-key-insuredesk';
process.env.NODE_ENV   = 'test';

const mockQuery = jest.fn();
jest.mock('../../src/config/db',     () => ({ query: mockQuery }));
jest.mock('../../src/config/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

const request     = require('supertest');
const express     = require('express');
const jwt         = require('jsonwebtoken');
const adminRouter = require('../../src/routes/admin-routes');

const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);

// ── Helpers ────────────────────────────────────────────────────────────────

function token(role, userId = 1) {
  return jwt.sign({ userId, email: `${role}@insuredesk.com`, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

beforeEach(() => mockQuery.mockReset());

// ── GET /api/admin/users ───────────────────────────────────────────────────

describe('GET /api/admin/users', () => {
  test('401 without token', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  test('403 for agent role', async () => {
    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token('agent')}`);
    expect(res.status).toBe(403);
  });

  test('403 for customer role', async () => {
    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token('customer')}`);
    expect(res.status).toBe(403);
  });

  test('200 returns users list for admin', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 1, email: 'admin@insuredesk.com', full_name: 'Admin',      role: 'admin',   is_active: true },
        { id: 2, email: 'agent@insuredesk.com', full_name: 'Alex Jones', role: 'agent',   is_active: true },
        { id: 3, email: 'mgr@insuredesk.com',   full_name: 'Manager',    role: 'manager', is_active: true },
      ],
    });
    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token('admin')}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users).toHaveLength(3);
    expect(res.body.users[0].email).toBe('admin@insuredesk.com');
  });

  test('200 returns users list for manager', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token('manager')}`);
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(0);
  });

  test('500 on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token('admin')}`);
    expect(res.status).toBe(500);
  });
});

// ── GET /api/admin/agents ──────────────────────────────────────────────────

describe('GET /api/admin/agents', () => {
  const agentRow = {
    id: 2, full_name: 'Alex Johnson', email: 'alex@insuredesk.com', is_active: true,
    calls_handled: 24, avg_handle_time: 272, first_call_resolution: 87, csat_score: 4.8, escalations: 0,
  };

  test('200 returns agent performance data for manager', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [agentRow] });
    const res = await request(app).get('/api/admin/agents').set('Authorization', `Bearer ${token('manager')}`);
    expect(res.status).toBe(200);
    expect(res.body.agents[0].full_name).toBe('Alex Johnson');
    expect(res.body.agents[0].calls_handled).toBe(24);
    expect(res.body.agents[0].csat_score).toBe(4.8);
  });

  test('200 returns agent performance data for admin', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [agentRow] });
    const res = await request(app).get('/api/admin/agents').set('Authorization', `Bearer ${token('admin')}`);
    expect(res.status).toBe(200);
  });

  test('403 for agent role', async () => {
    const res = await request(app).get('/api/admin/agents').set('Authorization', `Bearer ${token('agent')}`);
    expect(res.status).toBe(403);
  });

  test('200 returns empty array when no agents', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/admin/agents').set('Authorization', `Bearer ${token('manager')}`);
    expect(res.status).toBe(200);
    expect(res.body.agents).toHaveLength(0);
  });
});

// ── POST /api/admin/users ──────────────────────────────────────────────────

describe('POST /api/admin/users', () => {
  const newUser = { email: 'new@insuredesk.com', password: 'NewUser@123', full_name: 'New User', role: 'agent' };

  test('400 when required fields missing', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token('admin')}`)
      .send({ email: 'x@x.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  test('400 when role is invalid', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token('admin')}`)
      .send({ ...newUser, role: 'superadmin' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid role/i);
  });

  test('201 creates user successfully', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 10, email: 'new@insuredesk.com', full_name: 'New User', role: 'agent', is_active: true, created_at: new Date() }] })
      .mockResolvedValueOnce({ rows: [] }); // audit log
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token('admin')}`)
      .send(newUser);
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('new@insuredesk.com');
    expect(res.body.user.role).toBe('agent');
  });

  test('409 when email already exists', async () => {
    const err = new Error('dup'); err.code = '23505';
    mockQuery.mockRejectedValueOnce(err);
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token('admin')}`)
      .send(newUser);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  test('403 when called by agent', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token('agent')}`)
      .send(newUser);
    expect(res.status).toBe(403);
  });

  test('validates all four valid roles are accepted', async () => {
    for (const role of ['agent', 'manager', 'customer', 'admin']) {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 20, email: `r_${role}@x.com`, full_name: 'X', role, is_active: true, created_at: new Date() }] })
        .mockResolvedValueOnce({ rows: [] }); // audit
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${token('admin')}`)
        .send({ ...newUser, role });
      expect(res.status).toBe(201);
    }
  });
});

// ── PUT /api/admin/users/:id ───────────────────────────────────────────────

describe('PUT /api/admin/users/:id', () => {
  const updatePayload = { full_name: 'Updated Name', role: 'manager', is_active: true };

  test('200 updates user name and role', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 2, email: 'a@b.com', full_name: 'Updated Name', role: 'manager', is_active: true }] })
      .mockResolvedValueOnce({ rows: [] }); // audit
    const res = await request(app)
      .put('/api/admin/users/2')
      .set('Authorization', `Bearer ${token('admin')}`)
      .send(updatePayload);
    expect(res.status).toBe(200);
    expect(res.body.user.full_name).toBe('Updated Name');
    expect(res.body.user.role).toBe('manager');
  });

  test('404 when user does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .put('/api/admin/users/9999')
      .set('Authorization', `Bearer ${token('admin')}`)
      .send(updatePayload);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  test('403 when called by agent', async () => {
    const res = await request(app)
      .put('/api/admin/users/2')
      .set('Authorization', `Bearer ${token('agent')}`)
      .send(updatePayload);
    expect(res.status).toBe(403);
  });

  test('200 allows deactivating a user', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 5, email: 'x@y.com', full_name: 'X', role: 'agent', is_active: false }] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .put('/api/admin/users/5')
      .set('Authorization', `Bearer ${token('admin')}`)
      .send({ ...updatePayload, is_active: false });
    expect(res.status).toBe(200);
    expect(res.body.user.is_active).toBe(false);
  });
});

// ── DELETE /api/admin/users/:id ────────────────────────────────────────────

describe('DELETE /api/admin/users/:id', () => {
  test('200 deactivates a user', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 3, email: 'bye@x.com' }] })
      .mockResolvedValueOnce({ rows: [] }); // audit
    const res = await request(app)
      .delete('/api/admin/users/3')
      .set('Authorization', `Bearer ${token('admin', 1)}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deactivated/i);
  });

  test('400 when admin tries to delete their own account', async () => {
    const res = await request(app)
      .delete('/api/admin/users/1')
      .set('Authorization', `Bearer ${token('admin', 1)}`); // userId 1 = same as target
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/own account/i);
  });

  test('404 when user not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .delete('/api/admin/users/999')
      .set('Authorization', `Bearer ${token('admin', 1)}`);
    expect(res.status).toBe(404);
  });

  test('403 when called by agent', async () => {
    const res = await request(app)
      .delete('/api/admin/users/5')
      .set('Authorization', `Bearer ${token('agent', 99)}`);
    expect(res.status).toBe(403);
  });
});
