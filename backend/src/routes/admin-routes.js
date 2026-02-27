const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const logger = require('../config/logger');
router.use(authenticateToken);
router.use(requireRole(['admin', 'manager']));
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, full_name, role, is_active, last_login, created_at FROM users ORDER BY created_at DESC');
    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});
router.post('/users', async (req, res) => {
  const { email, password, full_name, role } = req.body;
  if (!email || !password || !full_name || !role) return res.status(400).json({ error: 'All fields required' });
  if (!['agent','manager','customer','admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  try {
    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query('INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, role, is_active, created_at', [email.toLowerCase(), password_hash, full_name, role]);
    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Failed to create user' });
  }
});
router.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { full_name, role, is_active, password } = req.body;
  try {
    if (password) {
      const password_hash = await bcrypt.hash(password, 10);
      await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [password_hash, id]);
    }
    const result = await pool.query('UPDATE users SET full_name = $1, role = $2, is_active = $3, updated_at = NOW() WHERE id = $4 RETURNING id, email, full_name, role, is_active', [full_name, role, is_active, id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.userId) return res.status(400).json({ error: 'Cannot delete your own account' });
  try {
    const result = await pool.query('UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id, email', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deactivated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});
module.exports = router;
