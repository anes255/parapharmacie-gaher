const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// CORS configuration
app.use(cors({
    origin: '*',
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
}));

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check
app.get('/', (req, res) => {
    res.json({
        message: 'Debug Server Running',
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        message: 'API is healthy',
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// Connect to MongoDB
async function connectDB() {
    try {
        if (!process.env.MONGODB_URI) {
            console.log('⚠️ No MONGODB_URI found, using default');
            process.env.MONGODB_URI = 'mongodb://localhost:27017/parapharmacie';
        }
        
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB connected');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
    }
}

// Load routes with error handling
console.log('📦 Loading routes...');

try {
    const authRoutes = require('./routes/auth');
    app.use('/api/auth', authRoutes);
    console.log('✅ Auth routes loaded');
} catch (error) {
    console.error('❌ Auth routes failed:', error.message);
    
    // Create fallback auth routes
    const authFallback = express.Router();
    authFallback.post('/login', (req, res) => {
        res.status(500).json({ 
            error: 'Auth routes not loaded',
            message: error.message 
        });
    });
    app.use('/api/auth', authFallback);
}

try {
    const productRoutes = require('./routes/products');
    app.use('/api/products', productRoutes);
    console.log('✅ Product routes loaded');
} catch (error) {
    console.error('❌ Product routes failed:', error.message);
    
    const productFallback = express.Router();
    productFallback.get('/', (req, res) => {
        res.status(500).json({ 
            error: 'Product routes not loaded',
            message: error.message 
        });
    });
    app.use('/api/products', productFallback);
}

try {
    const adminRoutes = require('./routes/admin');
    app.use('/api/admin', adminRoutes);
    console.log('✅ Admin routes loaded');
} catch (error) {
    console.error('❌ Admin routes failed:', error.message);
    
    const adminFallback = express.Router();
    adminFallback.get('/dashboard', (req, res) => {
        res.status(500).json({ 
            error: 'Admin routes not loaded',
            message: error.message 
        });
    });
    adminFallback.get('/orders', (req, res) => {
        res.status(500).json({ 
            error: 'Admin routes not loaded',
            message: error.message 
        });
    });
    app.use('/api/admin', adminFallback);
}

try {
    const orderRoutes = require('./routes/orders');
    app.use('/api/orders', orderRoutes);
    console.log('✅ Order routes loaded');
} catch (error) {
    console.error('❌ Order routes failed:', error.message);
}

try {
    const settingsRoutes = require('./routes/settings');
    app.use('/api/settings', settingsRoutes);
    console.log('✅ Settings routes loaded');
} catch (error) {
    console.error('❌ Settings routes failed:', error.message);
}

// Load debug routes
try {
    const authDebugRoutes = require('./routes/auth-debug');
    app.use('/api/debug', authDebugRoutes);
    console.log('✅ Debug routes loaded');
} catch (error) {
    console.error('❌ Debug routes failed:', error.message);
    
    // Create inline debug routes
    const debugRouter = express.Router();
    
    debugRouter.get('/status', (req, res) => {
        res.json({
            message: 'Debug endpoint working',
            timestamp: new Date().toISOString(),
            database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
            env: {
                nodeEnv: process.env.NODE_ENV,
                mongoUri: process.env.MONGODB_URI ? 'Set' : 'Not set',
                jwtSecret: process.env.JWT_SECRET ? 'Set' : 'Not set'
            }
        });
    });
    
    debugRouter.get('/admin', async (req, res) => {
        try {
            const User = require('./models/User');
            const admin = await User.findOne({ email: 'pharmaciegaher@gmail.com' });
            
            res.json({
                adminExists: !!admin,
                admin: admin ? {
                    email: admin.email,
                    role: admin.role,
                    actif: admin.actif
                } : null
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    app.use('/api/debug', debugRouter);
    console.log('✅ Inline debug routes created');
}

// Error handling
app.use((error, req, res, next) => {
    console.error('🚨 Server error:', error);
    res.status(500).json({
        message: 'Server error',
        error: error.message,
        path: req.path
    });
});

// 404 handler
app.use('*', (req, res) => {
    console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
    
    res.status(404).json({
        message: 'Route not found',
        path: req.originalUrl,
        method: req.method,
        availableRoutes: [
            'GET /',
            'GET /api/health',
            'GET /api/debug/status',
            'GET /api/debug/admin',
            'POST /api/auth/login',
            'GET /api/products',
            'GET /api/admin/dashboard',
            'GET /api/admin/orders'
        ]
    });
});

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
    console.log('🚀 Debug server started!');
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`🔗 Test URLs:`);
    console.log(`   - http://localhost:${PORT}/`);
    console.log(`   - http://localhost:${PORT}/api/health`);
    console.log(`   - http://localhost:${PORT}/api/debug/status`);
    console.log(`   - http://localhost:${PORT}/api/debug/admin`);
    
    // Connect to database after server starts
    await connectDB();
});

module.exports = app;
