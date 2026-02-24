const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/calls/queue — Live call queue
router.get('/queue', async (req, res) => {
  try {
    const zd = req.app.locals.zdService;
    const stats = await zd.getQueueStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch queue stats' });
  }
});

// POST /api/calls/webhook — Zendesk webhook receiver
router.post('/webhook', async (req, res) => {
  try {
    const { event, payload } = req.body;
    const zd = req.app.locals.zdService;
    await zd.processWebhook(event, payload);
    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
