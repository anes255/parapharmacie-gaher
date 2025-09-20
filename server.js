const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

console.log('🚀 Starting Shifa Parapharmacie Server...');

// CORS configuration
const corsOptions = {
    origin: [
        'http://localhost:3000',
        'http://localhost:3001', 
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://localhost:5173',
        'https://parapharmacieshifa.com',
        'http://parapharmacieshifa.com',
        // Add your frontend domain here
        'https://your-frontend-domain.com'
    ],
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

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} - ${req.method} ${req.path}`);
    if (req.method === 'POST' || req.method === 'PUT') {
        console.log('Request body keys:', Object.keys(req.body));
    }
    next();
});

// ROOT ROUTE
app.get('/', (req, res) => {
    res.json({
        message: 'Shifa Parapharmacie Backend API',
        status: 'running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        message: 'API is healthy',
        timestamp: new Date().toISOString(),
        status: 'running',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// Debug route
app.get('/api/debug', (req, res) => {
    res.json({
        message: 'Debug endpoint working',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        mongoState: mongoose.connection.readyState,
        routes: {
            auth: '/api/auth/*',
            products: '/api/products/*', 
            orders: '/api/orders/*',
            admin: '/api/admin/*',
            settings: '/api/settings/*'
        }
    });
});

// Load routes with error handling
console.log('📝 Loading routes...');

// Auth routes
try {
    const authRoutes = require('./routes/auth');
    app.use('/api/auth', authRoutes);
    console.log('✅ Auth routes loaded successfully');
} catch (error) {
    console.error('❌ Failed to load auth routes:', error.message);
    console.error(error.stack);
}

// Product routes  
try {
    const productRoutes = require('./routes/products');
    app.use('/api/products', productRoutes);
    console.log('✅ Product routes loaded successfully');
} catch (error) {
    console.error('❌ Failed to load product routes:', error.message);
    console.error(error.stack);
}

// Order routes
try {
    const orderRoutes = require('./routes/orders');
    app.use('/api/orders', orderRoutes);
    console.log('✅ Order routes loaded successfully');
} catch (error) {
    console.error('❌ Failed to load order routes:', error.message);
    console.error(error.stack);
    
    // Fallback routes if order routes fail
    app.get('/api/orders/test', (req, res) => {
        res.json({ message: 'Fallback orders test route', error: error.message });
    });
    
    app.get('/api/orders', (req, res) => {
        res.status(500).json({ 
            message: 'Orders routes failed to load', 
            error: error.message,
            orders: []
        });
    });
}

// Admin routes
try {
    const adminRoutes = require('./routes/admin');
    app.use('/api/admin', adminRoutes);
    console.log('✅ Admin routes loaded successfully');
} catch (error) {
    console.error('❌ Failed to load admin routes:', error.message);
    console.error(error.stack);
}

// Settings routes
try {
    const settingsRoutes = require('./routes/settings');
    app.use('/api/settings', settingsRoutes);
    console.log('✅ Settings routes loaded successfully');
} catch (error) {
    console.error('❌ Failed to load settings routes:', error.message);
    console.error(error.stack);
}

// MongoDB Connection with retry logic
const connectDB = async () => {
    try {
        console.log('🔌 Connecting to MongoDB...');
        
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI environment variable is not set');
        }
        
        const connectionOptions = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        };
        
        await mongoose.connect(process.env.MONGODB_URI, connectionOptions);
        
        console.log('✅ MongoDB connected successfully');
        console.log('📍 Database:', mongoose.connection.name);
        
        // Initialize admin user after successful connection
        await initializeAdmin();
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        console.log('🔄 Retrying connection in 10 seconds...');
        setTimeout(connectDB, 10000);
    }
};

// Initialize admin user
async function initializeAdmin() {
    try {
        console.log('👤 Checking admin user...');
        
        const User = require('./models/User');
        const bcrypt = require('bcryptjs');
        
        // Check if admin exists
        let admin = await User.findOne({ email: 'pharmaciegaher@gmail.com' });
        
        if (!admin) {
            console.log('👤 Creating admin user...');
            
            const salt = await bcrypt.genSalt(12);
            const hashedPassword = await bcrypt.hash('anesaya75', salt);
            
            admin = new User({
                nom: 'Gaher',
                prenom: 'Parapharmacie',
                email: 'pharmaciegaher@gmail.com',
                telephone: '+213123456789',
                adresse: 'Tipaza, Algérie',
                wilaya: 'Tipaza',
                password: hashedPassword,
                role: 'admin',
                actif: true,
                dateInscription: new Date(),
                dernierConnexion: new Date()
            });
            
            await admin.save();
            console.log('✅ Admin user created successfully');
        } else {
            console.log('✅ Admin user already exists');
        }
        
        // Update admin's last connection
        admin.dernierConnexion = new Date();
        await admin.save();
        
    } catch (error) {
        console.error('❌ Admin user initialization failed:', error.message);
        console.error('This is not critical, server will continue...');
    }
}

// Global error handling middleware
app.use((error, req, res, next) => {
    console.error('💥 Global error handler:', error);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({ 
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
});

// 404 handler for unmatched routes
app.use('*', (req, res) => {
    console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        message: 'Route not found',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString(),
        availableRoutes: {
            health: '/api/health',
            debug: '/api/debug',
            auth: '/api/auth/*',
            products: '/api/products/*',
            orders: '/api/orders/*',
            admin: '/api/admin/*'
        }
    });
});

// Database connection
connectDB();

// Graceful shutdown handlers
process.on('SIGTERM', () => {
    console.log('💀 SIGTERM received, shutting down gracefully...');
    mongoose.connection.close(() => {
        console.log('✅ MongoDB connection closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('💀 SIGINT received, shutting down gracefully...');
    mongoose.connection.close(() => {
        console.log('✅ MongoDB connection closed');
        process.exit(0);
    });
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (err) => {
    console.error('💥 Unhandled Promise Rejection:', err);
    console.error('💀 Shutting down server...');
    process.exit(1);
});

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔗 Debug: http://localhost:${PORT}/api/debug`);
    console.log(`📊 API Base: http://localhost:${PORT}/api`);
    console.log('✅ Server startup completed');
});

// Export app for testing
module.exports = app;
