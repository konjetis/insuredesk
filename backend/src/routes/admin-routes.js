const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const logger = require('../config/logger');
router.use(authenticateToken);
router.use(requireRole(['admin', 'manager']));

// Helper: write to audit_logs (fire-and-forget — never blocks the response)
async function audit(userId, action, entityType, entityId, details, req) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [userId, action, entityType, entityId ? String(entityId) : null,
       JSON.stringify(details), req.ip, req.get('user-agent') || null]
    );
  } catch (e) { /* audit failure must never break the main response */ }
}
// GET /api/admin/agents — agents list with today's performance stats
router.get('/agents', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const result = await pool.query(`
      SELECT
        u.id, u.full_name, u.email, u.is_active,
        COALESCE(p.calls_handled, 0)          AS calls_handled,
        COALESCE(p.avg_handle_time, 0)        AS avg_handle_time,
        COALESCE(p.first_call_resolution, 0)  AS first_call_resolution,
        COALESCE(p.csat_score, 0)             AS csat_score,
        COALESCE(p.escalations, 0)            AS escalations
      FROM users u
      LEFT JOIN agent_performance p
        ON p.user_id = u.id AND p.date = $1
      WHERE u.role = 'agent' AND u.is_active = true
      ORDER BY u.full_name ASC
    `, [today]);
    res.json({ agents: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch agent performance' });
  }
});

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
    audit(req.user.userId, 'CREATE_USER', 'user', result.rows[0].id, { email, full_name, role }, req);
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
    audit(req.user.userId, 'UPDATE_USER', 'user', id, { full_name, role, is_active, password_changed: !!password }, req);
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
    audit(req.user.userId, 'DEACTIVATE_USER', 'user', id, { email: result.rows[0].email }, req);
    res.json({ message: 'User deactivated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});
module.exports = router;
