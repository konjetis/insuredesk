/**
 * BACKEND INTEGRATION SCRIPTS — Database Layer
 *
 * These tests verify that the real pg Pool connects and the expected schema
 * is in place.  They require a real DATABASE_URL to be set.
 *
 * Skip gracefully when DATABASE_URL is absent (CI without Postgres).
 *
 * Run against Railway public URL:
 *   DATABASE_URL="postgresql://postgres:xxxx@tramway.proxy.rlwy.net:45849/railway" \
 *     npm test -- --testPathPattern=database
 */

const DATABASE_URL = process.env.DATABASE_URL;
const SKIP = !DATABASE_URL;

let pool;

beforeAll(() => {
  if (SKIP) return;
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
});

afterAll(async () => {
  if (pool) await pool.end();
});

// ── Connection ─────────────────────────────────────────────────────────────

describe('DB connection', () => {
  (SKIP ? test.skip : test)('connects and runs SELECT 1', async () => {
    const res = await pool.query('SELECT 1 AS val');
    expect(res.rows[0].val).toBe(1);
  });
});

// ── Schema: expected tables ────────────────────────────────────────────────

const REQUIRED_TABLES = ['users', 'audit_logs', 'agent_performance'];

describe('Schema integrity', () => {
  REQUIRED_TABLES.forEach(table => {
    (SKIP ? test.skip : test)(`table "${table}" exists`, async () => {
      const res = await pool.query(
        `SELECT to_regclass('public.${table}') AS tbl`
      );
      expect(res.rows[0].tbl).not.toBeNull();
    });
  });
});

// ── Users table ────────────────────────────────────────────────────────────

describe('users table', () => {
  (SKIP ? test.skip : test)('has at least one admin record', async () => {
    const res = await pool.query(`SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin'`);
    expect(parseInt(res.rows[0].cnt, 10)).toBeGreaterThanOrEqual(1);
  });

  (SKIP ? test.skip : test)('has required columns', async () => {
    const res = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users'
    `);
    const cols = res.rows.map(r => r.column_name);
    ['id', 'email', 'password_hash', 'full_name', 'role', 'is_active'].forEach(col => {
      expect(cols).toContain(col);
    });
  });

  (SKIP ? test.skip : test)('role column only contains valid values', async () => {
    const res = await pool.query(`
      SELECT DISTINCT role FROM users
      WHERE role NOT IN ('admin','manager','agent','customer')
    `);
    expect(res.rows).toHaveLength(0);
  });

  (SKIP ? test.skip : test)('all active users have hashed passwords', async () => {
    const res = await pool.query(
      `SELECT COUNT(*) AS cnt FROM users WHERE is_active = true AND (password_hash IS NULL OR password_hash = '')`
    );
    expect(parseInt(res.rows[0].cnt, 10)).toBe(0);
  });
});

// ── audit_logs table ───────────────────────────────────────────────────────

describe('audit_logs table', () => {
  (SKIP ? test.skip : test)('can insert and retrieve an audit entry', async () => {
    // Insert a test audit record
    const ins = await pool.query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (1, 'TEST_ACTION', 'integration_test', '0', '{"test":true}')
      RETURNING id
    `);
    const newId = ins.rows[0].id;
    expect(newId).toBeDefined();

    // Confirm retrieval
    const sel = await pool.query('SELECT action FROM audit_logs WHERE id = $1', [newId]);
    expect(sel.rows[0].action).toBe('TEST_ACTION');

    // Clean up
    await pool.query('DELETE FROM audit_logs WHERE id = $1', [newId]);
  });
});

// ── agent_performance table ────────────────────────────────────────────────

describe('agent_performance table', () => {
  (SKIP ? test.skip : test)('has required columns', async () => {
    const res = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'agent_performance'
    `);
    const cols = res.rows.map(r => r.column_name);
    ['user_id', 'date', 'calls_handled', 'csat_score'].forEach(col => {
      expect(cols).toContain(col);
    });
  });

  (SKIP ? test.skip : test)('csat_score is between 0 and 5', async () => {
    const res = await pool.query(`
      SELECT COUNT(*) AS cnt FROM agent_performance
      WHERE csat_score < 0 OR csat_score > 5
    `);
    expect(parseInt(res.rows[0].cnt, 10)).toBe(0);
  });
});

// ── Query performance ──────────────────────────────────────────────────────

describe('Query performance', () => {
  (SKIP ? test.skip : test)('users list query completes in under 500 ms', async () => {
    const start = Date.now();
    await pool.query('SELECT id, email, full_name, role, is_active FROM users ORDER BY created_at DESC');
    expect(Date.now() - start).toBeLessThan(500);
  });

  (SKIP ? test.skip : test)('agent performance join completes in under 500 ms', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const start = Date.now();
    await pool.query(`
      SELECT u.id, u.full_name, COALESCE(p.calls_handled, 0) AS calls_handled
      FROM users u
      LEFT JOIN agent_performance p ON p.user_id = u.id AND p.date = $1
      WHERE u.role = 'agent' AND u.is_active = true
    `, [today]);
    expect(Date.now() - start).toBeLessThan(500);
  });
});
