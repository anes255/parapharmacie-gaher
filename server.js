const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Enhanced logging
const log = (message, type = 'INFO') => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type}] ${message}`);
};

log('Starting Shifa Parapharmacie Backend Server...');

// CORS configuration - Enhanced
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

// Enhanced middleware with error handling
app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf, encoding) => {
        try {
            JSON.parse(buf);
        } catch (err) {
            log(`Invalid JSON in request: ${err.message}`, 'ERROR');
            res.status(400).json({ message: 'Invalid JSON format' });
            return;
        }
    }
}));

app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced request logging
app.use((req, res, next) => {
    const start = Date.now();
    
    // Log request
    log(`${req.method} ${req.path} - IP: ${req.ip} - User-Agent: ${req.get('User-Agent')?.substring(0, 50)}...`);
    
    // Log request body for debugging (only for POST/PUT)
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.path.includes('/orders')) {
        log(`Request Body: ${JSON.stringify(req.body, null, 2)}`, 'DEBUG');
    }
    
    // Log response time
    res.on('finish', () => {
        const duration = Date.now() - start;
        log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    });
    
    next();
});

// Database connection status
let dbConnected = false;
let dbError = null;

// ROOT ROUTE with enhanced status
app.get('/', (req, res) => {
    res.json({
        message: 'Shifa Parapharmacie Backend API',
        status: 'running',
        database: dbConnected ? 'connected' : 'disconnected',
        databaseError: dbError,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0'
    });
});

// Enhanced health check with database status
app.get('/api/health', async (req, res) => {
    const health = {
        status: 'running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: {
            connected: dbConnected,
            error: dbError,
            readyState: mongoose.connection.readyState
        },
        memory: process.memoryUsage(),
        routes: {
            auth: false,
            products: false,
            orders: false,
            admin: false,
            settings: false
        }
    };
    
    // Test database connection
    try {
        if (dbConnected) {
            await mongoose.connection.db.admin().ping();
            health.database.ping = 'success';
        }
    } catch (error) {
        health.database.ping = 'failed';
        health.database.pingError = error.message;
    }
    
    res.json(health);
});

// Debug endpoint for testing order creation
app.post('/api/debug/order-test', async (req, res) => {
    try {
        log('Order test endpoint called', 'DEBUG');
        log(`Request body: ${JSON.stringify(req.body, null, 2)}`, 'DEBUG');
        
        // Test basic order model creation without saving
        const Order = require('./models/Order');
        
        const testOrder = new Order({
            numeroCommande: `TEST${Date.now()}`,
            client: {
                prenom: 'Test',
                nom: 'User',
                email: 'test@example.com',
                telephone: '0123456789',
                adresse: 'Test Address',
                wilaya: 'Tipaza'
            },
            articles: [{
                productId: 'test123',
                nom: 'Test Product',
                prix: 100,
                quantite: 1
            }],
            sousTotal: 100,
            fraisLivraison: 0,
            total: 100
        });
        
        // Validate without saving
        const validationError = testOrder.validateSync();
        if (validationError) {
            log(`Validation error: ${JSON.stringify(validationError.errors)}`, 'ERROR');
            return res.status(400).json({
                message: 'Validation failed',
                errors: validationError.errors
            });
        }
        
        log('Test order validation passed', 'DEBUG');
        res.json({
            message: 'Order test passed',
            validationResult: 'success',
            testOrder: testOrder.toObject()
        });
        
    } catch (error) {
        log(`Order test error: ${error.message}`, 'ERROR');
        log(`Error stack: ${error.stack}`, 'ERROR');
        res.status(500).json({
            message: 'Order test failed',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// ROUTE LOADING with enhanced error handling
const loadRoutes = () => {
    try {
        const authRoutes = require('./routes/auth');
        app.use('/api/auth', authRoutes);
        log('Auth routes loaded successfully');
    } catch (error) {
        log(`Auth routes failed: ${error.message}`, 'ERROR');
        log(`Auth routes stack: ${error.stack}`, 'ERROR');
    }

    try {
        const productRoutes = require('./routes/products');
        app.use('/api/products', productRoutes);
        log('Product routes loaded successfully');
    } catch (error) {
        log(`Product routes failed: ${error.message}`, 'ERROR');
        log(`Product routes stack: ${error.stack}`, 'ERROR');
    }

    try {
        const orderRoutes = require('./routes/orders');
        app.use('/api/orders', orderRoutes);
        log('Order routes loaded successfully');
    } catch (error) {
        log(`Order routes failed: ${error.message}`, 'ERROR');
        log(`Order routes stack: ${error.stack}`, 'ERROR');
    }

    try {
        const adminRoutes = require('./routes/admin');
        app.use('/api/admin', adminRoutes);
        log('Admin routes loaded successfully');
    } catch (error) {
        log(`Admin routes failed: ${error.message}`, 'ERROR');
        log(`Admin routes stack: ${error.stack}`, 'ERROR');
    }

    try {
        const settingsRoutes = require('./routes/settings');
        app.use('/api/settings', settingsRoutes);
        log('Settings routes loaded successfully');
    } catch (error) {
        log(`Settings routes failed: ${error.message}`, 'ERROR');
        log(`Settings routes stack: ${error.stack}`, 'ERROR');
    }
};

// Enhanced MongoDB Connection with better error handling
const connectDB = async () => {
    try {
        log('Attempting MongoDB connection...');
        
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI environment variable not set');
        }
        
        log(`MongoDB URI: ${process.env.MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
        
        // Enhanced connection options
        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4
        };
        
        await mongoose.connect(process.env.MONGODB_URI, options);
        
        dbConnected = true;
        dbError = null;
        log('MongoDB connected successfully');
        
        // Add connection event listeners
        mongoose.connection.on('error', (error) => {
            dbError = error.message;
            log(`MongoDB error: ${error.message}`, 'ERROR');
        });
        
        mongoose.connection.on('disconnected', () => {
            dbConnected = false;
            log('MongoDB disconnected', 'WARN');
        });
        
        mongoose.connection.on('reconnected', () => {
            dbConnected = true;
            dbError = null;
            log('MongoDB reconnected');
        });
        
        // Test the connection
        await mongoose.connection.db.admin().ping();
        log('MongoDB ping successful');
        
        // Initialize admin user
        await initializeAdmin();
        
        // Load routes after successful DB connection
        loadRoutes();
        
    } catch (error) {
        dbConnected = false;
        dbError = error.message;
        log(`MongoDB connection failed: ${error.message}`, 'ERROR');
        log(`MongoDB error stack: ${error.stack}`, 'ERROR');
        
        // Retry connection after 10 seconds
        log('Retrying MongoDB connection in 10 seconds...', 'WARN');
        setTimeout(connectDB, 10000);
    }
};

