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
        'https://parapharmacie-gaher.onrender.com'
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

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    if (req.body && Object.keys(req.body).length > 0) {
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
        endpoints: {
            health: '/api/health',
            auth: '/api/auth',
            products: '/api/products',
            admin: '/api/admin',
            orders: '/api/orders',
            settings: '/api/settings'
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

// DIRECT ROUTE LOADING
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
        console.log('Connecting to MongoDB...');
        
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI not set');
        }
        
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ MongoDB connected');
        
        // Initialize admin user
        await initializeAdmin();
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
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
                role: 'admin',
                actif: true,
                emailVerifie: true
            });
            
            await admin.save();
            console.log('✅ Admin user created');
        } else {
            console.log('✅ Admin user already exists');
        }
    } catch (error) {
        console.log('Admin creation skipped:', error.message);
    }
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({ 
            message: messages[0] || 'Données invalides',
            errors: messages
        });
    }
    
    if (error.name === 'CastError') {
        return res.status(400).json({ 
            message: 'Format d\'ID invalide' 
        });
    }
    
    if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return res.status(400).json({ 
            message: `${field} déjà utilisé` 
        });
    }
    
    res.status(error.status || 500).json({ 
        message: error.message || 'Erreur serveur',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use('*', (req, res) => {
    console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        message: 'Route non trouvée',
        path: req.originalUrl,
        method: req.method,
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
    console.log(`🔗 API Root: http://localhost:${PORT}/api`);
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
// Add this debugging code to your server.js file
console.log('🔧 DEBUG: Starting route loading diagnostics...');

// Test if orders.js file can be required at all
try {
    console.log('🔧 DEBUG: Testing require of orders.js...');
    const ordersRoutes = require('./routes/orders');
    console.log('🔧 DEBUG: ✅ orders.js required successfully');
    console.log('🔧 DEBUG: Type of ordersRoutes:', typeof ordersRoutes);
    
    // Try to mount the routes
    console.log('🔧 DEBUG: Attempting to mount /api/orders routes...');
    app.use('/api/orders', ordersRoutes);
    console.log('🔧 DEBUG: ✅ /api/orders routes mounted successfully');
    
} catch (error) {
    console.error('🔧 DEBUG: ❌ CRITICAL: Failed to load orders routes');
    console.error('🔧 DEBUG: Error message:', error.message);
    console.error('🔧 DEBUG: Error stack:', error.stack);
    
    // Create a fallback route to at least respond
    app.get('/api/orders/fallback', (req, res) => {
        res.json({
            error: 'Orders routes failed to load',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    });
}

// Test if auth routes are working
try {
    console.log('🔧 DEBUG: Testing auth routes...');
    const authRoutes = require('./routes/auth');
    console.log('🔧 DEBUG: ✅ Auth routes loaded successfully');
} catch (error) {
    console.error('🔧 DEBUG: ❌ Auth routes failed:', error.message);
}

// Add a debug route to test if server is responding
app.get('/api/debug', (req, res) => {
    console.log('🔧 DEBUG: Debug route accessed');
    res.json({
        message: 'Server debug route working',
        timestamp: new Date().toISOString(),
        routes: {
            orders: 'should be at /api/orders',
            ordersTest: 'should be at /api/orders/test',
            ordersDebug: 'should be at /api/orders/debug-status'
        }
    });
});

// List all registered routes for debugging
console.log('🔧 DEBUG: Listing all registered routes...');
app._router.stack.forEach(function(r, index) {
    if (r.route && r.route.path) {
        console.log(`🔧 DEBUG: Route ${index}: ${r.route.path}`);
    } else if (r.name === 'router') {
        console.log(`🔧 DEBUG: Router ${index}: ${r.regexp}`);
        if (r.handle && r.handle.stack) {
            r.handle.stack.forEach(function(rr, subIndex) {
                if (rr.route && rr.route.path) {
                    console.log(`🔧 DEBUG:   Sub-route ${subIndex}: ${rr.route.path}`);
                }
            });
        }
    }
});

console.log('🔧 DEBUG: Route loading diagnostics completed');

// Add this at the very end of your server.js, just before app.listen()
console.log('🔧 DEBUG: Server setup completed, starting server...'); 

module.exports = app;

