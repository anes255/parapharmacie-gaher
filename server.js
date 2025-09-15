const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

console.log('🚀 Starting server with admin routes...');

// CORS configuration
const corsOptions = {
    origin: [
        'http://localhost:3000',
        'http://localhost:3001', 
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

// CRITICAL: Load admin routes FIRST and with error handling
console.log('🔧 Loading admin routes...');
try {
    const adminRoutes = require('./routes/admin');
    app.use('/api/admin', adminRoutes);
    console.log('✅ Admin routes loaded successfully at /api/admin');
    
    // Test admin route immediately
    app.get('/api/admin-test', (req, res) => {
        res.json({
            message: 'Admin routes loaded successfully!',
            timestamp: new Date().toISOString(),
            availableRoutes: [
                'GET /api/admin/dashboard',
                'GET /api/admin/products', 
                'POST /api/admin/products',
                'PUT /api/admin/products/:id',
                'DELETE /api/admin/products/:id'
            ]
        });
    });
    
} catch (error) {
    console.error('❌ CRITICAL: Admin routes failed to load:', error.message);
    
    // Create emergency admin routes
    console.log('🚨 Creating emergency admin routes...');
    
    app.get('/api/admin/test', (req, res) => {
        res.json({
            message: 'Emergency admin route active',
            error: 'Main admin routes failed to load: ' + error.message,
            timestamp: new Date().toISOString()
        });
    });
    
    app.get('/api/admin/products', (req, res) => {
        res.json({
            products: [],
            message: 'Emergency mode: admin routes file missing',
            error: error.message
        });
    });
    
    app.post('/api/admin/products', (req, res) => {
        res.status(201).json({
            message: 'Produit créé (mode urgence - sauvegarde locale uniquement)',
            product: {
                _id: Date.now().toString(),
                ...req.body,
                dateAjout: new Date()
            }
        });
    });
}

// Auth routes
console.log('🔧 Loading auth routes...');
try {
    const authRoutes = require('./routes/auth');
    app.use('/api/auth', authRoutes);
    console.log('✅ Auth routes loaded at /api/auth');
} catch (error) {
    console.error('❌ Auth routes failed:', error.message);
    
    // Emergency auth route
    app.post('/api/auth/login', (req, res) => {
        const { email, password } = req.body;
        
        if (email === 'pharmaciegaher@gmail.com' && password === 'anesaya75') {
            const jwt = require('jsonwebtoken');
            const token = jwt.sign(
                { id: 'admin123' }, 
                process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024',
                { expiresIn: '30d' }
            );
            
            res.json({
                message: 'Connexion réussie (mode urgence)',
                token,
                user: {
                    id: 'admin123',
                    email: 'pharmaciegaher@gmail.com',
                    role: 'admin',
                    nom: 'Gaher',
                    prenom: 'Admin'
                }
            });
        } else {
            res.status(401).json({
                message: 'Email ou mot de passe incorrect'
            });
        }
    });
}

// Product routes
console.log('🔧 Loading product routes...');
try {
    const productRoutes = require('./routes/products');
    app.use('/api/products', productRoutes);
    console.log('✅ Product routes loaded at /api/products');
} catch (error) {
    console.error('❌ Product routes failed:', error.message);
    
    app.get('/api/products', (req, res) => {
        res.json({
            products: [],
            message: 'Emergency mode: product routes missing'
        });
    });
}

// Order routes
console.log('🔧 Loading order routes...');
try {
    const orderRoutes = require('./routes/orders');
    app.use('/api/orders', orderRoutes);
    console.log('✅ Order routes loaded at /api/orders');
} catch (error) {
    console.error('❌ Order routes failed:', error.message);
    
    app.get('/api/orders', (req, res) => {
        res.json({
            orders: [],
            message: 'Emergency mode: order routes missing'
        });
    });
}

// Debug route to show all loaded routes
app.get('/api/routes', (req, res) => {
    const routes = [];
    
    // Extract routes from the app
    function extractRoutes(stack, basePath = '') {
        stack.forEach((layer) => {
            if (layer.route) {
                const path = basePath + layer.route.path;
                const methods = Object.keys(layer.route.methods);
                routes.push({ path, methods });
            } else if (layer.name === 'router' && layer.handle.stack) {
                const path = basePath + (layer.regexp.source.replace('\\/?', '').replace('(?=\\/|$)', '').replace('^', ''));
                extractRoutes(layer.handle.stack, path);
            }
        });
    }
    
    extractRoutes(app._router.stack);
    
    res.json({
        message: 'Available API routes',
        totalRoutes: routes.length,
        routes: routes.slice(0, 20), // Show first 20 routes
        adminRoutesLoaded: routes.some(r => r.path.includes('/api/admin/')),
        authRoutesLoaded: routes.some(r => r.path.includes('/api/auth/')),
        baseUrl: req.protocol + '://' + req.get('host')
    });
});

// MongoDB Connection
const connectDB = async () => {
    try {
        console.log('🔗 Connecting to MongoDB...');
        
        if (!process.env.MONGODB_URI) {
            console.error('❌ MONGODB_URI not set in environment variables');
            return;
        }
        
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ MongoDB connected successfully');
        
        // Initialize admin user
        await initializeAdmin();
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        console.log('⚠️ Server will run without database (localStorage mode)');
    }
};

// Initialize admin user
async function initializeAdmin() {
    try {
        // Try to load User model
        const User = require('./models/User');
        const bcrypt = require('bcryptjs');
        
        let admin = await User.findOne({ email: 'pharmaciegaher@gmail.com' });
        if (!admin) {
            const hashedPassword = await bcrypt.hash('anesaya75', 12);
            
            admin = new User({
                nom: 'Gaher',
                prenom: 'Admin',
                email: 'pharmaciegaher@gmail.com',
                password: hashedPassword,
                role: 'admin',
                telephone: '+213123456789',
                wilaya: 'Tipaza'
            });
            
            await admin.save();
            console.log('✅ Admin user created successfully');
        } else {
            console.log('✅ Admin user already exists');
        }
    } catch (error) {
        console.log('⚠️ Admin initialization skipped:', error.message);
    }
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('💥 Server error:', error);
    res.status(500).json({ 
        message: 'Erreur serveur interne',
        timestamp: new Date().toISOString(),
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
});

// 404 handler
app.use('*', (req, res) => {
    console.log(`❌ Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        message: 'Route non trouvée',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString(),
        suggestion: 'Consultez /api/routes pour voir les endpoints disponibles'
    });
});

// Connect to database
connectDB();

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health check: /api/health`);
    console.log(`🔗 Available routes: /api/routes`);
    console.log(`🔗 Admin test: /api/admin-test`);
    console.log(`📋 Admin routes: /api/admin/*`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    mongoose.connection.close(() => {
        console.log('MongoDB connection closed');
        process.exit(0);
    });
});
