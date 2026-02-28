const pool = require('../config/db');

const auditLog = (action, entityType) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = async (data) => {
      // Only log successful responses
      if (res.statusCode < 400) {
        try {
          await pool.query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              req.user?.userId || null,
              action,
              entityType || null,
              req.params?.id || req.params?.policyNumber || null,
              JSON.stringify({ method: req.method, path: req.path }),
              req.ip,
              req.get('user-agent') || null
            ]
          );
        } catch (err) {
          console.error('Audit log error:', err.message);
        }
      }
      return originalJson(data);
    };
    next();
  };
};

module.exports = auditLog;
