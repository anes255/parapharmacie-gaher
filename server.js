const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// ========================================
// CONFIGURATION
// ========================================

const CONFIG = {
    PORT: process.env.PORT || 5000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    MONGODB_URI: process.env.MONGODB_URI,
    JWT_SECRET: process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024'
};

// ========================================
// MIDDLEWARE CONFIGURATION
// ========================================

// CORS - Must be FIRST
app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        const allowed = [
            'http://localhost:3000',
            'http://localhost:3001', 
            'http://localhost:5173',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001',
            'http://127.0.0.1:5173',
            'https://parapharmacieshifa.com',
            'http://parapharmacieshifa.com'
        ];
        
        if (allowed.includes(origin) || origin.includes('localhost')) {
            callback(null, true);
        } else {
            callback(null, true); // Allow anyway for now
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    
    // Log body for POST/PUT requests (excluding sensitive data)
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.path !== '/api/auth/login') {
        console.log('Body:', JSON.stringify(req.body, null, 2).slice(0, 200));
    }
    
    next();
});

// ========================================
// MODELS - LOAD ALL MODELS FIRST
// ========================================

console.log('\n📦 Loading Models...');

// Load models
const Product = require('./models/Product');
const Order = require('./models/Order');
const User = require('./models/User');

console.log('✅ Product Model loaded');
console.log('✅ Order Model loaded');
console.log('✅ User Model loaded');

// Export models for global access if needed
global.Models = { Product, Order, User };

console.log('✅ All models loaded successfully\n');

// ========================================
// BASIC ROUTES
// ========================================

app.get('/', (req, res) => {
    res.json({
        message: 'Shifa Parapharmacie API',
        status: 'running',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
            health: '/api/health',
            auth: '/api/auth',
            products: '/api/products',
            orders: '/api/orders',
            admin: '/api/admin',
            settings: '/api/settings',
            seo: '/api/sitemap.xml'
        }
    });
});

app.get('/api/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: dbStatus,
        environment: CONFIG.NODE_ENV,
        uptime: process.uptime(),
        memory: process.memoryUsage()
    };
    
    console.log('🏥 Health check:', dbStatus);
    
    res.json(healthStatus);
});

// ========================================
// API ROUTES - LOAD ALL ROUTES
// ========================================

console.log('🔌 Loading API Routes...\n');

// Auth routes
try {
    const authRoutes = require('./routes/auth');
    app.use('/api/auth', authRoutes);
    console.log('✅ Auth routes loaded: /api/auth');
} catch (error) {
    console.error('❌ Failed to load auth routes:', error.message);
}

// Product routes  
try {
    const productRoutes = require('./routes/products');
    app.use('/api/products', productRoutes);
    console.log('✅ Product routes loaded: /api/products');
} catch (error) {
    console.error('❌ Failed to load product routes:', error.message);
}

// Order routes
try {
    const orderRoutes = require('./routes/orders');
    app.use('/api/orders', orderRoutes);
    console.log('✅ Order routes loaded: /api/orders');
} catch (error) {
    console.error('❌ Failed to load order routes:', error.message);
}

// Admin routes
try {
    const adminRoutes = require('./routes/admin');
    app.use('/api/admin', adminRoutes);
    console.log('✅ Admin routes loaded: /api/admin');
} catch (error) {
    console.error('❌ Failed to load admin routes:', error.message);
}

// Settings routes
try {
    const settingsRoutes = require('./routes/settings');
    app.use('/api/settings', settingsRoutes);
    console.log('✅ Settings routes loaded: /api/settings');
} catch (error) {
    console.log('ℹ️  Settings routes not found (optional)');
}

// SEO routes (sitemap and robots.txt)
try {
    const sitemapRoutes = require('./routes/sitemap');
    app.use('/api', sitemapRoutes);
    console.log('✅ SEO routes loaded: /api/sitemap.xml, /api/robots.txt');
} catch (error) {
    console.log('ℹ️  SEO routes not found (optional)');
}

console.log('\n✅ All routes loaded successfully\n');

// ========================================
// ERROR HANDLING - MUST BE AFTER ROUTES
// ========================================

