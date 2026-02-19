const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { auth } = require('../middleware');
const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, phone, password, address } = req.body;
    if (!username || !phone || !password) {
      return res.status(400).json({ error: 'Username, phone and password are required' });
    }
    const existing = await pool.query('SELECT id FROM users WHERE phone=$1', [phone]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Phone number already registered' });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, phone, password, address) VALUES ($1,$2,$3,$4) RETURNING id, username, phone, address, role, created_at',
      [username, phone, hash, address || '']
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE phone=$1', [phone]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid credentials' });
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30d' });
    const { password: _, ...userData } = user;
    res.json({ user: userData, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get profile
router.get('/profile', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, phone, address, role, created_at FROM users WHERE id=$1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { username, address, phone } = req.body;
    const result = await pool.query(
      'UPDATE users SET username=COALESCE($1,username), address=COALESCE($2,address), phone=COALESCE($3,phone) WHERE id=$4 RETURNING id, username, phone, address, role, created_at',
      [username, address, phone, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
