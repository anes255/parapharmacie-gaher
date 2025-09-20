const express = require('express');
const router = express.Router();

console.log('🔧 DEBUG: Starting to load orders.js file...');

// Absolute minimal test route - no dependencies at all
router.get('/test', (req, res) => {
    console.log('🔧 DEBUG: Test route accessed successfully');
    res.json({ 
        message: 'Orders test route working',
        timestamp: new Date().toISOString(),
        success: true
    });
});

console.log('🔧 DEBUG: Test route defined');

// Test basic GET route without any auth or models
router.get('/', (req, res) => {
    console.log('🔧 DEBUG: Basic GET route accessed');
    res.json({
        message: 'Basic orders route working',
        orders: [],
        note: 'No authentication or models loaded yet'
    });
});

console.log('🔧 DEBUG: Basic GET route defined');

// Test if we can load auth middleware
let authLoaded = false;
try {
    console.log('🔧 DEBUG: Attempting to load auth middleware...');
    const auth = require('../middleware/auth');
    authLoaded = true;
    console.log('🔧 DEBUG: ✅ Auth middleware loaded successfully');
    
    // Add route with auth
    router.get('/with-auth', auth, (req, res) => {
        console.log('🔧 DEBUG: Auth route accessed, user:', req.user);
        res.json({
            message: 'Auth route working',
            user: req.user,
            hasAuth: true
        });
    });
    
} catch (error) {
    console.error('🔧 DEBUG: ❌ Failed to load auth middleware:', error.message);
    console.error('🔧 DEBUG: Auth error details:', error);
}

// Test if we can load Order model
let orderModelLoaded = false;
try {
    console.log('🔧 DEBUG: Attempting to load Order model...');
    const Order = require('../models/Order');
    orderModelLoaded = true;
    console.log('🔧 DEBUG: ✅ Order model loaded successfully');
} catch (error) {
    console.error('🔧 DEBUG: ❌ Failed to load Order model:', error.message);
    console.error('🔧 DEBUG: Order model error details:', error);
}

// Test if we can load User model
let userModelLoaded = false;
try {
    console.log('🔧 DEBUG: Attempting to load User model...');
    const User = require('../models/User');
    userModelLoaded = true;
    console.log('🔧 DEBUG: ✅ User model loaded successfully');
} catch (error) {
    console.error('🔧 DEBUG: ❌ Failed to load User model:', error.message);
    console.error('🔧 DEBUG: User model error details:', error);
}

// Status route to check what loaded
router.get('/debug-status', (req, res) => {
    console.log('🔧 DEBUG: Status route accessed');
    res.json({
        message: 'Debug status',
        authLoaded: authLoaded,
        orderModelLoaded: orderModelLoaded,
        userModelLoaded: userModelLoaded,
        timestamp: new Date().toISOString()
    });
});

console.log('🔧 DEBUG: ✅ Orders.js file completed loading');
console.log('🔧 DEBUG: Auth loaded:', authLoaded);
console.log('🔧 DEBUG: Order model loaded:', orderModelLoaded);
console.log('🔧 DEBUG: User model loaded:', userModelLoaded);

module.exports = router;
