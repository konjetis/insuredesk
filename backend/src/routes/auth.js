const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const logger = require('../config/logger');
const { authenticateToken: authMiddleware } = require('../middleware/auth');

// Allowed roles for self-registration (admin can only be created via db-setup)
const ALLOWED_ROLES = ['agent', 'manager', 'customer', 'admin'];

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email.toLowerCase()]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // Update last login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, name: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    logger.info('User logged in: ' + user.email);
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.full_name, role: user.role }
    });
  } catch (err) {
    logger.error('Login error: ' + err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/register (admin/manager only — requires valid JWT)
router.post('/register', authMiddleware, async (req, res) => {
  // Only admins and managers can create new users
  if (!['admin', 'manager'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Insufficient permissions to register users' });
  }
  const { email, password, full_name, role } = req.body;
  if (!email || !password || !full_name || !role) {
    return res.status(400).json({ error: 'All fields required' });
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Invalid role specified' });
  }
  // Only admins can create other admins
  if (role === 'admin' && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can create admin accounts' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  try {
    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, role`,
      [email.toLowerCase(), password_hash, full_name, role]
    );
    logger.info(`User registered: ${email} (role: ${role}) by ${req.user.email}`);
    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    logger.error('Register error: ' + err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// GET /api/auth/me (requires valid JWT)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // Fetch fresh user data from DB to ensure account is still active
    const result = await pool.query(
      'SELECT id, email, full_name, role, is_active, last_login FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(401).json({ error: 'Account not found or deactivated' });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    logger.error('Auth/me error: ' + err.message);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
