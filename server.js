const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// CORS configuration - FIXED & ENHANCED
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:5173',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001',
            'http://127.0.0.1:5173',
            'https://parapharmacieshifa.com',
            'http://parapharmacieshifa.com',
            /\.parapharmacieshifa\.com$/, // Allow all subdomains
            /localhost:\d+$/, // Allow any localhost port
            /127\.0\.0\.1:\d+$/ // Allow any 127.0.0.1 port
        ];
        
        const isAllowed = allowedOrigins.some(allowed => {
            if (allowed instanceof RegExp) {
                return allowed.test(origin);
            }
            return allowed === origin;
        });
        
        if (isAllowed) {
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            callback(null, true); // Allow anyway for development
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'x-auth-token',
        'Origin',
        'X-Requested-With',
        'Accept',
        'Access-Control-Allow-Headers'
    ],
    exposedHeaders: ['x-auth-token'],
    maxAge: 86400 // 24 hours
};

// Apply CORS before other middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Body parsing middleware - ENHANCED
app.use(express.json({ 
    limit: '10mb',
    strict: true,
    verify: (req, res, buf, encoding) => {
        try {
            JSON.parse(buf);
        } catch (e) {
            console.error('Invalid JSON:', e.message);
            res.status(400).json({ message: 'Invalid JSON format' });
            throw new Error('Invalid JSON');
        }
    }
}));

app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb',
    parameterLimit: 50000
}));

// Request logging - ENHANCED
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`\n${timestamp} - ${req.method} ${req.path}`);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    
    if (req.body && Object.keys(req.body).length > 0) {
        // Log body but hide sensitive data
        const sanitizedBody = { ...req.body };
        if (sanitizedBody.password) sanitizedBody.password = '***HIDDEN***';
        console.log('Body:', JSON.stringify(sanitizedBody, null, 2));
    }
    
    next();
});

// ROOT ROUTE
app.get('/', (req, res) => {
    res.json({
        message: 'Shifa Parapharmacie Backend API',
        status: 'running',
        version: '1.0.0',
        timestamp: new Date().toISOString()
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

// Test endpoint for debugging
app.post('/api/test-body', (req, res) => {
    console.log('Test body received:', req.body);
    res.json({
        message: 'Body received successfully',
        body: req.body,
        contentType: req.headers['content-type']
    });
});

// ROUTE LOADING - DIRECT & SAFE
console.log('Loading API routes...');

// Auth routes
try {
    const authRoutes = require('./routes/auth');
    app.use('/api/auth', authRoutes);
    console.log('✅ Auth routes loaded');
} catch (error) {
    console.error('❌ Auth routes failed:', error.message);
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

// Admin routes
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

// MongoDB Connection with retry logic
const connectDB = async () => {
    try {
        console.log('Connecting to MongoDB...');
        
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI not set in environment variables');
        }
        
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        
        console.log('✅ MongoDB connected successfully');
        console.log('Database:', mongoose.connection.name);
        
        // Initialize admin user
        await initializeAdmin();
        
        // Setup connection event listeners
        mongoose.connection.on('disconnected', () => {
            console.log('⚠️ MongoDB disconnected. Attempting to reconnect...');
        });
        
        mongoose.connection.on('reconnected', () => {
            console.log('✅ MongoDB reconnected');
        });
        
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB error:', err);
        });
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        console.log('Retrying connection in 10 seconds...');
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
            console.log('Creating admin user...');
            
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
                actif: true
            });
            
            await admin.save();
            console.log('✅ Admin user created successfully');
            console.log('   Email: pharmaciegaher@gmail.com');
            console.log('   Password: anesaya75');
        } else {
            console.log('✅ Admin user already exists');
        }
    } catch (error) {
        console.error('❌ Admin initialization error:', error.message);
    }
}

// Error handling middleware - MUST BE AFTER ROUTES
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    
    // Handle specific error types
    if (err.name === 'ValidationError') {
        return res.status(400).json({ 
            message: 'Validation error',
            errors: Object.values(err.errors).map(e => e.message)
        });
    }
    
    if (err.name === 'CastError') {
        return res.status(400).json({ 
            message: 'Invalid ID format'
        });
    }
    
    if (err.code === 11000) {
        return res.status(400).json({ 
            message: 'Duplicate entry - resource already exists'
        });
    }
    
    // Default error response
    res.status(err.status || 500).json({ 
        message: err.message || 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// 404 handler - MUST BE LAST
app.use('*', (req, res) => {
    console.log('404 - Route not found:', req.method, req.originalUrl);
    res.status(404).json({
        message: 'Route not found',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});

// Connect to database
connectDB();

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('\n========================================');
    console.log('🚀 Shifa Parapharmacie Backend Server');
    console.log('========================================');
    console.log(`🌐 Server running on port ${PORT}`);
    console.log(`🔗 Local: http://localhost:${PORT}`);
    console.log(`🔗 Health: http://localhost:${PORT}/api/health`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('========================================\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close(false, () => {
            console.log('MongoDB connection closed');
            process.exit(0);
        });
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close(false, () => {
            console.log('MongoDB connection closed');
            process.exit(0);
        });
    });
});

module.exports = app;
