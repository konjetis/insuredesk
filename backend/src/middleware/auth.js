const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

/**
 * REST API JWT middleware
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

/**
 * Role-based access control
 * Usage: requireRole('manager') or requireRole(['manager', 'agent'])
 */
const requireRole = (roles) => (req, res, next) => {
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!allowed.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

/**
 * Socket.io authentication middleware
 * Clients must pass JWT as: socket.auth = { token: 'Bearer ...' }
 */
const authenticateSocket = (socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    logger.warn('WebSocket connection rejected: no token');
    return next(new Error('Authentication required'));
  }

  const raw = token.startsWith('Bearer ') ? token.split(' ')[1] : token;

  jwt.verify(raw, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      logger.warn('WebSocket connection rejected: invalid token');
      return next(new Error('Invalid token'));
    }
    socket.user = user; // { userId, role, name }
    next();
  });
};

/**
 * Generate a JWT token (used during login)
 */
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  });
};

module.exports = { authenticateToken, requireRole, authenticateSocket, generateToken };