// Enhanced admin initialization
async function initializeAdmin() {
    try {
        log('Initializing admin user...');
        
        const User = require('./models/User');
        const bcrypt = require('bcryptjs');
        
        let admin = await User.findOne({ email: 'pharmaciegaher@gmail.com' });
        if (!admin) {
            log('Creating admin user...');
            
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
                role: 'admin',
                dateInscription: new Date()
            });
            
            await admin.save();
            log('Admin user created successfully');
        } else {
            log('Admin user already exists');
        }
    } catch (error) {
        log(`Admin initialization failed: ${error.message}`, 'ERROR');
        log(`Admin error stack: ${error.stack}`, 'ERROR');
    }
}

// Enhanced error handling middleware
app.use((error, req, res, next) => {
    log(`Unhandled error: ${error.message}`, 'ERROR');
    log(`Error stack: ${error.stack}`, 'ERROR');
    log(`Request: ${req.method} ${req.path}`, 'ERROR');
    log(`Request body: ${JSON.stringify(req.body)}`, 'ERROR');
    
    // Determine error type and respond appropriately
    if (error.name === 'ValidationError') {
        return res.status(400).json({
            message: 'Validation error',
            details: Object.values(error.errors).map(err => err.message),
            timestamp: new Date().toISOString()
        });
    }
    
    if (error.name === 'CastError') {
        return res.status(400).json({
            message: 'Invalid data format',
            field: error.path,
            value: error.value,
            timestamp: new Date().toISOString()
        });
    }
    
    if (error.code === 11000) {
        return res.status(409).json({
            message: 'Duplicate entry',
            field: Object.keys(error.keyPattern)[0],
            timestamp: new Date().toISOString()
        });
    }
    
    // Generic server error
    res.status(500).json({ 
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
        error: process.env.NODE_ENV === 'development' ? {
            message: error.message,
            stack: error.stack
        } : undefined
    });
});

// Enhanced 404 handler
app.use('*', (req, res) => {
    log(`404 - Route not found: ${req.method} ${req.originalUrl}`, 'WARN');
    res.status(404).json({
        message: 'Route not found',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString(),
        availableRoutes: [
            'GET /',
            'GET /api/health',
            'POST /api/debug/order-test',
            'POST /api/auth/login',
            'POST /api/auth/register',
            'GET /api/products',
            'POST /api/orders',
            'GET /api/admin/dashboard'
        ]
    });
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
    log('SIGTERM received, shutting down gracefully...');
    
    try {
        await mongoose.connection.close();
        log('MongoDB connection closed');
    } catch (error) {
        log(`Error closing MongoDB: ${error.message}`, 'ERROR');
    }
    
    process.exit(0);
});

process.on('SIGINT', async () => {
    log('SIGINT received, shutting down gracefully...');
    
    try {
        await mongoose.connection.close();
        log('MongoDB connection closed');
    } catch (error) {
        log(`Error closing MongoDB: ${error.message}`, 'ERROR');
    }
    
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    log(`Uncaught Exception: ${error.message}`, 'ERROR');
    log(`Stack: ${error.stack}`, 'ERROR');
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    log(`Unhandled Rejection at: ${promise}, reason: ${reason}`, 'ERROR');
    process.exit(1);
});

// Connect to database
connectDB();

// Start server
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, '0.0.0.0', () => {
    log(`Server running on port ${PORT}`);
    log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    log(`Health check: http://localhost:${PORT}/api/health`);
    log(`Debug endpoint: http://localhost:${PORT}/api/debug/order-test`);
    log(`Process ID: ${process.pid}`);
    log(`Node version: ${process.version}`);
});

// Server error handling
server.on('error', (error) => {
    if (error.syscall !== 'listen') {
        throw error;
    }
    
    const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;
    
    switch (error.code) {
        case 'EACCES':
            log(`${bind} requires elevated privileges`, 'ERROR');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            log(`${bind} is already in use`, 'ERROR');
            process.exit(1);
            break;
        default:
            throw error;
    }
});

module.exports = app;
