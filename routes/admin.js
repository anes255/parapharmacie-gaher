const express = require('express');
const { pool } = require('../db');
const { adminAuth } = require('../middleware');
const router = express.Router();

// Dashboard stats
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const users = await pool.query('SELECT COUNT(*) FROM users WHERE role=$1', ['customer']);
    const orders = await pool.query('SELECT COUNT(*) FROM orders');
    const revenue = await pool.query('SELECT COALESCE(SUM(total),0) as total FROM orders WHERE status=$1', ['confirmed']);
    const products = await pool.query('SELECT COUNT(*) FROM products');
    const visits = await pool.query('SELECT COUNT(*) FROM site_visits');
    const pendingOrders = await pool.query("SELECT COUNT(*) FROM orders WHERE status='pending'");
    const recentOrders = await pool.query(`
      SELECT o.*, u.username FROM orders o 
      LEFT JOIN users u ON o.user_id = u.id 
      ORDER BY o.created_at DESC LIMIT 5
    `);
    const topProducts = await pool.query('SELECT * FROM products WHERE is_featured=true LIMIT 5');
    
    // Monthly orders for chart
    const monthlyOrders = await pool.query(`
      SELECT DATE_TRUNC('month', created_at) as month, COUNT(*) as count, SUM(total) as revenue
      FROM orders GROUP BY month ORDER BY month DESC LIMIT 6
    `);

    res.json({
      totalUsers: parseInt(users.rows[0].count),
      totalOrders: parseInt(orders.rows[0].count),
      totalRevenue: parseFloat(revenue.rows[0].total),
      totalProducts: parseInt(products.rows[0].count),
      totalVisits: parseInt(visits.rows[0].count),
      pendingOrders: parseInt(pendingOrders.rows[0].count),
      recentOrders: recentOrders.rows,
      topProducts: topProducts.rows,
      monthlyOrders: monthlyOrders.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all users
router.get('/users', adminAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, phone, address, role, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete user
router.delete('/users/:id', adminAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id=$1 AND role != $2', [req.params.id, 'admin']);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get site settings
router.get('/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM site_settings LIMIT 1');
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update site settings
router.put('/settings', adminAuth, async (req, res) => {
  try {
    const { primary_color, secondary_color, accent_color, bg_color, text_color, font_family, hero_title, hero_subtitle } = req.body;
    const result = await pool.query(
      `UPDATE site_settings SET 
        primary_color=COALESCE($1,primary_color), 
        secondary_color=COALESCE($2,secondary_color),
        accent_color=COALESCE($3,accent_color),
        bg_color=COALESCE($4,bg_color),
        text_color=COALESCE($5,text_color),
        font_family=COALESCE($6,font_family),
        hero_title=COALESCE($7,hero_title),
        hero_subtitle=COALESCE($8,hero_subtitle),
        updated_at=NOW()
      WHERE id=1 RETURNING *`,
      [primary_color, secondary_color, accent_color, bg_color, text_color, font_family, hero_title, hero_subtitle]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Track visit
router.post('/visit', async (req, res) => {
  try {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    await pool.query('INSERT INTO site_visits (ip) VALUES ($1)', [ip]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
