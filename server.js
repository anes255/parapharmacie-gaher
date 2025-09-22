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
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
    next();
});

// ROOT ROUTE
app.get('/', (req, res) => {
    res.json({
        message: 'Shifa Parapharmacie Backend API',
        status: 'running',
        timestamp: new Date().toISOString()
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        message: 'API is healthy',
        timestamp: new Date().toISOString(),
        status: 'running'
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

// FIXED MongoDB Connection - Removed deprecated options
const connectDB = async () => {
    try {
        console.log('🔗 Connecting to MongoDB...');
        
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI not set');
        }
        
        // Debug environment variables
        console.log('📍 MongoDB URI (masked):', process.env.MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
        console.log('🔍 URI length:', process.env.MONGODB_URI.length);
        console.log('🔍 Contains buffermaxentries?', process.env.MONGODB_URI.includes('buffermaxentries'));
        
        // Check for hidden characters or encoding issues
        const cleanURI = process.env.MONGODB_URI.trim();
        console.log('🧹 Cleaned URI length:', cleanURI.length);
        
        // FIXED: Use modern connection without deprecated options
        // Removed useNewUrlParser and useUnifiedTopology as they're deprecated
        await mongoose.connect(cleanURI);
        
        console.log('✅ MongoDB connected successfully');
        
        // Monitor connection events
        mongoose.connection.on('connected', () => {
            console.log('✅ Mongoose connected to MongoDB');
        });
        
        mongoose.connection.on('error', (err) => {
            console.error('❌ Mongoose connection error:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.log('⚠️ MongoDB disconnected');
        });
        
        // Handle process termination
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            console.log('👋 MongoDB connection closed through app termination');
            process.exit(0);
        });
        
        // Initialize admin user
        await initializeAdmin();
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        console.error('🚨 MongoDB connection error:', error);
        
        // Retry after 10 seconds
        console.log('🔄 Retrying connection in 10 seconds...');
        setTimeout(connectDB, 10000);
    }
};

// Initialize admin user
async function initializeAdmin() {
    try {
        const User = require('./models/User');
        const bcrypt = require('bcryptjs');
        
        let admin = await User.findOne({ email: 'pharmaciegaher@gmail.com' });
        if (!admin) {
            const salt = bcrypt.genSaltSync(12);
            const hashedPassword = bcrypt.hashSync('anesaya75', salt);
            
            admin = new User({
                nom: 'Gaher',
                prenom: 'Parapharmacie',
                email: 'pharmaciegaher@gmail.com',
                telephone: '+213123456789',
                adresse: 'Tipaza, Algérie',
                wilaya: 'Tipaza',
                password: hashedPassword,
                role: 'admin'
            });
            
            await admin.save();
            console.log('✅ Admin user created');
        } else {
            console.log('✅ Admin user already exists');
        }
    } catch (error) {
        console.log('⚠️ Admin creation skipped:', error.message);
    }
}

// Enhanced error handling middleware
app.use((error, req, res, next) => {
    console.error('🚨 Server error:', error);
    
    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(500).json({ 
        message: 'Erreur serveur',
        timestamp: new Date().toISOString(),
        ...(isDevelopment && { error: error.message, stack: error.stack })
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        message: 'Route non trouvée',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
    });
});

// Connect to database
connectDB();

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health: http://localhost:${PORT}/api/health`);
    console.log(`📊 API Base: http://localhost:${PORT}/api`);
    
    // Log package versions for debugging
    try {
        console.log(`📦 Mongoose version: ${require('mongoose/package.json').version}`);
        console.log(`📦 Node.js version: ${process.version}`);
    } catch (error) {
        console.log('⚠️ Could not read package versions');
    }
});
