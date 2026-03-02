const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupDatabase() {
  const client = await pool.connect();
  try {
    console.log('Connected to PostgreSQL...');

    // 1. USERS TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('agent', 'manager', 'customer', 'admin')),
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ users table created');

    // 2. AUDIT LOGS TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action VARCHAR(255) NOT NULL,
        entity_type VARCHAR(100),
        entity_id VARCHAR(255),
        details JSONB,
        ip_address VARCHAR(50),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ audit_logs table created');

    // 3. SALESFORCE CACHE TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS sf_cache (
        id SERIAL PRIMARY KEY,
        cache_key VARCHAR(255) UNIQUE NOT NULL,
        data JSONB NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ sf_cache table created');

    // 4. ZENDESK CACHE TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS zd_cache (
        id SERIAL PRIMARY KEY,
        cache_key VARCHAR(255) UNIQUE NOT NULL,
        data JSONB NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ zd_cache table created');

    // 5. AGENT PERFORMANCE TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_performance (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        date DATE NOT NULL,
        calls_handled INTEGER DEFAULT 0,
        avg_handle_time INTEGER DEFAULT 0,
        first_call_resolution DECIMAL(5,2) DEFAULT 0,
        csat_score DECIMAL(3,2) DEFAULT 0,
        escalations INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, date)
      );
    `);
    console.log('✅ agent_performance table created');

    // 6. INDEXES for performance
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sf_cache_expires ON sf_cache(expires_at);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_zd_cache_expires ON zd_cache(expires_at);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_agent_perf_date ON agent_performance(date);`);
    console.log('✅ indexes created');

    // 7. Seed all demo users with hashed passwords
    const adminHash    = await bcrypt.hash('Admin@123',   10);
    const agentHash    = await bcrypt.hash('Agent@123',   10);
    const managerHash  = await bcrypt.hash('Manager@123', 10);
    const customerHash = await bcrypt.hash('Customer@123',10);

    const seedUsers = [
      { email: 'admin@insuredesk.com',    hash: adminHash,    name: 'InsureDesk Admin',  role: 'admin'    },
      { email: 'alex.johnson@insuredesk.com',   hash: agentHash,  name: 'Alex Johnson',  role: 'agent'   },
      { email: 'maria.chen@insuredesk.com',     hash: agentHash,  name: 'Maria Chen',    role: 'agent'   },
      { email: 'ryan.scott@insuredesk.com',     hash: agentHash,  name: 'Ryan Scott',    role: 'agent'   },
      { email: 'priya.nair@insuredesk.com',     hash: agentHash,  name: 'Priya Nair',    role: 'agent'   },
      { email: 'jake.miller@insuredesk.com',    hash: agentHash,  name: 'Jake Miller',   role: 'agent'   },
      { email: 'sofia.torres@insuredesk.com',   hash: agentHash,  name: 'Sofia Torres',  role: 'agent'   },
      { email: 'jennifer.w@insuredesk.com',     hash: managerHash,name: 'Jennifer Williams', role: 'manager' },
      { email: 'tom.baker@insuredesk.com',      hash: managerHash,name: 'Tom Baker',     role: 'manager'  },
      { email: 'sarah.anderson@customer.com',   hash: customerHash, name: 'Sarah Anderson', role: 'customer' },
      { email: 'marcus.roberts@customer.com',   hash: customerHash, name: 'Marcus Roberts', role: 'customer' },
      { email: 'lisa.park@customer.com',        hash: customerHash, name: 'Lisa Park',      role: 'customer' },
      { email: 'david.kim@customer.com',        hash: customerHash, name: 'David Kim',       role: 'customer' },
    ];

    for (const u of seedUsers) {
      await client.query(
        `INSERT INTO users (email, password_hash, full_name, role)
         VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING`,
        [u.email, u.hash, u.name, u.role]
      );
    }
    console.log('✅ demo users seeded (admin, 6 agents, 2 managers, 4 customers)');

    // 8. Seed agent_performance for today
    const today = new Date().toISOString().slice(0, 10);
    const perfData = [
      { email: 'alex.johnson@insuredesk.com',  calls: 24, aht: 272, fcr: 87.0, csat: 4.8, esc: 0 },
      { email: 'maria.chen@insuredesk.com',    calls: 19, aht: 310, fcr: 82.0, csat: 4.5, esc: 1 },
      { email: 'ryan.scott@insuredesk.com',    calls: 16, aht: 382, fcr: 71.0, csat: 3.8, esc: 2 },
      { email: 'priya.nair@insuredesk.com',    calls: 21, aht: 288, fcr: 85.0, csat: 4.6, esc: 0 },
      { email: 'jake.miller@insuredesk.com',   calls: 11, aht: 434, fcr: 64.0, csat: 3.2, esc: 3 },
      { email: 'sofia.torres@insuredesk.com',  calls: 22, aht: 295, fcr: 83.0, csat: 4.7, esc: 0 },
    ];
    for (const p of perfData) {
      const userRes = await client.query('SELECT id FROM users WHERE email=$1', [p.email]);
      if (userRes.rows.length > 0) {
        await client.query(
          `INSERT INTO agent_performance (user_id, date, calls_handled, avg_handle_time, first_call_resolution, csat_score, escalations)
           VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (user_id, date) DO NOTHING`,
          [userRes.rows[0].id, today, p.calls, p.aht, p.fcr, p.csat, p.esc]
        );
      }
    }
    console.log('✅ agent performance data seeded');

    console.log('\n🎉 Database setup complete!');
    console.log('Login credentials:');
    console.log('  Admin:    admin@insuredesk.com       / Admin@123');
    console.log('  Agent:    alex.johnson@insuredesk.com / Agent@123');
    console.log('  Manager:  jennifer.w@insuredesk.com  / Manager@123');
    console.log('  Customer: sarah.anderson@customer.com / Customer@123');

  } catch (err) {
    console.error('❌ Database setup error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

setupDatabase();
