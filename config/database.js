const { Pool } = require('pg');

// Check if we have a real database URL
const hasRealDatabase = process.env.DATABASE_URL && process.env.DATABASE_URL !== '';

let pool;
if (hasRealDatabase) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Test database connection
  pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL database');
  });

  pool.on('error', (err) => {
    console.error('❌ Database connection error:', err);
  });
} else {
  console.log('⚠️ No DATABASE_URL found - using mock database');
}

// Initialize database tables
const initDatabase = async () => {
  if (!hasRealDatabase) {
    console.log('⚠️ Skipping database initialization - using mock database');
    return;
  }

  try {
    // Create tenders table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenders (
        id SERIAL PRIMARY KEY,
        tender_id VARCHAR(100) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100) NOT NULL,
        quantity INTEGER NOT NULL,
        unit VARCHAR(50) NOT NULL,
        closing_date TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create bids table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bids (
        id SERIAL PRIMARY KEY,
        tender_id VARCHAR(100) NOT NULL,
        supplier_phone VARCHAR(20) NOT NULL,
        supplier_name VARCHAR(255),
        price DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'OMR',
        delivery_time VARCHAR(100),
        availability VARCHAR(100),
        language VARCHAR(20),
        original_message TEXT,
        transcribed_message TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tender_id) REFERENCES tenders(tender_id)
      )
    `);

    // Create suppliers table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        phone VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(255),
        email VARCHAR(255),
        categories TEXT[],
        language VARCHAR(20) DEFAULT 'English',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create notifications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        recipient VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert some sample suppliers
    await pool.query(`
      INSERT INTO suppliers (phone, name, language, is_active) 
      VALUES 
        ('whatsapp:+96811111111', 'Supplier One', 'English', true),
        ('whatsapp:+96822222222', 'Supplier Two', 'Arabic', true),
        ('whatsapp:+96833333333', 'Supplier Three', 'Hindi', true)
      ON CONFLICT (phone) DO NOTHING
    `);

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
};

module.exports = {
  pool,
  initDatabase,
  hasRealDatabase
}; 