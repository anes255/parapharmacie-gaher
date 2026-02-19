const express = require('express');
const multer = require('multer');
const path = require('path');
const { pool } = require('./db');
const { adminAuth } = require('./middleware');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } });

// Get all products (public)
router.get('/', async (req, res) => {
  try {
    const { category, search, featured, promo } = req.query;
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];
    let i = 1;

    if (category) { query += ` AND category=$${i++}`; params.push(category); }
    if (search) { query += ` AND (LOWER(name) LIKE $${i} OR LOWER(description) LIKE $${i})`; params.push(`%${search.toLowerCase()}%`); i++; }
    if (featured === 'true') { query += ` AND is_featured=true`; }
    if (promo === 'true') { query += ` AND is_promo=true`; }

    query += ' AND is_active=true ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single product
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id=$1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Get ALL products (including inactive)
router.get('/admin/all', adminAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create product (admin)
router.post('/', adminAuth, upload.single('image'), async (req, res) => {
  try {
    const { name, category, brand, price, stock, description, is_promo, is_featured, is_active } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    const result = await pool.query(
      `INSERT INTO products (name, category, brand, price, stock, description, image, is_promo, is_featured, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [name, category, brand || '', price, stock, description, image, is_promo === 'true', is_featured === 'true', is_active !== 'false']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update product (admin)
router.put('/:id', adminAuth, upload.single('image'), async (req, res) => {
  try {
    const { name, category, brand, price, stock, description, is_promo, is_featured, is_active } = req.body;
    let query, params;
    if (req.file) {
      const image = `/uploads/${req.file.filename}`;
      query = `UPDATE products SET name=$1, category=$2, brand=$3, price=$4, stock=$5, description=$6, image=$7, is_promo=$8, is_featured=$9, is_active=$10 WHERE id=$11 RETURNING *`;
      params = [name, category, brand, price, stock, description, image, is_promo === 'true', is_featured === 'true', is_active !== 'false', req.params.id];
    } else {
      query = `UPDATE products SET name=$1, category=$2, brand=$3, price=$4, stock=$5, description=$6, is_promo=$7, is_featured=$8, is_active=$9 WHERE id=$10 RETURNING *`;
      params = [name, category, brand, price, stock, description, is_promo === 'true', is_featured === 'true', is_active !== 'false', req.params.id];
    }
    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete product (admin)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
