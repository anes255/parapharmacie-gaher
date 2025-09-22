const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Enhanced CORS configuration
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
        process.env.FRONTEND_URL
    ].filter(Boolean),
    credentials: true,
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

// Enhanced middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging with timestamp
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
    next();
});

// Security headers
app.use((req, res, next) => {
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    next();
});

// Root route with enhanced info
app.get('/', (req, res) => {
    res.json({
        name: 'Shifa Parapharmacie API',
        version: '2.0.0',
        status: 'running',
        description: 'Backend API for Shifa Parapharmacie e-commerce platform',
        endpoints: {
            health: '/api/health',
            auth: '/api/auth/*',
            products: '/api/products/*',
            orders: '/api/orders/*',
            admin: '/api/admin/*',
            settings: '/api/settings/*'
        },
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Enhanced health check
app.get('/api/health', async (req, res) => {
    try {
        // Check database connection
        const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
        
        // System info
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();
        
        res.json({
            status: 'healthy',
            database: dbStatus,
            timestamp: new Date().toISOString(),
            uptime: Math.floor(uptime),
            memory: {
                used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
                total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB'
            },
            environment: process.env.NODE_ENV || 'development',
            version: '2.0.0'
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Route loading with enhanced error handling
const loadRoutes = () => {
    try {
        // Auth routes
        const authRoutes = require('./routes/auth');
        app.use('/api/auth', authRoutes);
        console.log('✅ Auth routes loaded successfully');
    } catch (error) {
        console.error('❌ Failed to load auth routes:', error.message);
    }

    try {
        // Product routes
        const productRoutes = require('./routes/products');
        app.use('/api/products', productRoutes);
        console.log('✅ Product routes loaded successfully');
    } catch (error) {
        console.error('❌ Failed to load product routes:', error.message);
    }

    try {
        // Order routes
        const orderRoutes = require('./routes/orders');
        app.use('/api/orders', orderRoutes);
        console.log('✅ Order routes loaded successfully');
    } catch (error) {
        console.error('❌ Failed to load order routes:', error.message);
    }

    try {
        // Admin routes
        const adminRoutes = require('./routes/admin');
        app.use('/api/admin', adminRoutes);
        console.log('✅ Admin routes loaded successfully');
    } catch (error) {
        console.error('❌ Failed to load admin routes:', error.message);
    }

    try {
        // Settings routes
        const settingsRoutes = require('./routes/settings');
        app.use('/api/settings', settingsRoutes);
        console.log('✅ Settings routes loaded successfully');
    } catch (error) {
        console.error('❌ Failed to load settings routes:', error.message);
    }
};

// MongoDB connection with retry logic
const connectDB = async () => {
    try {
        console.log('🔗 Connecting to MongoDB...');
        
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI environment variable is not set');
        }
        
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            bufferCommands: false,
            bufferMaxEntries: 0
        });
        
        console.log('✅ MongoDB connected successfully');
        console.log(`📍 Database: ${conn.connection.name}`);
        
        // Initialize default data
        await initializeDefaultData();
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        
        // Retry connection after delay
        console.log('🔄 Retrying connection in 10 seconds...');
        setTimeout(connectDB, 10000);
    }
};

// Initialize default data (admin user, settings, etc.)
const initializeDefaultData = async () => {
    try {
        await initializeAdminUser();
        await initializeSettings();
        console.log('✅ Default data initialized');
    } catch (error) {
        console.error('❌ Failed to initialize default data:', error.message);
    }
};

// Initialize admin user
const initializeAdminUser = async () => {
    try {
        const User = require('./models/User');
        
        const existingAdmin = await User.findOne({ email: 'pharmaciegaher@gmail.com' });
        if (existingAdmin) {
            console.log('👤 Admin user already exists');
            return;
        }
        
        const admin = new User({
            nom: 'Gaher',
            prenom: 'Parapharmacie',
            email: 'pharmaciegaher@gmail.com',
            password: 'anesaya75', // Will be hashed automatically
            telephone: '+213123456789',
            adresse: 'Tipaza, Algérie',
            ville: 'Tipaza',
            wilaya: 'Tipaza',
            role: 'admin',
            actif: true,
            dateInscription: new Date()
        });
        
        await admin.save();
        console.log('👤 Admin user created successfully');
        
    } catch (error) {
        console.error('❌ Failed to create admin user:', error.message);
    }
};

// Initialize default settings
const initializeSettings = async () => {
    try {
        const Settings = require('./models/Settings');
        
        const existingSettings = await Settings.findOne();
        if (existingSettings) {
            console.log('⚙️ Settings already exist');
            return;
        }
        
        const defaultSettings = new Settings({
            siteName: 'Shifa - Parapharmacie',
            siteDescription: 'Votre parapharmacie de confiance à Tipaza, Algérie',
            contact: {
                email: 'pharmaciegaher@gmail.com',
                telephone: '+213 123 456 789',
                adresse: 'Tipaza, Algérie',
                horaires: 'Lun-Sam: 8h-20h, Dim: 9h-18h'
            },
            socialMedia: {
                facebook: 'https://www.facebook.com/pharmaciegaher/?locale=mg_MG',
                instagram: 'https://www.instagram.com/pharmaciegaher/',
                youtube: '',
                linkedin: ''
            },
            shipping: {
                standardCost: 300,
                freeShippingThreshold: 5000,
                estimatedDays: '2-5 jours ouvrables'
            },
            currency: 'DA',
            language: 'fr',
            timezone: 'Africa/Algiers'
        });
        
        await defaultSettings.save();
        console.log('⚙️ Default settings created successfully');
        
    } catch (error) {
        console.error('❌ Failed to create default settings:', error.message);
    }
};

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('🚨 Server error:', {
        message: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
    });
    
    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(error.status || 500).json({
        message: isDevelopment ? error.message : 'Erreur serveur interne',
        ...(isDevelopment && { stack: error.stack }),
        timestamp: new Date().toISOString()
    });
});

// 404 handler with helpful info
app.use('*', (req, res) => {
    res.status(404).json({
        message: 'Endpoint non trouvé',
        path: req.originalUrl,
        method: req.method,
        availableEndpoints: [
            'GET /',
            'GET /api/health',
            'POST /api/auth/login',
            'POST /api/auth/register',
            'GET /api/products',
            'GET /api/orders',
            'GET /api/admin/dashboard'
        ],
        timestamp: new Date().toISOString()
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📴 SIGTERM received, shutting down gracefully...');
    mongoose.connection.close(() => {
        console.log('📴 MongoDB connection closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('📴 SIGINT received, shutting down gracefully...');
    mongoose.connection.close(() => {
        console.log('📴 MongoDB connection closed');
        process.exit(0);
    });
});

// Database connection event listeners
mongoose.connection.on('error', (err) => {
    console.error('🚨 MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
    console.log('🔄 MongoDB reconnected');
});

// Load routes
loadRoutes();

// Connect to database
connectDB();

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`🚀 Shifa Parapharmacie server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📱 API base URL: http://localhost:${PORT}/api`);
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
});

// Handle server startup errors
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        process.exit(1);
    } else {
        console.error('❌ Server startup error:', error);
        process.exit(1);
    }
});

module.exports = app;
