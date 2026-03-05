/**
 * UNIT TESTS — src/middleware/auth.js
 * Tests: authenticateToken, requireRole, generateToken
 * Run: npm test -- --testPathPattern=middleware.auth
 */

const jwt = require('jsonwebtoken');

// Set JWT secret before importing middleware
process.env.JWT_SECRET = 'test-secret-key-insuredesk';

const {
  authenticateToken,
  requireRole,
  generateToken,
} = require('../../src/middleware/auth');

// ── Helpers ────────────────────────────────────────────────────────────────

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq(headers = {}) {
  return { headers };
}

function validToken(payload = { userId: 1, email: 'test@test.com', role: 'admin' }) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
}

// ── authenticateToken ──────────────────────────────────────────────────────

describe('authenticateToken middleware', () => {
  test('returns 401 when no Authorization header', () => {
    const req  = mockReq({});
    const res  = mockRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Access token required' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when Authorization header has no token', () => {
    const req  = mockReq({ authorization: 'Bearer ' });
    const res  = mockRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 when token is invalid', () => {
    const req  = mockReq({ authorization: 'Bearer invalid.token.here' });
    const res  = mockRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 when token is signed with wrong secret', () => {
    const badToken = jwt.sign({ userId: 1 }, 'wrong-secret', { expiresIn: '1h' });
    const req  = mockReq({ authorization: `Bearer ${badToken}` });
    const res  = mockRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 when token is expired', () => {
    const expired = jwt.sign({ userId: 1 }, process.env.JWT_SECRET, { expiresIn: '-1s' });
    const req  = mockReq({ authorization: `Bearer ${expired}` });
    const res  = mockRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next() and attaches user on valid token', () => {
    const payload = { userId: 42, email: 'agent@insuredesk.com', role: 'agent' };
    const token   = validToken(payload);
    const req     = mockReq({ authorization: `Bearer ${token}` });
    const res     = mockRes();
    const next    = jest.fn();

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.userId).toBe(42);
    expect(req.user.role).toBe('agent');
  });
});

// ── requireRole ────────────────────────────────────────────────────────────

describe('requireRole middleware', () => {
  function reqWithRole(role) {
    return { user: { role } };
  }

  test('allows access when role matches string', () => {
    const next = jest.fn();
    requireRole('admin')(reqWithRole('admin'), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('allows access when role is in allowed array', () => {
    const next = jest.fn();
    requireRole(['admin', 'manager'])(reqWithRole('manager'), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('blocks access when role does not match', () => {
    const res  = mockRes();
    const next = jest.fn();
    requireRole('admin')(reqWithRole('agent'), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
    expect(next).not.toHaveBeenCalled();
  });

  test('blocks access when role not in array', () => {
    const res  = mockRes();
    const next = jest.fn();
    requireRole(['admin', 'manager'])(reqWithRole('customer'), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('blocks when user object is missing', () => {
    const res  = mockRes();
    const next = jest.fn();
    requireRole('admin')({}, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

// ── generateToken ─────────────────────────────────────────────────────────

describe('generateToken', () => {
  test('generates a valid decodable JWT', () => {
    const payload = { userId: 5, email: 'x@y.com', role: 'admin' };
    const token   = generateToken(payload);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    expect(decoded.userId).toBe(5);
    expect(decoded.role).toBe('admin');
  });

  test('token has expiry set', () => {
    const token   = generateToken({ userId: 1, role: 'agent' });
    const decoded = jwt.decode(token);
    expect(decoded.exp).toBeDefined();
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});

// ── authenticateSocket ────────────────────────────────────────────────────

const { authenticateSocket } = require('../../src/middleware/auth');

function mockSocket(token) {
  return { handshake: { auth: { token } } };
}

describe('authenticateSocket middleware', () => {
  test('calls next(Error) when no token provided', (done) => {
    const socket = { handshake: { auth: {} } };
    authenticateSocket(socket, (err) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toMatch(/Authentication required/i);
      done();
    });
  });

  test('calls next(Error) when token is invalid', (done) => {
    const socket = mockSocket('Bearer invalid.token.here');
    authenticateSocket(socket, (err) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toMatch(/Invalid token/i);
      done();
    });
  });

  test('calls next(Error) when token signed with wrong secret', (done) => {
    const bad = jwt.sign({ userId: 1 }, 'wrong-secret', { expiresIn: '1h' });
    const socket = mockSocket(`Bearer ${bad}`);
    authenticateSocket(socket, (err) => {
      expect(err).toBeInstanceOf(Error);
      done();
    });
  });

  test('calls next() and attaches user on valid Bearer token', (done) => {
    const token  = jwt.sign({ userId: 7, role: 'manager', name: 'Mgr' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const socket = mockSocket(`Bearer ${token}`);
    authenticateSocket(socket, (err) => {
      expect(err).toBeUndefined();
      expect(socket.user.userId).toBe(7);
      expect(socket.user.role).toBe('manager');
      done();
    });
  });

  test('accepts raw token without Bearer prefix', (done) => {
    const token  = jwt.sign({ userId: 8, role: 'agent' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const socket = mockSocket(token);   // no "Bearer " prefix
    authenticateSocket(socket, (err) => {
      expect(err).toBeUndefined();
      expect(socket.user.userId).toBe(8);
      done();
    });
  });
});
