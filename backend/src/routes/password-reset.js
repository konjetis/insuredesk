const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { Resend } = require('resend');
const pool = require('../config/db');
const logger = require('../config/logger');
const resend = new Resend(process.env.RESEND_API_KEY);
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND is_active = true', [email.toLowerCase()]);
    if (result.rows.length === 0) return res.json({ message: 'If that email exists, a reset link has been sent.' });
    const user = result.rows[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000);
    await pool.query('UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3', [resetToken, resetExpiry, user.id]);
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${resetToken}`;
    await resend.emails.send({ from: 'InsureDesk <onboarding@resend.dev>', to: user.email, subject: 'Reset your InsureDesk password', html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#0a0e1a;color:#f0f4ff;padding:40px;border-radius:16px;"><h1>Insure<span style="color:#00d4ff;">Desk</span></h1><h2>Reset Your Password</h2><p style="color:#6b7a99;">Hi ${user.full_name}, click below to reset your password.</p><a href="${resetUrl}" style="display:block;text-align:center;background:#00d4ff;color:#000;font-weight:700;padding:14px;border-radius:12px;text-decoration:none;margin:24px 0;">Reset Password</a><p style="color:#6b7a99;font-size:12px;">Expires in 1 hour.</p></div>` });
    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    logger.error('Forgot password error: ' + err.message);
    res.status(500).json({ error: 'Failed to send reset email' });
  }
});
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const result = await pool.query('SELECT * FROM users WHERE reset_token = $1 AND reset_token_expiry > NOW()', [token]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired reset link' });
    const user = result.rows[0];
    const password_hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2', [password_hash, user.id]);
    res.json({ message: 'Password reset successful! You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: 'Password reset failed' });
  }
});
module.exports = router;
