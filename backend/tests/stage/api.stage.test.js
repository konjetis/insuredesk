/**
 * STAGE ENVIRONMENT — Live API Tests
 *
 * Hits the real Stage deployment with real HTTP requests.
 * No mocking. Tests actual auth, users CRUD, agent scorecard,
 * health endpoint, and role-based access control.
 *
 * Prerequisites:
 *   1. Stage backend must be deployed and running
 *   2. db-setup.js must have been run against Stage DB
 *      (so demo users exist)
 *
 * Required env vars:
 *   STAGE_API_URL        — e.g. https://insuredesk-stage.up.railway.app
 *   STAGE_ADMIN_EMAIL    — admin@insuredesk.com
 *   STAGE_ADMIN_PASSWORD — Admin@123
 *
 * Optional env vars (for role-specific tests):
 *   STAGE_AGENT_EMAIL    — alex@insuredesk.com
 *   STAGE_AGENT_PASSWORD — Agent@123
 *   STAGE_MGR_EMAIL      — sarah.manager@insuredesk.com
 *   STAGE_MGR_PASSWORD   — Manager@123
 *
 * Run:
 *   npm run test:stage
 */

const http  = require('http');
const https = require('https');

// ── Config ─────────────────────────────────────────────────────────────────

const BASE = (process.env.STAGE_API_URL || 'https://insuredesk-production.up.railway.app').replace(/\/$/, '');

const ADMIN_EMAIL    = process.env.STAGE_ADMIN_EMAIL    || 'admin@insuredesk.com';
const ADMIN_PASSWORD = process.env.STAGE_ADMIN_PASSWORD || 'Admin@123';
const AGENT_EMAIL    = process.env.STAGE_AGENT_EMAIL    || 'alex.johnson@insuredesk.com';
const AGENT_PASSWORD = process.env.STAGE_AGENT_PASSWORD || 'Agent@123';
const MGR_EMAIL      = process.env.STAGE_MGR_EMAIL      || 'jennifer.w@insuredesk.com';
const MGR_PASSWORD   = process.env.STAGE_MGR_PASSWORD   || 'Manager@123';

console.log(`\n🔗 Stage API: ${BASE}\n`);

// ── HTTP helper ────────────────────────────────────────────────────────────

function apiRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const lib = url.protocol === 'https:' ? https : http;
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    if (token)   headers['Authorization']  = `Bearer ${token}`;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = lib.request(
      { hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + (url.search || ''), method, headers },
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

const get  = (path, token)       => apiRequest('GET',    path, null, token);
const post = (path, body, token) => apiRequest('POST',   path, body, token);
const put  = (path, body, token) => apiRequest('PUT',    path, body, token);
const del  = (path, token)       => apiRequest('DELETE', path, null, token);

// ── Token cache (login once per role per suite run) ────────────────────────

const tokenCache = {};

async function getToken(email, password) {
  if (tokenCache[email]) return tokenCache[email];
  const { status, body } = await post('/api/auth/login', { email, password });
  if (status !== 200) throw new Error(`Login failed for ${email}: ${JSON.stringify(body)}`);
  tokenCache[email] = body.token;
  return body.token;
}

// ── GET /health ────────────────────────────────────────────────────────────

describe('GET /health', () => {
  test('returns 200 and status "ok"', async () => {
    const { status, body } = await get('/health');
    expect(status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
    expect(body.version).toBeDefined();
  });
});

// ── POST /api/auth/login ───────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  test('400 when email is missing', async () => {
    const { status, body } = await post('/api/auth/login', { password: 'x' });
    expect(status).toBe(400);
    expect(body.error).toMatch(/required/i);
  });

  test('401 when credentials are wrong', async () => {
    const { status } = await post('/api/auth/login', { email: 'ghost@stage.com', password: 'wrong' });
    expect(status).toBe(401);
  });

  test('200 returns token and user for admin', async () => {
    const { status, body } = await post('/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    expect(status).toBe(200);
    expect(body.token).toBeDefined();
    expect(body.token.split('.').length).toBe(3); // valid JWT structure
    expect(body.user.role).toBe('admin');
    expect(body.user.email).toBe(ADMIN_EMAIL);
  });

  test('200 returns token for agent', async () => {
    const { status, body } = await post('/api/auth/login', { email: AGENT_EMAIL, password: AGENT_PASSWORD });
    expect(status).toBe(200);
    expect(body.user.role).toBe('agent');
  });

  test('200 returns token for manager', async () => {
    const { status, body } = await post('/api/auth/login', { email: MGR_EMAIL, password: MGR_PASSWORD });
    expect(status).toBe(200);
    expect(body.user.role).toBe('manager');
  });
});

