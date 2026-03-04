const express = require('express');
const multer = require('multer');
const { pool } = require('../db');
const { adminAuth } = require('../middleware');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

// Serve product image as actual image (not JSON)
router.get('/image/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT image FROM products WHERE id=$1', [req.params.id]);
    if (result.rows.length === 0 || !result.rows[0].image) {
      return res.status(404).send('No image');
    }
    const dataUri = result.rows[0].image;
    // Parse data:image/jpeg;base64,XXXX
    const matches = dataUri.match(/^data:(.+);base64,(.+)$/);
    if (!matches) return res.status(404).send('Invalid image');
    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    res.set('Content-Type', mimeType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error');
  }
});

// Helper: replace base64 image with URL in product object
const addImageUrl = (product, req) => {
  if (product.image && product.image.startsWith('data:')) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    product.image_url = `${baseUrl}/api/products/image/${product.id}`;
  } else if (product.image) {
    // Old /uploads/ path - also convert to full URL
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    product.image_url = `${baseUrl}${product.image}`;
  } else {
    product.image_url = null;
  }
  // Don't send the huge base64 string to frontend
  delete product.image;
  return product;
};

// Get all products (public)
router.get('/', async (req, res) => {
  try {
    const { category, search, featured, promo } = req.query;
    let query = 'SELECT id, name, category, brand, price, stock, description, is_promo, is_featured, is_active, created_at, CASE WHEN image IS NOT NULL THEN true ELSE false END as has_image FROM products WHERE 1=1';
    const params = [];
    let i = 1;

    if (category) { query += ` AND category=$${i++}`; params.push(category); }
    if (search) { query += ` AND (LOWER(name) LIKE $${i} OR LOWER(description) LIKE $${i})`; params.push(`%${search.toLowerCase()}%`); i++; }
    if (featured === 'true') { query += ` AND is_featured=true`; }
    if (promo === 'true') { query += ` AND is_promo=true`; }

    query += ' AND is_active=true ORDER BY created_at DESC';
    const result = await pool.query(query, params);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const products = result.rows.map(p => ({
      ...p,
      image_url: p.has_image ? `${baseUrl}/api/products/image/${p.id}` : null
    }));

    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single product
router.get('/:id', async (req, res) => {
  try {
    // Don't return the raw base64 column
    const numId = parseInt(req.params.id);
    if (isNaN(numId)) return res.status(400).json({ error: 'Invalid ID' });
    
    const result = await pool.query('SELECT id, name, category, brand, price, stock, description, is_promo, is_featured, is_active, created_at, CASE WHEN image IS NOT NULL THEN true ELSE false END as has_image FROM products WHERE id=$1', [numId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const product = {
      ...result.rows[0],
      image_url: result.rows[0].has_image ? `${baseUrl}/api/products/image/${numId}` : null
    };

    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Get ALL products (including inactive)
router.get('/admin/all', adminAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, category, brand, price, stock, description, is_promo, is_featured, is_active, created_at, CASE WHEN image IS NOT NULL THEN true ELSE false END as has_image FROM products ORDER BY created_at DESC');

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const products = result.rows.map(p => ({
      ...p,
      image_url: p.has_image ? `${baseUrl}/api/products/image/${p.id}` : null
    }));

    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create product (admin)
router.post('/', adminAuth, upload.single('image'), async (req, res) => {
  try {
    const { name, category, brand, price, stock, description, is_promo, is_featured, is_active } = req.body;
    let image = null;
    if (req.file) {
      const base64 = req.file.buffer.toString('base64');
      image = `data:${req.file.mimetype};base64,${base64}`;
    }
    const result = await pool.query(
      `INSERT INTO products (name, category, brand, price, stock, description, image, is_promo, is_featured, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, name, category, brand, price, stock, description, is_promo, is_featured, is_active, created_at`,
      [name, category, brand || '', price, stock, description, image, is_promo === 'true', is_featured === 'true', is_active !== 'false']
    );

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const product = { ...result.rows[0], image_url: image ? `${baseUrl}/api/products/image/${result.rows[0].id}` : null };
    res.status(201).json(product);
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
      const base64 = req.file.buffer.toString('base64');
      const image = `data:${req.file.mimetype};base64,${base64}`;
      query = `UPDATE products SET name=$1, category=$2, brand=$3, price=$4, stock=$5, description=$6, image=$7, is_promo=$8, is_featured=$9, is_active=$10 WHERE id=$11 RETURNING id, name, category, brand, price, stock, description, is_promo, is_featured, is_active, created_at`;
      params = [name, category, brand, price, stock, description, image, is_promo === 'true', is_featured === 'true', is_active !== 'false', req.params.id];
    } else {
      query = `UPDATE products SET name=$1, category=$2, brand=$3, price=$4, stock=$5, description=$6, is_promo=$7, is_featured=$8, is_active=$9 WHERE id=$10 RETURNING id, name, category, brand, price, stock, description, is_promo, is_featured, is_active, created_at`;
      params = [name, category, brand, price, stock, description, is_promo === 'true', is_featured === 'true', is_active !== 'false', req.params.id];
    }
    const result = await pool.query(query, params);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const product = { ...result.rows[0], image_url: `${baseUrl}/api/products/image/${result.rows[0].id}` };
    res.json(product);
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
