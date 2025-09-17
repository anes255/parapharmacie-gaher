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
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://localhost:5173',
        'https://parapharmacieshifa.com',
        'http://parapharmacieshifa.com',
        'https://parapharmacie-frontend.vercel.app',
        'https://parapharmacie-frontend.onrender.com'
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

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check route
app.get('/', (req, res) => {
    res.json({
        message: 'Shifa Parapharmacie Backend API',
        status: 'running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        message: 'API is healthy',
        timestamp: new Date().toISOString(),
        status: 'running',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// Load routes immediately (don't wait for DB connection)
console.log('📦 Loading routes...');

try {
    const authRoutes = require('./routes/auth');
    app.use('/api/auth', authRoutes);
    console.log('✅ Auth routes loaded');
} catch (error) {
    console.error('❌ Auth routes failed:', error.message);
}

try {
    const productRoutes = require('./routes/products');
    app.use('/api/products', productRoutes);
    console.log('✅ Product routes loaded');
} catch (error) {
    console.error('❌ Product routes failed:', error.message);
}

try {
    const orderRoutes = require('./routes/orders');
    app.use('/api/orders', orderRoutes);
    console.log('✅ Order routes loaded');
} catch (error) {
    console.error('❌ Order routes failed:', error.message);
}

try {
    const adminRoutes = require('./routes/admin');
    app.use('/api/admin', adminRoutes);
    console.log('✅ Admin routes loaded');
} catch (error) {
    console.error('❌ Admin routes failed:', error.message);
}

try {
    const settingsRoutes = require('./routes/settings');
    app.use('/api/settings', settingsRoutes);
    console.log('✅ Settings routes loaded');
} catch (error) {
    console.error('❌ Settings routes failed:', error.message);
}

console.log('📦 Route loading completed');

// MongoDB Connection
const connectDB = async () => {
    try {
        console.log('🔄 Connecting to MongoDB...');
        
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI environment variable is not set');
        }
        
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ MongoDB connected successfully');
        console.log(`📍 Database: ${conn.connection.name}`);
        console.log(`🌐 Host: ${conn.connection.host}:${conn.connection.port}`);
        
        // Initialize admin user after successful connection
        await initializeAdmin();
        
        return conn;
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        
        // In production, retry connection after delay
        if (process.env.NODE_ENV === 'production') {
            console.log('⏳ Retrying connection in 10 seconds...');
            setTimeout(connectDB, 10000);
        } else {
            console.log('⚠️ Continuing without database in development mode');
        }
    }
};

// Initialize admin user
async function initializeAdmin() {
    try {
        // Import User model only after MongoDB connection
        const User = require('./models/User');
        const bcrypt = require('bcryptjs');
        
        console.log('👤 Checking for admin user...');
        
        let admin = await User.findOne({ email: 'pharmaciegaher@gmail.com' });
        
        if (!admin) {
            console.log('🔧 Creating admin user...');
            
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
                emailVerifie: true,
                telephoneVerifie: true,
                dateInscription: new Date()
            });
            
            await admin.save();
            console.log('✅ Admin user created successfully');
        } else {
            console.log('✅ Admin user already exists');
        }
        
        // Initialize default settings
        await initializeSettings();
        
    } catch (error) {
        console.error('❌ Admin initialization failed:', error.message);
        // Don't fail the server if admin creation fails
    }
}

// Initialize default settings
async function initializeSettings() {
    try {
        const Settings = require('./models/Settings');
        console.log('⚙️ Initializing settings...');
        
        // This will create default settings if they don't exist
        await Settings.getSettings();
        await Settings.initializeDefaultWilayas();
        
        console.log('✅ Settings initialized successfully');
    } catch (error) {
        console.error('❌ Settings initialization failed:', error.message);
    }
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('🚨 Server error:', error);
    
    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    res.status(error.status || 500).json({
        message: error.message || 'Erreur serveur interne',
        ...(isDevelopment && { stack: error.stack }),
        timestamp: new Date().toISOString(),
        path: req.path
    });
});

// 404 handler - should be last route
app.use('*', (req, res) => {
    console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
    
    res.status(404).json({
        message: 'Route non trouvée',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString(),
        availableRoutes: [
            'GET /',
            'GET /api/health',
            'POST /api/auth/login',
            'POST /api/auth/register',
            'GET /api/auth/profile',
            'POST /api/auth/verify-token',
            'GET /api/products',
            'GET /api/products/categories/all',
            'GET /api/products/featured/all',
            'GET /api/orders',
            'POST /api/orders',
            'GET /api/admin/dashboard',
            'GET /api/settings/public'
        ]
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    
    mongoose.connection.close(() => {
        console.log('📝 MongoDB connection closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    
    mongoose.connection.close(() => {
        console.log('📝 MongoDB connection closed');
        process.exit(0);
    });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('🚨 Unhandled Promise Rejection:', err);
    
    // Close server & exit process
    mongoose.connection.close(() => {
        console.log('📝 MongoDB connection closed due to unhandled rejection');
        process.exit(1);
    });
});

// Start server
const startServer = async () => {
    try {
        const PORT = process.env.PORT || 5000;
        
        const server = app.listen(PORT, () => {
            console.log('🚀 Server started successfully!');
            console.log(`📡 Server running on port ${PORT}`);
            console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
            console.log(`📚 API Base URL: http://localhost:${PORT}/api`);
            
            if (process.env.NODE_ENV === 'development') {
                console.log('🔧 Development mode - detailed logging enabled');
            }
            
            // Connect to database after server starts
            connectDB().catch(err => {
                console.error('Database connection failed but server continues:', err.message);
            });
        });
        
        // Handle server errors
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`❌ Port ${PORT} is already in use`);
                process.exit(1);
            } else {
                console.error('❌ Server error:', error);
                throw error;
            }
        });
        
        return server;
        
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
};

// Start the server
startServer();

module.exports = app;
