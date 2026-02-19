const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        phone VARCHAR(20) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        address TEXT,
        role VARCHAR(20) DEFAULT 'customer',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        brand VARCHAR(100),
        price DECIMAL(10,2) NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        description TEXT,
        image TEXT,
        is_promo BOOLEAN DEFAULT false,
        is_featured BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        items JSONB NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        address TEXT,
        phone VARCHAR(20),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS site_visits (
        id SERIAL PRIMARY KEY,
        visited_at TIMESTAMP DEFAULT NOW(),
        ip VARCHAR(50)
      );

      CREATE TABLE IF NOT EXISTS site_settings (
        id SERIAL PRIMARY KEY,
        primary_color VARCHAR(20) DEFAULT '#2d6a4f',
        secondary_color VARCHAR(20) DEFAULT '#40916c',
        accent_color VARCHAR(20) DEFAULT '#95d5b2',
        bg_color VARCHAR(20) DEFAULT '#f0fdf4',
        text_color VARCHAR(20) DEFAULT '#1b4332',
        font_family VARCHAR(100) DEFAULT 'Poppins',
        hero_title VARCHAR(255) DEFAULT 'Parapharmacie Shifa',
        hero_subtitle TEXT DEFAULT 'Votre santé, notre priorité',
        banner_image TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Insert default admin if not exists
    const adminCheck = await client.query("SELECT * FROM users WHERE role='admin' LIMIT 1");
    if (adminCheck.rows.length === 0) {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('admin123', 10);
      await client.query(
        "INSERT INTO users (username, phone, password, address, role) VALUES ($1, $2, $3, $4, $5)",
        ['Admin Shifa', '0661201294', hash, 'Tipaza, Algeria', 'admin']
      );
    }

    // Insert default settings if not exists
    const settingsCheck = await client.query("SELECT * FROM site_settings LIMIT 1");
    if (settingsCheck.rows.length === 0) {
      await client.query("INSERT INTO site_settings DEFAULT VALUES");
    }

    console.log('Database initialized successfully');
  } catch (err) {
    console.error('DB init error:', err);
  } finally {
    client.release();
  }
};

module.exports = { pool, initDB };
