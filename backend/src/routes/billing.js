const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/billing/:policyId — Billing history
router.get('/:policyId', async (req, res) => {
  try {
    const sf = req.app.locals.sfService;
    const billing = await sf.getBillingHistory(req.params.policyId);
    res.json({ billing });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch billing data' });
  }
});

module.exports = router;