// ── GET /api/auth/me ───────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  test('401 without token', async () => {
    const { status } = await get('/api/auth/me');
    expect(status).toBe(401);
  });

  test('200 returns correct admin profile', async () => {
    const token = await getToken(ADMIN_EMAIL, ADMIN_PASSWORD);
    const { status, body } = await get('/api/auth/me', token);
    expect(status).toBe(200);
    expect(body.user.email).toBe(ADMIN_EMAIL);
    expect(body.user.role).toBe('admin');
    expect(body.user.is_active).toBe(true);
  });

  test('200 returns correct agent profile', async () => {
    const token = await getToken(AGENT_EMAIL, AGENT_PASSWORD);
    const { status, body } = await get('/api/auth/me', token);
    expect(status).toBe(200);
    expect(body.user.role).toBe('agent');
  });
});

// ── GET /api/admin/users ───────────────────────────────────────────────────

describe('GET /api/admin/users', () => {
  test('401 without token', async () => {
    const { status } = await get('/api/admin/users');
    expect(status).toBe(401);
  });

  test('403 for agent role', async () => {
    const token = await getToken(AGENT_EMAIL, AGENT_PASSWORD);
    const { status } = await get('/api/admin/users', token);
    expect(status).toBe(403);
  });

  test('200 returns users array for admin', async () => {
    const token = await getToken(ADMIN_EMAIL, ADMIN_PASSWORD);
    const { status, body } = await get('/api/admin/users', token);
    expect(status).toBe(200);
    expect(Array.isArray(body.users)).toBe(true);
    expect(body.users.length).toBeGreaterThanOrEqual(1);
    // Verify expected fields
    const u = body.users[0];
    expect(u).toHaveProperty('id');
    expect(u).toHaveProperty('email');
    expect(u).toHaveProperty('role');
    expect(u).toHaveProperty('is_active');
    // Password hash must never be exposed
    expect(u.password_hash).toBeUndefined();
  });

  test('admin user is present in the list', async () => {
    const token = await getToken(ADMIN_EMAIL, ADMIN_PASSWORD);
    const { body } = await get('/api/admin/users', token);
    const admin = body.users.find(u => u.email === ADMIN_EMAIL);
    expect(admin).toBeDefined();
    expect(admin.role).toBe('admin');
  });

  test('at least one agent is present', async () => {
    const token = await getToken(ADMIN_EMAIL, ADMIN_PASSWORD);
    const { body } = await get('/api/admin/users', token);
    const agents = body.users.filter(u => u.role === 'agent');
    expect(agents.length).toBeGreaterThanOrEqual(1);
  });
});

// ── GET /api/admin/agents ──────────────────────────────────────────────────

describe('GET /api/admin/agents', () => {
  test('403 for agent role', async () => {
    const token = await getToken(AGENT_EMAIL, AGENT_PASSWORD);
    const { status } = await get('/api/admin/agents', token);
    expect(status).toBe(403);
  });

  test('200 returns agent scorecard for manager', async () => {
    const token = await getToken(MGR_EMAIL, MGR_PASSWORD);
    const { status, body } = await get('/api/admin/agents', token);
    expect(status).toBe(200);
    expect(Array.isArray(body.agents)).toBe(true);
    if (body.agents.length > 0) {
      const a = body.agents[0];
      expect(a).toHaveProperty('id');
      expect(a).toHaveProperty('full_name');
      expect(a).toHaveProperty('calls_handled');
      expect(a).toHaveProperty('csat_score');
    }
  });

  test('200 returns agent scorecard for admin', async () => {
    const token = await getToken(ADMIN_EMAIL, ADMIN_PASSWORD);
    const { status, body } = await get('/api/admin/agents', token);
    expect(status).toBe(200);
    expect(Array.isArray(body.agents)).toBe(true);
  });
});

// ── POST /api/admin/users (create) ────────────────────────────────────────

describe('POST /api/admin/users — create & cleanup', () => {
  const testEmail = `stage_test_${Date.now()}@insuredesk-stage.com`;
  let createdId   = null;

  test('403 for agent role', async () => {
    const token = await getToken(AGENT_EMAIL, AGENT_PASSWORD);
    const { status } = await post('/api/admin/users',
      { email: testEmail, password: 'StageTest@123', full_name: 'Stage Test', role: 'agent' },
      token
    );
    expect(status).toBe(403);
  });

  test('400 when required fields missing', async () => {
    const token = await getToken(ADMIN_EMAIL, ADMIN_PASSWORD);
    const { status, body } = await post('/api/admin/users', { email: testEmail }, token);
    expect(status).toBe(400);
    expect(body.error).toMatch(/required/i);
  });

  test('201 admin can create a new agent', async () => {
    const token = await getToken(ADMIN_EMAIL, ADMIN_PASSWORD);
    const { status, body } = await post('/api/admin/users',
      { email: testEmail, password: 'StageTest@123', full_name: 'Stage Test User', role: 'agent' },
      token
    );
    expect(status).toBe(201);
    expect(body.user.email).toBe(testEmail);
    expect(body.user.role).toBe('agent');
    createdId = body.user.id;
  });

  test('409 on duplicate email', async () => {
    if (!createdId) { return; } // skip if create failed
    const token = await getToken(ADMIN_EMAIL, ADMIN_PASSWORD);
    const { status, body } = await post('/api/admin/users',
      { email: testEmail, password: 'StageTest@123', full_name: 'Dup User', role: 'agent' },
      token
    );
    expect(status).toBe(409);
    expect(body.error).toMatch(/already exists/i);
  });

  // Cleanup — permanently delete the test user so it doesn't accumulate in the DB
  afterAll(async () => {
    if (!createdId) return;
    try {
      const token = await getToken(ADMIN_EMAIL, ADMIN_PASSWORD);
      await del(`/api/admin/users/${createdId}?permanent=true`, token);
    } catch (e) { /* ignore cleanup errors */ }
  });
});

