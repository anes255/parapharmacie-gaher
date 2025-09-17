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
        'https://anes255.github.io',
        'http://anes255.github.io',
        '*'  // Allow all origins for now - remove in production
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

// MongoDB Connection
const connectDB = async () => {
    try {
        console.log('🔄 Connecting to MongoDB...');
        
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/parapharmacie';
        
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ MongoDB connected successfully');
        
        // Initialize admin user after connection
        await initializeAdmin();
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        setTimeout(connectDB, 5000);
    }
};

// Initialize admin user
async function initializeAdmin() {
    try {
        console.log('🔄 Initializing admin user...');
        
        // Dynamic import of User model after connection
        const User = mongoose.model('User');
        
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
                password: 'anesaya75',
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
        
        // If User model doesn't exist, create it
        if (error.message.includes('Schema hasn\'t been registered') || error.message.includes('Cannot overwrite')) {
            console.log('Creating User model...');
            require('./models/User');
            setTimeout(initializeAdmin, 1000);
        }
    }
}

// Connect to database first
connectDB();

// Load routes AFTER database connection
app.use((req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ 
            message: 'Database not ready',
            status: 'connecting'
        });
    }
    next();
});

// Routes - Load in order
console.log('🔄 Loading routes...');

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

// Admin routes - MUST be after auth routes
try {
    const adminRoutes = require('./routes/admin');
    app.use('/api/admin', adminRoutes);
    console.log('✅ Admin routes loaded');
} catch (error) {
    console.error('❌ Admin routes failed:', error.message);
    
    // Create basic admin routes if file doesn't exist
    const router = express.Router();
    const auth = require('./middleware/auth');
    
    // Simple admin orders endpoint
    router.get('/orders', auth, async (req, res) => {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ message: 'Accès administrateur requis' });
            }
            
            const Order = mongoose.model('Order');
            const orders = await Order.find().sort({ dateCommande: -1 }).limit(50);
            
            res.json({ orders });
        } catch (error) {
            res.status(500).json({ message: 'Erreur serveur' });
        }
    });
    
    // Simple admin products endpoint
    router.get('/products', auth, async (req, res) => {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ message: 'Accès administrateur requis' });
            }
            
            const Product = mongoose.model('Product');
            const products = await Product.find().sort({ dateAjout: -1 });
            
            res.json({ products });
        } catch (error) {
            res.status(500).json({ message: 'Erreur serveur' });
        }
    });
    
    // Admin dashboard
    router.get('/dashboard', auth, async (req, res) => {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ message: 'Accès administrateur requis' });
            }
            
            res.json({ message: 'Admin dashboard', timestamp: new Date() });
        } catch (error) {
            res.status(500).json({ message: 'Erreur serveur' });
        }
    });
    
    app.use('/api/admin', router);
    console.log('✅ Fallback admin routes created');
}

// Settings routes (optional)
try {
    const settingsRoutes = require('./routes/settings');
    app.use('/api/settings', settingsRoutes);
    console.log('✅ Settings routes loaded');
} catch (error) {
    console.log('⚠️ Settings routes not found (optional)');
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('🚨 Server error:', error);
    
    if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
            message: messages[0] || 'Données invalides'
        });
    }
    
    if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return res.status(400).json({
            message: `${field === 'email' ? 'Email' : field} déjà utilisé`
        });
    }
    
    if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
            message: 'Token invalide'
        });
    }
    
    if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
            message: 'Token expiré'
        });
    }
    
    res.status(500).json({ 
        message: 'Erreur serveur interne',
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
        timestamp: new Date().toISOString()
    });
});

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`📚 API Base: http://localhost:${PORT}/api`);
    console.log(`\n✅ Server is ready to accept connections`);
});

module.exports = app;
