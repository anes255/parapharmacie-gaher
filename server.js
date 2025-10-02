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

console.log('📦 Loading API routes...');

// Auth routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);
console.log('✅ Auth routes: /api/auth');

// Product routes  
const productRoutes = require('./routes/products');
app.use('/api/products', productRoutes);
console.log('✅ Product routes: /api/products');

// Order routes
const orderRoutes = require('./routes/orders');
app.use('/api/orders', orderRoutes);
console.log('✅ Order routes: /api/orders');

// Admin routes
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);
console.log('✅ Admin routes: /api/admin');

// Settings routes
const settingsRoutes = require('./routes/settings');
app.use('/api/settings', settingsRoutes);
console.log('✅ Settings routes: /api/settings');

console.log('✅ All routes loaded successfully\n');

// ========================================
// ERROR HANDLING - MUST BE AFTER ROUTES
// ========================================

// 404 handler - MUST be last
app.use((req, res) => {
    console.log('⚠️ 404:', req.method, req.path);
    res.status(404).json({
        message: 'Route not found',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('❌ Error:', err);
    res.status(err.status || 500).json({
        message: err.message || 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// ========================================
// DATABASE CONNECTION
// ========================================

const connectDB = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI not found in environment variables');
        }

        console.log('🔌 Connecting to MongoDB...');
        
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ MongoDB connected');
        
        // Create admin user
        await createAdminUser();
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        console.log('🔄 Retrying in 10 seconds...');
        setTimeout(connectDB, 10000);
    }
};

// Create admin user
async function createAdminUser() {
    try {
        const User = require('./models/User');
        
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
                telephone: '+213123456789',
                adresse: 'Tipaza, Algérie',
                wilaya: 'Tipaza',
                role: 'admin',
                actif: true
            });
            
            await newAdmin.save();
            console.log('✅ Admin user created');
            console.log('   📧 Email: pharmaciegaher@gmail.com');
            console.log('   🔑 Password: anesaya75');
        } else {
            console.log('✅ Admin user exists');
        }
    } catch (error) {
        console.error('⚠️ Admin user creation error:', error.message);
    }
}

// ========================================
// START SERVER
// ========================================

const PORT = process.env.PORT || 5000;

// Connect to database first
connectDB();

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n========================================');
    console.log('🚀 Shifa Parapharmacie Backend');
    console.log('========================================');
    console.log(`Port: ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Health: http://localhost:${PORT}/api/health`);
    console.log('========================================\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down gracefully...');
    mongoose.connection.close();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    mongoose.connection.close();
    process.exit(0);
});
