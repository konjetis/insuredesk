const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/agents/performance — Agent scorecards (managers only)
router.get('/performance', requireRole('manager'), async (req, res) => {
  try {
    const zd = req.app.locals.zdService;
    const [agents, csatData] = await Promise.all([
      zd.getAgentPerformance(),
      zd.getCSATScores()
    ]);
    res.json({ agents, csat: csatData });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch agent performance' });
  }
});

module.exports = router;
