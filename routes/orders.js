const express = require('express');
const { pool } = require('./db');
const { auth, adminAuth } = require('./middleware');
const router = express.Router();

// Create order
router.post('/', auth, async (req, res) => {
  try {
    const { items, total, address, phone, notes } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ error: 'Cart is empty' });
    
    // Update stock
    for (const item of items) {
      const prod = await pool.query('SELECT stock FROM products WHERE id=$1', [item.id]);
      if (prod.rows.length === 0) return res.status(400).json({ error: `Product ${item.name} not found` });
      if (prod.rows[0].stock < item.quantity) return res.status(400).json({ error: `Insufficient stock for ${item.name}` });
      await pool.query('UPDATE products SET stock = stock - $1 WHERE id=$2', [item.quantity, item.id]);
    }

    const result = await pool.query(
      'INSERT INTO orders (user_id, items, total, address, phone, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [req.user.id, JSON.stringify(items), total, address, phone, notes || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user orders
router.get('/my', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: get all orders
router.get('/admin/all', adminAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.*, u.username, u.phone as user_phone 
      FROM orders o 
      LEFT JOIN users u ON o.user_id = u.id 
      ORDER BY o.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: update order status
router.put('/:id/status', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const result = await pool.query('UPDATE orders SET status=$1 WHERE id=$2 RETURNING *', [status, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: delete order
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM orders WHERE id=$1', [req.params.id]);
    res.json({ message: 'Order deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
