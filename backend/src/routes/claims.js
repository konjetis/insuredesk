// ── claims.js ──────────────────────────────
const express = require('express');
const claimsRouter = express.Router();
const { authenticateToken } = require('../middleware/auth');

claimsRouter.use(authenticateToken);

claimsRouter.get('/:policyId', async (req, res) => {
  try {
    const sf = req.app.locals.sfService;
    const claims = await sf.getClaims(req.params.policyId);
    res.json({ claims });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

module.exports = claimsRouter;