// ── PUT /api/admin/users/:id (update) ────────────────────────────────────

describe('PUT /api/admin/users/:id', () => {
  test('401 without token', async () => {
    const { status } = await put('/api/admin/users/999', { full_name: 'X' });
    expect(status).toBe(401);
  });

  test('403 for agent role', async () => {
    const token = await getToken(AGENT_EMAIL, AGENT_PASSWORD);
    const { status } = await put('/api/admin/users/999', { full_name: 'X' }, token);
    expect(status).toBe(403);
  });

  test('404 for non-existent user', async () => {
    const token = await getToken(ADMIN_EMAIL, ADMIN_PASSWORD);
    const { status, body } = await put('/api/admin/users/999999',
      { full_name: 'Ghost', role: 'agent', is_active: true },
      token
    );
    expect(status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });
});

// ── DELETE /api/admin/users/:id ───────────────────────────────────────────

describe('DELETE /api/admin/users/:id — soft deactivate', () => {
  test('401 without token', async () => {
    const { status } = await del('/api/admin/users/999');
    expect(status).toBe(401);
  });

  test('403 for agent role', async () => {
    const token = await getToken(AGENT_EMAIL, AGENT_PASSWORD);
    const { status } = await del('/api/admin/users/999', token);
    expect(status).toBe(403);
  });

  test('404 for non-existent user', async () => {
    const token = await getToken(ADMIN_EMAIL, ADMIN_PASSWORD);
    const { status } = await del('/api/admin/users/999999', token);
    expect(status).toBe(404);
  });
});

describe('DELETE /api/admin/users/:id?permanent=true — hard delete', () => {
  const permEmail = `stage_perm_${Date.now()}@insuredesk-stage.com`;
  let permId = null;

  beforeAll(async () => {
    // Create a throwaway user to hard-delete
    const token = await getToken(ADMIN_EMAIL, ADMIN_PASSWORD);
    const { status, body } = await post('/api/admin/users',
      { email: permEmail, password: 'StageTest@123', full_name: 'Perm Delete Test', role: 'agent' },
      token
    );
    if (status === 201) permId = body.user.id;
  });

  test('401 without token', async () => {
    const { status } = await del('/api/admin/users/999?permanent=true');
    expect(status).toBe(401);
  });

  test('403 for agent role', async () => {
    const token = await getToken(AGENT_EMAIL, AGENT_PASSWORD);
    const { status } = await del('/api/admin/users/999?permanent=true', token);
    expect(status).toBe(403);
  });

  test('404 for non-existent user', async () => {
    const token = await getToken(ADMIN_EMAIL, ADMIN_PASSWORD);
    const { status } = await del('/api/admin/users/999999?permanent=true', token);
    expect(status).toBe(404);
  });

  test('200 admin can permanently delete a user', async () => {
    if (!permId) return;
    const token = await getToken(ADMIN_EMAIL, ADMIN_PASSWORD);
    const { status, body } = await del(`/api/admin/users/${permId}?permanent=true`, token);
    expect(status).toBe(200);
    expect(body.message).toMatch(/permanently deleted/i);
  });

  test('404 on re-delete confirms user is truly gone', async () => {
    if (!permId) return;
    const token = await getToken(ADMIN_EMAIL, ADMIN_PASSWORD);
    const { status } = await del(`/api/admin/users/${permId}?permanent=true`, token);
    expect(status).toBe(404);
  });

  afterAll(async () => {
    // Safety cleanup in case the delete test failed
    if (!permId) return;
    try {
      const token = await getToken(ADMIN_EMAIL, ADMIN_PASSWORD);
      await del(`/api/admin/users/${permId}?permanent=true`, token);
    } catch (e) { /* ignore */ }
  });
});

// ── Audit log populates on login ───────────────────────────────────────────

describe('Audit log (indirect verification)', () => {
  test('admin can still login after multiple logins (no lockout)', async () => {
    // Login 3 times quickly — should not get rate-limited or locked out
    for (let i = 0; i < 3; i++) {
      const { status } = await post('/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
      expect(status).toBe(200);
    }
  });
});
