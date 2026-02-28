const { Pool } = require('pg');
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

    // 7. Seed default admin user (password: Admin@123)
    await client.query(`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES (
        'admin@insuredesk.com',
        '$2b$10$rQnkm5eU5RyFnHkCKBgJHO8mTqZfG7xVBp5WKjKn6QxMd3YLzNpOy',
        'InsureDesk Admin',
        'admin'
      ) ON CONFLICT (email) DO NOTHING;
    `);
    console.log('✅ default admin user seeded');

    console.log('\n🎉 Database setup complete!');
    console.log('Default admin login:');
    console.log('  Email: admin@insuredesk.com');
    console.log('  Password: Admin@123');

  } catch (err) {
    console.error('❌ Database setup error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

setupDatabase();
