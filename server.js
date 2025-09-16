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
        'http://localhost:8080'
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
            routes: '/api/routes',
            auth: '/api/auth/*',
            products: '/api/products/*',
            orders: '/api/orders/*',
            admin: '/api/admin/*',
            settings: '/api/settings/*'
        }
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

// Routes information endpoint
app.get('/api/routes', (req, res) => {
    res.json({
        message: 'Available API Routes',
        routes: {
            auth: {
                'POST /api/auth/register': 'Register new user',
                'POST /api/auth/login': 'Login user',
                'GET /api/auth/profile': 'Get user profile',
                'PUT /api/auth/profile': 'Update user profile',
                'POST /api/auth/change-password': 'Change password'
            },
            products: {
                'GET /api/products': 'Get all products',
                'GET /api/products/:id': 'Get product by ID',
                'POST /api/products': 'Create product (admin)',
                'PUT /api/products/:id': 'Update product (admin)',
                'DELETE /api/products/:id': 'Delete product (admin)',
                'GET /api/products/categories/all': 'Get all categories',
                'GET /api/products/featured/all': 'Get featured products',
                'GET /api/products/promotions/all': 'Get promotion products'
            },
            orders: {
                'POST /api/orders': 'Create new order',
                'GET /api/orders': 'Get all orders (admin)',
                'GET /api/orders/user/all': 'Get user orders',
                'GET /api/orders/:id': 'Get order by ID',
                'PUT /api/orders/:id': 'Update order status',
                'DELETE /api/orders/:id': 'Delete order (admin)',
                'GET /api/orders/stats/dashboard': 'Get order statistics (admin)'
            },
            admin: {
                'GET /api/admin/dashboard': 'Get admin dashboard data',
                'GET /api/admin/products': 'Get products for admin',
                'GET /api/admin/orders': 'Get orders for admin'
            },
            settings: {
                'GET /api/settings': 'Get site settings',
                'PUT /api/settings': 'Update site settings (admin)'
            }
        },
        timestamp: new Date().toISOString()
    });
});

// DIRECT ROUTE LOADING - ENHANCED ERROR HANDLING
const loadedRoutes = [];

try {
    const authRoutes = require('./routes/auth');
    app.use('/api/auth', authRoutes);
    loadedRoutes.push('auth');
    console.log('✅ Auth routes loaded');
} catch (error) {
    console.error('❌ Auth routes failed:', error.message);
}

try {
    const productRoutes = require('./routes/products');
    app.use('/api/products', productRoutes);
    loadedRoutes.push('products');
    console.log('✅ Product routes loaded');
} catch (error) {
    console.error('❌ Product routes failed:', error.message);
}

try {
    const orderRoutes = require('./routes/orders');
    app.use('/api/orders', orderRoutes);
    loadedRoutes.push('orders');
    console.log('✅ Order routes loaded');
} catch (error) {
    console.error('❌ Order routes failed:', error.message);
    console.error('Full error:', error);
}

try {
    const adminRoutes = require('./routes/admin');
    app.use('/api/admin', adminRoutes);
    loadedRoutes.push('admin');
    console.log('✅ Admin routes loaded');
} catch (error) {
    console.error('❌ Admin routes failed:', error.message);
}

try {
    const settingsRoutes = require('./routes/settings');
    app.use('/api/settings', settingsRoutes);
    loadedRoutes.push('settings');
    console.log('✅ Settings routes loaded');
} catch (error) {
    console.error('❌ Settings routes failed:', error.message);
}

console.log(`📊 Loaded routes: ${loadedRoutes.join(', ')}`);

// MongoDB Connection
const connectDB = async () => {
    try {
        console.log('Connecting to MongoDB...');
        
        if (!process.env.MONGODB_URI) {
            console.warn('⚠️ MONGODB_URI not set - running without database');
            return;
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
        console.log('⚠️ Continuing without database - some features may not work');
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
            console.log('✅ Admin user exists');
        }
    } catch (error) {
        console.log('⚠️ Admin creation skipped:', error.message);
    }
}

// Error handling
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ 
        message: 'Erreur serveur',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// 404 handler - ENHANCED
app.use('*', (req, res) => {
    res.status(404).json({
        message: 'Route non trouvée',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString(),
        suggestion: 'Consultez /api/routes pour voir les endpoints disponibles',
        loadedRoutes: loadedRoutes,
        availableEndpoints: [
            'GET /',
            'GET /api/health',
            'GET /api/routes',
            ...loadedRoutes.map(route => `* /api/${route}/*`)
        ]
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
    console.log(`📚 Routes: http://localhost:${PORT}/api/routes`);
    console.log(`📊 Loaded ${loadedRoutes.length} route modules: ${loadedRoutes.join(', ')}`);
});

module.exports = app;
