const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const SalesforceService = require('../services/salesforce');

// All routes require authentication
router.use(authenticateToken);

// GET /api/customers/:policyNumber — Full 360° customer profile
router.get('/:policyNumber', async (req, res) => {
  try {
    const sf = req.app.locals.sfService;
    const [profile, policy, claims, billing] = await Promise.all([
      sf.getCustomerProfile(req.params.policyNumber),
      sf.getPolicyDetails(req.params.policyNumber),
      sf.getClaims(req.params.policyNumber),
      sf.getBillingHistory(req.params.policyNumber)
    ]);

    if (!profile) return res.status(404).json({ error: 'Customer not found' });

    res.json({ profile, policy, claims, billing });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load customer profile' });
  }
});

module.exports = router;