// 404 handler - MUST be after all routes
app.use((req, res) => {
    console.log('❌ 404 Not Found:', req.method, req.path);
    res.status(404).json({
        success: false,
        message: 'Route not found',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString(),
        availableEndpoints: [
            '/api/health',
            '/api/auth',
            '/api/products',
            '/api/orders',
            '/api/admin',
            '/api/settings'
        ]
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('💥 Error Handler:', err);
    
    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({
            success: false,
            message: messages[0] || 'Validation error',
            errors: messages
        });
    }
    
    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(400).json({
            success: false,
            message: `${field} already exists`
        });
    }
    
    // JWT error
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }
    
    // Default error
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
        ...(CONFIG.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ========================================
// DATABASE MAINTENANCE FUNCTIONS
// ========================================

// CRITICAL: Fix MongoDB orderNumber index issue
async function fixOrderNumberIndex() {
    try {
        console.log('🔧 Checking orderNumber index...');
        
        const collection = mongoose.connection.db.collection('orders');
        
        // Get existing indices
        const indices = await collection.indexes();
        const hasOldIndex = indices.some(idx => 
            idx.name === 'orderNumber_1' && !idx.sparse
        );
        
        if (hasOldIndex) {
            console.log('🔧 Found old orderNumber index, fixing...');
            
            // Drop old index
            try {
                await collection.dropIndex('orderNumber_1');
                console.log('✅ Old orderNumber_1 index dropped');
            } catch (err) {
                if (err.code !== 27) { // 27 = IndexNotFound
                    throw err;
                }
            }
            
            console.log('ℹ️  New sparse index will be created by model');
        }
        
        // Sync existing orders: set orderNumber = numeroCommande where orderNumber is null
        const updateResult = await collection.updateMany(
            { 
                numeroCommande: { $exists: true, $ne: null },
                $or: [
                    { orderNumber: null },
                    { orderNumber: { $exists: false } }
                ]
            },
            [{ $set: { orderNumber: "$numeroCommande" } }]
        );
        
        if (updateResult.modifiedCount > 0) {
            console.log(`✅ Synced orderNumber for ${updateResult.modifiedCount} orders`);
        }
        
        console.log('✅ OrderNumber index check complete');
        
    } catch (error) {
        console.error('❌ Error fixing orderNumber index:', error.message);
        // Don't throw - allow server to continue even if fix fails
    }
}

// Create admin user
async function createAdminUser() {
    try {
        const admin = await User.findOne({ email: 'pharmaciegaher@gmail.com' });
        
        if (!admin) {
            console.log('👤 Creating admin user...');
            
            const bcrypt = require('bcryptjs');
            const salt = await bcrypt.genSalt(12);
            const hashedPassword = await bcrypt.hash('anesaya75', salt);
            
            const newAdmin = new User({
                nom: 'Gaher',
                prenom: 'Parapharmacie',
                email: 'pharmaciegaher@gmail.com',
                password: hashedPassword,
                telephone: '0555123456',
                adresse: 'Tipaza, Algérie',
                wilaya: 'Tipaza',
                role: 'admin',
                actif: true
            });
            
            await newAdmin.save();
            console.log('✅ Admin user created successfully');
            console.log('   📧 Email: pharmaciegaher@gmail.com');
            console.log('   🔑 Password: anesaya75');
        } else {
            console.log('✅ Admin user already exists');
            
            // Fix admin phone if it's wrong
            if (admin.telephone === '+213123456789') {
                console.log('🔧 Fixing admin phone number...');
                admin.telephone = '0555123456';
                await admin.save({ validateBeforeSave: false });
                console.log('✅ Admin phone fixed');
            }
        }
    } catch (error) {
        console.error('❌ Admin user creation error:', error.message);
    }
}

// Ensure all indexes are created
async function ensureIndexes() {
    try {
        console.log('📇 Ensuring database indexes...');
        
        await Product.ensureIndexes();
        console.log('✅ Product indexes created');
        
        await Order.ensureIndexes();
        console.log('✅ Order indexes created');
        
        await User.ensureIndexes();
        console.log('✅ User indexes created');
        
        console.log('✅ All indexes ensured');
    } catch (error) {
        console.error('❌ Error ensuring indexes:', error.message);
    }
}

// ========================================
// DATABASE CONNECTION
// ========================================

const connectDB = async () => {
    try {
        if (!CONFIG.MONGODB_URI) {
            throw new Error('MONGODB_URI not found in environment variables');
        }

        console.log('🔌 Connecting to MongoDB...');
        console.log('   URI:', CONFIG.MONGODB_URI.replace(/:[^:]*@/, ':****@'));
        
        await mongoose.connect(CONFIG.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ MongoDB connected successfully');
        
        // Run maintenance tasks after connection
        console.log('\n🔧 Running database maintenance tasks...\n');
        
        await ensureIndexes();
        await createAdminUser();
        await fixOrderNumberIndex();
        
        console.log('\n✅ Database initialization complete\n');
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        console.log('🔄 Retrying in 10 seconds...');
        setTimeout(connectDB, 10000);
    }
};

// ========================================
// DATABASE EVENT HANDLERS
// ========================================

mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠️  MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected');
});

mongoose.connection.on('close', () => {
    console.log('🔌 MongoDB connection closed');
});

// ========================================
// START SERVER
// ========================================

// Connect to database first
connectDB();

// Start HTTP server
const server = app.listen(CONFIG.PORT, '0.0.0.0', () => {
    console.log('\n========================================');
    console.log('🌿 Shifa Parapharmacie Backend Server');
    console.log('========================================');
    console.log(`📍 Port: ${CONFIG.PORT}`);
    console.log(`🌍 Environment: ${CONFIG.NODE_ENV}`);
    console.log(`🏥 Health Check: http://localhost:${CONFIG.PORT}/api/health`);
    console.log(`📚 API Docs: http://localhost:${CONFIG.PORT}/`);
    console.log('========================================\n');
    console.log('✅ Server is running and ready to accept requests\n');
});

// ========================================
// GRACEFUL SHUTDOWN
// ========================================

const gracefulShutdown = (signal) => {
    console.log(`\n⚠️  ${signal} received`);
    console.log('🔄 Starting graceful shutdown...');
    
    server.close(async () => {
        console.log('✅ HTTP server closed');
        
        try {
            await mongoose.connection.close();
            console.log('✅ MongoDB connection closed');
            console.log('👋 Shutdown complete');
            process.exit(0);
        } catch (err) {
            console.error('❌ Error during shutdown:', err);
            process.exit(1);
        }
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
        console.error('⚠️  Forcing shutdown after timeout');
        process.exit(1);
    }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ========================================
// UNCAUGHT EXCEPTION & REJECTION HANDLERS
// ========================================

process.on('uncaughtException', (err) => {
    console.error('\n💥 UNCAUGHT EXCEPTION! Shutting down...');
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    console.error('\n💥 UNHANDLED REJECTION! Shutting down...');
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    console.error('Stack:', err.stack);
    
    server.close(() => {
        process.exit(1);
    });
});

// Export for testing
module.exports = app;
