const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

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

// Logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

// ========================================
// BASIC ROUTES
// ========================================

app.get('/', (req, res) => {
    res.json({
        message: 'Shifa Parapharmacie API',
        status: 'running',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// ========================================
// API ROUTES - LOAD ALL ROUTES HERE
// ========================================

console.log('Loading API routes...');

// Auth routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);
console.log('Auth routes: /api/auth');

// Product routes  
const productRoutes = require('./routes/products');
app.use('/api/products', productRoutes);
console.log('Product routes: /api/products');

// Order routes
const orderRoutes = require('./routes/orders');
app.use('/api/orders', orderRoutes);
console.log('Order routes: /api/orders');

// Admin routes
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);
console.log('Admin routes: /api/admin');

// Settings routes
const settingsRoutes = require('./routes/settings');
app.use('/api/settings', settingsRoutes);
console.log('Settings routes: /api/settings');

// SEO routes (sitemap and robots.txt) - NEW
try {
    const sitemapRoutes = require('./routes/sitemap');
    app.use('/api', sitemapRoutes);
    console.log('SEO routes: /api/sitemap.xml, /api/robots.txt');
} catch (error) {
    console.log('Sitemap routes not found (optional) - create routes/sitemap.js to enable SEO features');
}

console.log('All routes loaded successfully\n');

// ========================================
// ERROR HANDLING - MUST BE AFTER ROUTES
// ========================================

// 404 handler - MUST be last
app.use((req, res) => {
    console.log('404:', req.method, req.path);
    res.status(404).json({
        message: 'Route not found',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        message: err.message || 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// ========================================
// DATABASE MAINTENANCE FUNCTIONS
// ========================================

// CRITICAL: Fix MongoDB orderNumber index issue
async function fixOrderNumberIndex() {
    try {
        console.log('Checking orderNumber index...');
        
        const collection = mongoose.connection.db.collection('orders');
        
        // Get existing indices
        const indices = await collection.indexes();
        const hasOldIndex = indices.some(idx => 
            idx.name === 'orderNumber_1' && !idx.sparse
        );
        
        if (hasOldIndex) {
            console.log('Found old orderNumber index, fixing...');
            
            // Drop old index
            try {
                await collection.dropIndex('orderNumber_1');
                console.log('Old orderNumber_1 index dropped');
            } catch (err) {
                if (err.code !== 27) { // 27 = IndexNotFound
                    throw err;
                }
            }
            
            // Create new sparse index (will be created automatically by model)
            console.log('New sparse index will be created by model');
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
            console.log(`Synced orderNumber for ${updateResult.modifiedCount} orders`);
        }
        
        console.log('OrderNumber index check complete');
        
    } catch (error) {
        console.error('Error fixing orderNumber index:', error.message);
        // Don't throw - allow server to continue even if fix fails
    }
}

// Create admin user
async function createAdminUser() {
    try {
        const User = require('./models/User');
        
        const admin = await User.findOne({ email: 'pharmaciegaher@gmail.com' });
        
        if (!admin) {
            console.log('Creating admin user...');
            
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
            console.log('Admin user created');
            console.log('   Email: pharmaciegaher@gmail.com');
            console.log('   Password: anesaya75');
        } else {
            console.log('Admin user exists');
            
            // Fix admin phone if it's wrong
            if (admin.telephone === '+213123456789') {
                console.log('Fixing admin phone number...');
                admin.telephone = '0555123456';
                await admin.save({ validateBeforeSave: false });
                console.log('Admin phone fixed');
            }
        }
    } catch (error) {
        console.error('Admin user creation error:', error.message);
    }
}

// ========================================
// DATABASE CONNECTION
// ========================================

const connectDB = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI not found in environment variables');
        }

        console.log('Connecting to MongoDB...');
        
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('MongoDB connected');
        
        // Run maintenance tasks after connection
        await createAdminUser();
        await fixOrderNumberIndex();
        
        console.log('Database initialization complete\n');
        
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        console.log('Retrying in 10 seconds...');
        setTimeout(connectDB, 10000);
    }
};

// Handle connection events
mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected');
});

// ========================================
// START SERVER
// ========================================

const PORT = process.env.PORT || 5000;

// Connect to database first
connectDB();

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('\n========================================');
    console.log('Shifa Parapharmacie Backend');
    console.log('========================================');
    console.log(`Port: ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Health: http://localhost:${PORT}/api/health`);
    console.log('========================================\n');
});

// Graceful shutdown
const gracefulShutdown = () => {
    console.log('\nShutting down gracefully...');
    server.close(async () => {
        console.log('HTTP server closed');
        
        try {
            await mongoose.connection.close();
            console.log('MongoDB connection closed');
            process.exit(0);
        } catch (err) {
            console.error('Error during shutdown:', err);
            process.exit(1);
        }
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
        console.error('Forcing shutdown...');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION! Shutting down...');
    console.error(err.name, err.message);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION! Shutting down...');
    console.error(err.name, err.message);
    server.close(() => {
        process.exit(1);
    });
});

module.exports = app; // Export for testing
