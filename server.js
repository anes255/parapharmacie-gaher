const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// CORS configuration - FIXED
const corsOptions = {
    origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://localhost:5173',
        'https://parapharmacieshifa.com',
        'http://parapharmacieshifa.com',
        'https://anes255.github.io',
        'http://anes255.github.io'
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
        console.log('Body:', JSON.stringify(req.body, null, 2).substring(0, 500));
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

// ROUTE LOADING - FIXED ORDER AND ERROR HANDLING
console.log('🔄 Loading routes...');

// Auth routes (must be first)
try {
    const authRoutes = require('./routes/auth');
    app.use('/api/auth', authRoutes);
    console.log('✅ Auth routes loaded');
} catch (error) {
    console.error('❌ Auth routes failed:', error.message);
    process.exit(1); // Exit if auth routes fail as they're critical
}

// Product routes
try {
    const productRoutes = require('./routes/products');
    app.use('/api/products', productRoutes);
    console.log('✅ Product routes loaded');
} catch (error) {
    console.error('❌ Product routes failed:', error.message);
}

// Order routes
try {
    const orderRoutes = require('./routes/orders');
    app.use('/api/orders', orderRoutes);
    console.log('✅ Order routes loaded');
} catch (error) {
    console.error('❌ Order routes failed:', error.message);
}

// Admin routes (must be after auth routes)
try {
    const adminRoutes = require('./routes/admin');
    app.use('/api/admin', adminRoutes);
    console.log('✅ Admin routes loaded');
} catch (error) {
    console.error('❌ Admin routes failed:', error.message);
}

// Settings routes
try {
    const settingsRoutes = require('./routes/settings');
    app.use('/api/settings', settingsRoutes);
    console.log('✅ Settings routes loaded');
} catch (error) {
    console.error('❌ Settings routes failed:', error.message);
}

// MongoDB Connection with better error handling
const connectDB = async () => {
    try {
        console.log('🔄 Connecting to MongoDB...');
        
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI environment variable is not set');
        }
        
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000, // 10 seconds
            socketTimeoutMS: 45000, // 45 seconds
            maxPoolSize: 10, // Maintain up to 10 socket connections
            bufferCommands: false, // Disable mongoose buffering
            bufferMaxEntries: 0 // Disable mongoose buffering
        });
        
        console.log('✅ MongoDB connected successfully');
        console.log(`Database: ${mongoose.connection.name}`);
        
        // Initialize admin user
        await initializeAdmin();
        
        // Initialize default data if needed
        await initializeDefaultData();
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        console.log('🔄 Retrying connection in 10 seconds...');
        setTimeout(connectDB, 10000);
    }
};

// Initialize admin user - FIXED
async function initializeAdmin() {
    try {
        console.log('🔄 Initializing admin user...');
        
        // Import User model
        const User = require('./models/User');
        
        // Check if admin already exists
        let admin = await User.findOne({ email: 'pharmaciegaher@gmail.com' });
        
        if (!admin) {
            console.log('📝 Creating default admin user...');
            
            admin = new User({
                nom: 'Gaher',
                prenom: 'Parapharmacie',
                email: 'pharmaciegaher@gmail.com',
                telephone: '+213123456789',
                adresse: 'Tipaza, Algérie',
                wilaya: 'Tipaza',
                password: 'anesaya75', // Will be hashed by pre-save hook
                role: 'admin'
            });
            
            await admin.save();
            console.log('✅ Default admin user created');
            console.log('   Email: pharmaciegaher@gmail.com');
            console.log('   Password: anesaya75');
        } else {
            console.log('✅ Admin user already exists');
        }
        
    } catch (error) {
        console.error('❌ Admin initialization failed:', error.message);
        // Don't exit process, just log the error
    }
}

// Initialize default data
async function initializeDefaultData() {
    try {
        console.log('🔄 Checking for default data...');
        
        const Product = require('./models/Product');
        const productCount = await Product.countDocuments();
        
        if (productCount === 0) {
            console.log('📝 Creating sample products...');
            
            const sampleProducts = [
                {
                    nom: 'Multivitamines Essentiel',
                    description: 'Complément alimentaire riche en vitamines et minéraux essentiels pour votre santé quotidienne.',
                    prix: 2500,
                    stock: 50,
                    categorie: 'Vitalité',
                    marque: 'VitaPlus',
                    enVedette: true,
                    actif: true
                },
                {
                    nom: 'Shampooing Fortifiant',
                    description: 'Shampooing nourrissant pour cheveux fragiles et abîmés. Formule enrichie aux extraits naturels.',
                    prix: 1200,
                    stock: 30,
                    categorie: 'Cheveux',
                    marque: 'BeautyHair',
                    actif: true
                },
                {
                    nom: 'Crème Hydratante Visage',
                    description: 'Crème hydratante quotidienne pour tous types de peau. Texture légère et absorption rapide.',
                    prix: 1800,
                    stock: 25,
                    categorie: 'Visage',
                    marque: 'DermaCare',
                    enPromotion: true,
                    prixOriginal: 2200,
                    pourcentagePromotion: 18,
                    actif: true
                }
            ];
            
            await Product.insertMany(sampleProducts);
            console.log(`✅ Created ${sampleProducts.length} sample products`);
        } else {
            console.log(`✅ Database already has ${productCount} products`);
        }
        
    } catch (error) {
        console.error('❌ Default data initialization failed:', error.message);
    }
}

// Enhanced error handling middleware
app.use((error, req, res, next) => {
    console.error('🚨 Server error:', error);
    
    // Mongoose validation error
    if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
            message: messages[0] || 'Données invalides',
            type: 'validation_error'
        });
    }
    
    // Mongoose duplicate key error
    if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return res.status(400).json({
            message: `${field === 'email' ? 'Email' : field} déjà utilisé`,
            type: 'duplicate_error'
        });
    }
    
    // JWT errors
    if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
            message: 'Token invalide',
            type: 'auth_error'
        });
    }
    
    if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
            message: 'Token expiré',
            type: 'auth_error'
        });
    }
    
    // Cast error (invalid ObjectId)
    if (error.name === 'CastError') {
        return res.status(400).json({
            message: 'ID invalide',
            type: 'cast_error'
        });
    }
    
    // Default server error
    res.status(500).json({ 
        message: 'Erreur serveur interne',
        type: 'server_error',
        timestamp: new Date().toISOString()
    });
});

// 404 handler - MUST be last
app.use('*', (req, res) => {
    console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        message: 'Route non trouvée',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString(),
        availableRoutes: {
            auth: ['/api/auth/login', '/api/auth/register', '/api/auth/profile'],
            products: ['/api/products', '/api/products/:id'],
            orders: ['/api/orders', '/api/orders/:id'],
            admin: ['/api/admin/dashboard', '/api/admin/products', '/api/admin/orders'],
            health: '/api/health'
        }
    });
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
    console.log('\n🔄 Graceful shutdown initiated...');
    try {
        await mongoose.connection.close();
        console.log('✅ Database connection closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    console.log('\n🔄 SIGTERM received, shutting down gracefully...');
    try {
        await mongoose.connection.close();
        console.log('✅ Database connection closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('🚨 Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Connect to database first
connectDB();

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`📚 API Base: http://localhost:${PORT}/api`);
    console.log(`\n✅ Server is ready to accept connections`);
});

// Handle server errors
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        process.exit(1);
    } else {
        console.error('❌ Server error:', error);
        process.exit(1);
    }
});

module.exports = app;
