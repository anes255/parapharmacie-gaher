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
        'http://parapharmacieshifa.com'
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
        console.log('Request body:', req.body);
    }
    next();
});

// ROOT ROUTE
app.get('/', (req, res) => {
    res.json({
        message: 'Shifa Parapharmacie Backend API',
        status: 'running',
        timestamp: new Date().toISOString(),
        endpoints: {
            auth: '/api/auth',
            products: '/api/products',
            orders: '/api/orders',
            admin: '/api/admin',
            settings: '/api/settings',
            health: '/api/health'
        }
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

// DIRECT ROUTE LOADING - NO FUNCTIONS
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

// MongoDB Connection
const connectDB = async () => {
    try {
        console.log('🔄 Connecting to MongoDB...');
        
        let mongoUri = process.env.MONGODB_URI;
        
        // Fallback to default if not set
        if (!mongoUri) {
            mongoUri = 'mongodb+srv://anesaya75:anesaya75@cluster0.pj0ej.mongodb.net/parapharmacie?retryWrites=true&w=majority&appName=Cluster0';
            console.log('⚠️ Using default MongoDB URI');
        }
        
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        
        console.log('✅ MongoDB connected successfully');
        console.log('🔗 Database:', mongoose.connection.name);
        
        // Initialize admin user
        await initializeAdmin();
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        console.log('🔄 Retrying connection in 10 seconds...');
        setTimeout(connectDB, 10000);
    }
};

// Initialize admin user - FIXED VERSION
async function initializeAdmin() {
    try {
        const User = require('./models/User');
        
        // Check if admin already exists
        let admin = await User.findOne({ email: 'pharmaciegaher@gmail.com' });
        
        if (!admin) {
            console.log('👤 Creating admin user...');
            
            admin = new User({
                nom: 'Gaher',
                prenom: 'Parapharmacie',
                email: 'pharmaciegaher@gmail.com',
                telephone: '+213123456789',
                adresse: 'Tipaza, Algérie',
                ville: 'Tipaza',
                wilaya: 'Tipaza',
                password: 'anesaya75', // Will be hashed by pre-save hook
                role: 'admin',
                actif: true,
                emailVerifie: true,
                dateInscription: new Date()
            });
            
            await admin.save();
            console.log('✅ Admin user created successfully');
            console.log('📧 Email: pharmaciegaher@gmail.com');
            console.log('🔑 Password: anesaya75');
        } else {
            console.log('👤 Admin user already exists');
        }
        
        // Create a test client user if it doesn't exist
        let testUser = await User.findOne({ email: 'test@example.com' });
        if (!testUser) {
            testUser = new User({
                nom: 'Test',
                prenom: 'User',
                email: 'test@example.com',
                telephone: '0123456789',
                adresse: 'Test Address',
                ville: 'Test City',
                wilaya: 'M\'Sila',
                password: 'test123', // Will be hashed by pre-save hook
                role: 'client',
                actif: true,
                dateInscription: new Date()
            });
            
            await testUser.save();
            console.log('✅ Test client user created');
            console.log('📧 Email: test@example.com');
            console.log('🔑 Password: test123');
        }
        
    } catch (error) {
        console.error('❌ Admin initialization error:', error);
        console.log('⚠️ Admin creation skipped, will retry...');
    }
}

// Database connection event handlers
mongoose.connection.on('connected', () => {
    console.log('🟢 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('🔴 Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('🟠 Mongoose disconnected');
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down gracefully...');
    await mongoose.connection.close();
    process.exit(0);
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('💥 Server error:', error);
    
    // Handle MongoDB validation errors
    if (error.name === 'ValidationError') {
        return res.status(400).json({
            message: 'Validation error',
            errors: Object.values(error.errors).map(err => err.message)
        });
    }
    
    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return res.status(400).json({
            message: `${field} already exists`
        });
    }
    
    // Handle JWT errors
    if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
            message: 'Invalid token'
        });
    }
    
    // Handle token expiration
    if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
            message: 'Token expired'
        });
    }
    
    // Default error response
    res.status(error.statusCode || 500).json({ 
        message: error.message || 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// 404 handler - MUST be last route
app.use('*', (req, res) => {
    console.log(`❓ Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        message: 'Route not found',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString(),
        availableEndpoints: [
            'GET /',
            'GET /api/health',
            'POST /api/auth/register',
            'POST /api/auth/login',
            'GET /api/auth/profile',
            'GET /api/products',
            'POST /api/orders',
            'GET /api/admin/dashboard'
        ]
    });
});

// Connect to database
connectDB();

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log('\n🚀 =================================');
    console.log(`🌟 Shifa Parapharmacie API Server`);
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📚 API base URL: http://localhost:${PORT}/api`);
    console.log('🚀 =================================\n');
});

// Handle server errors
server.on('error', (err) => {
    console.error('❌ Server error:', err);
    if (err.code === 'EADDRINUSE') {
        console.log(`⚠️ Port ${PORT} is already in use. Trying ${PORT + 1}...`);
        server.listen(PORT + 1);
    }
});

module.exports = app;
