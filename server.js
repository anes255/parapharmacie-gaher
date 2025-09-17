const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// CORS configuration
const corsOptions = {
    origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:5173',
        'https://parapharmacieshifa.com',
        'http://parapharmacieshifa.com',
        'https://parapharmacie-frontend.vercel.app',
        'https://*.vercel.app'
    ],
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'x-auth-token',
        'Origin',
        'X-Requested-With',
        'Accept'
    ]
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Request body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// ROOT ROUTE
app.get('/', (req, res) => {
    res.json({
        message: 'Shifa Parapharmacie Backend API',
        status: 'running',
        timestamp: new Date().toISOString(),
        version: '2.0.0'
    });
});

// Health check
app.get('/api/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.json({
        message: 'API is healthy',
        timestamp: new Date().toISOString(),
        status: 'running',
        database: dbStatus,
        environment: process.env.NODE_ENV || 'development'
    });
});

// MongoDB Connection with retry logic
const connectDB = async () => {
    try {
        console.log('🔄 Connecting to MongoDB...');
        
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            throw new Error('MONGODB_URI environment variable not set');
        }
        
        console.log('MongoDB URI:', mongoUri.replace(/\/\/.*:.*@/, '//***:***@'));
        
        const conn = await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 30000, // 30 seconds
            socketTimeoutMS: 45000, // 45 seconds
            family: 4 // Force IPv4
        });
        
        console.log('✅ MongoDB connected:', conn.connection.host);
        
        // Initialize admin user after successful connection
        await initializeAdmin();
        
        return true;
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        
        // Retry connection after 10 seconds
        console.log('🔄 Retrying connection in 10 seconds...');
        setTimeout(connectDB, 10000);
        return false;
    }
};

// Initialize admin user
async function initializeAdmin() {
    try {
        console.log('🔧 Initializing admin user...');
        
        // Dynamically require User model to avoid circular dependency issues
        const User = require('./models/User');
        const bcrypt = require('bcryptjs');
        
        // Check if any admin exists
        let admin = await User.findOne({ role: 'admin' });
        
        if (!admin) {
            console.log('📝 Creating default admin user...');
            
            admin = new User({
                nom: 'Gaher',
                prenom: 'Parapharmacie',
                email: 'pharmaciegaher@gmail.com',
                telephone: '+213123456789',
                adresse: 'Tipaza, Algérie',
                wilaya: 'Tipaza',
                password: 'anesaya75', // Will be hashed automatically
                role: 'admin',
                actif: true
            });
            
            await admin.save();
            console.log('✅ Admin user created successfully');
        } else {
            console.log('✅ Admin user already exists');
        }
        
        // Log admin info for debugging
        console.log('Admin user info:', {
            email: admin.email,
            role: admin.role,
            actif: admin.actif
        });
        
    } catch (error) {
        console.error('❌ Admin initialization failed:', error.message);
        if (error.name === 'ValidationError') {
            console.error('Validation errors:', Object.values(error.errors).map(err => err.message));
        }
    }
}

// Load routes with better error handling
const loadRoutes = () => {
    try {
        console.log('🔧 Loading routes...');
        
        // Auth routes
        try {
            const authRoutes = require('./routes/auth');
            app.use('/api/auth', authRoutes);
            console.log('✅ Auth routes loaded');
        } catch (error) {
            console.error('❌ Auth routes failed to load:', error.message);
        }
        
        // Product routes
        try {
            const productRoutes = require('./routes/products');
            app.use('/api/products', productRoutes);
            console.log('✅ Product routes loaded');
        } catch (error) {
            console.error('❌ Product routes failed to load:', error.message);
        }
        
        // Order routes
        try {
            const orderRoutes = require('./routes/orders');
            app.use('/api/orders', orderRoutes);
            console.log('✅ Order routes loaded');
        } catch (error) {
            console.error('❌ Order routes failed to load:', error.message);
        }
        
        // Admin routes
        try {
            const adminRoutes = require('./routes/admin');
            app.use('/api/admin', adminRoutes);
            console.log('✅ Admin routes loaded');
        } catch (error) {
            console.error('❌ Admin routes failed to load:', error.message);
        }
        
        // Settings routes
        try {
            const settingsRoutes = require('./routes/settings');
            app.use('/api/settings', settingsRoutes);
            console.log('✅ Settings routes loaded');
        } catch (error) {
            console.error('❌ Settings routes failed to load:', error.message);
        }
        
        console.log('✅ All routes loaded');
        
    } catch (error) {
        console.error('❌ Route loading failed:', error.message);
    }
};

// Load routes
loadRoutes();

// Global error handler
app.use((error, req, res, next) => {
    console.error('🔥 Server error:', error);
    
    // MongoDB errors
    if (error.name === 'CastError') {
        return res.status(400).json({ 
            message: 'ID invalide',
            timestamp: new Date().toISOString()
        });
    }
    
    // Validation errors
    if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
            message: messages[0] || 'Données invalides',
            timestamp: new Date().toISOString()
        });
    }
    
    // Duplicate key errors
    if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return res.status(400).json({
            message: `${field} déjà utilisé`,
            timestamp: new Date().toISOString()
        });
    }
    
    // JWT errors
    if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
            message: 'Token invalide',
            timestamp: new Date().toISOString()
        });
    }
    
    if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
            message: 'Token expiré',
            timestamp: new Date().toISOString()
        });
    }
    
    // Default error
    res.status(error.statusCode || 500).json({ 
        message: error.message || 'Erreur serveur interne',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use('*', (req, res) => {
    console.log(`❓ 404 - Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        message: 'Route non trouvée',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.error('❌ Unhandled Promise Rejection:', err);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
});

// Connect to database first, then start server
connectDB().then((connected) => {
    if (connected) {
        startServer();
    } else {
        console.log('⏳ Server will start once database connection is established');
    }
});

function startServer() {
    const PORT = process.env.PORT || 5000;
    
    app.listen(PORT, () => {
        console.log('🚀 Server Status:');
        console.log(`   Port: ${PORT}`);
        console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`   Database: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
        console.log(`   Health: http://localhost:${PORT}/api/health`);
        console.log(`   API Base: http://localhost:${PORT}/api`);
        console.log('🎉 Server ready to accept connections');
    });
}
