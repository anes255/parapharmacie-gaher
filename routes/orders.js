const express = require('express');
const router = express.Router();

// Test route first - no dependencies
router.get('/test', (req, res) => {
    console.log('📦 Orders test route accessed');
    res.json({ 
        message: 'Orders route is working',
        timestamp: new Date().toISOString()
    });
});

// Basic GET route without auth for testing
router.get('/', (req, res) => {
    console.log('📦 Basic orders route accessed - no auth');
    res.json({
        message: 'Orders endpoint accessible',
        orders: [],
        note: 'This is a test response without authentication'
    });
});

console.log('📦 Orders routes file loaded successfully');
module.exports = router;
