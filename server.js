const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

const app = express();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads', 'products');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory');
}

// Configuration multer pour l'upload d'images
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Seules les images sont autorisées (jpeg, jpg, png, gif, webp)'));
        }
    }
});

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001',
            'http://localhost:5173',
            'http://localhost:8080',
            'https://anes255.github.io',
        ];
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log(`CORS: Allowing origin ${origin} for development`);
            callback(null, true);
        }
    },
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'x-auth-token',
        'Origin',
        'X-Requested-With',
        'Accept',
        'Cache-Control'
    ],
    exposedHeaders: ['x-auth-token'],
    maxAge: 86400
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    next();
});

// Request logging
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const origin = req.headers.origin || 'No origin';
    console.log(`${timestamp} - ${req.method} ${req.path} - Origin: ${origin}`);
    next();
});

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ROOT ROUTE
app.get('/', (req, res) => {
    res.json({
        message: 'Shifa Parapharmacie Backend API',
        status: 'running',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        endpoints: {
            health: '/api/health',
            auth: '/api/auth',
            products: '/api/products',
            orders: '/api/orders',
            admin: '/api/admin',
            settings: '/api/settings'
        }
    });
});

// API root endpoint
app.get('/api', (req, res) => {
    res.json({
        message: 'Shifa Parapharmacie API',
        version: '1.0.0',
        database: 'pharmacie-gaher',
        status: 'running',
        endpoints: {
            health: '/api/health',
            auth: '/api/auth (login, register, profile)',
            products: '/api/products (list, featured, categories)',
            orders: '/api/orders (create, list, status)',
            admin: '/api/admin (dashboard, management)',
            settings: '/api/settings (site configuration)'
        }
    });
});

// Enhanced health check route
app.get('/api/health', (req, res) => {
    const healthData = {
        message: 'Shifa Parapharmacie API is healthy!', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        status: 'healthy',
        database: {
            status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
            name: mongoose.connection.name || 'unknown',
            host: mongoose.connection.host || 'unknown'
        },
        uptime: Math.floor(process.uptime()),
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
        },
        cors: {
            enabled: true,
            credentials: corsOptions.credentials
        }
    };
    
    res.json(healthData);
});

// FIXED: Direct route loading instead of problematic loadRoutes function
async function loadRoutes() {
    try {
        // Load auth routes
        const authRoutes = require('./routes/auth');
        app.use('/api/auth', authRoutes);
        console.log('✅ Auth routes loaded');
    } catch (error) {
        console.error('❌ Failed to load auth routes:', error);
    }

    try {
        // Load product routes
        const productRoutes = require('./routes/products');
        app.use('/api/products', productRoutes);
        console.log('✅ Product routes loaded');
    } catch (error) {
        console.error('❌ Failed to load product routes:', error);
    }

    try {
        // Load order routes
        const orderRoutes = require('./routes/orders');
        app.use('/api/orders', orderRoutes);
        console.log('✅ Order routes loaded');
    } catch (error) {
        console.error('❌ Failed to load order routes:', error);
    }

    try {
        // Load admin routes
        const adminRoutes = require('./routes/admin');
        app.use('/api/admin', adminRoutes);
        console.log('✅ Admin routes loaded');
    } catch (error) {
        console.error('❌ Failed to load admin routes:', error);
    }

    try {
        // Load settings routes
        const settingsRoutes = require('./routes/settings');
        app.use('/api/settings', settingsRoutes);
        console.log('✅ Settings routes loaded');
    } catch (error) {
        console.error('❌ Failed to load settings routes:', error);
    }
}

// File upload routes
app.post('/api/upload', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Aucune image fournie' });
        }
        
        const imageUrl = `/uploads/products/${req.file.filename}`;
        res.json({ 
            message: 'Image uploadée avec succès',
            imageUrl: imageUrl,
            filename: req.file.filename,
            size: req.file.size
        });
        
    } catch (error) {
        console.error('Erreur upload image:', error);
        res.status(500).json({ message: 'Erreur lors de l\'upload de l\'image' });
    }
});

// MongoDB Connection
const connectDB = async () => {
    try {
        console.log('🔌 Attempting to connect to MongoDB...');
        
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI environment variable is not set');
        }
        
        const mongoOptions = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 15000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 2,
            maxIdleTimeMS: 30000,
            retryWrites: true,
            w: 'majority'
        };
        
        const conn = await mongoose.connect(process.env.MONGODB_URI, mongoOptions);
        
        console.log('✅ Connected to MongoDB Atlas');
        console.log('📊 Database:', conn.connection.name);
        console.log('🌐 Host:', conn.connection.host);
        
        // Set up connection event listeners
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB disconnected');
        });
        
        mongoose.connection.on('reconnected', () => {
            console.log('🔄 MongoDB reconnected');
        });
        
        // Initialize default data after successful connection
        await initializeDefaultData();
        
        // Load routes after database connection - THIS IS THE KEY FIX
        await loadRoutes();
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        console.log('🔄 Retrying connection in 10 seconds...');
        setTimeout(connectDB, 10000);
    }
};

// Initialize default data
async function initializeDefaultData() {
    try {
        console.log('🔧 Initializing default data...');
        
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
            }
        } catch (error) {
            console.warn('⚠️ Could not create admin user:', error.message);
        }

        try {
            const Settings = require('./models/Settings');
            let settings = await Settings.findOne();
            if (!settings) {
                settings = new Settings({
                    nomSite: 'Shifa - Parapharmacie Gaher',
                    slogan: 'Votre bien-être, notre mission naturelle',
                    fraisLivraison: 300,
                    livraisonGratuite: 5000
                });
                await settings.save();
                console.log('✅ Default settings created');
            }
        } catch (error) {
            console.warn('⚠️ Could not create settings:', error.message);
        }

        try {
            await createExampleProducts();
        } catch (error) {
            console.warn('⚠️ Could not create products:', error.message);
        }
        
    } catch (error) {
        console.error('⚠️ Error in default data initialization:', error.message);
    }
}

// Create example products
async function createExampleProducts() {
    try {
        const Product = require('./models/Product');
        const count = await Product.countDocuments();
        
        if (count === 0) {
            const exampleProducts = [
                {
                    nom: "Multivitamines VitalForce",
                    description: "Complexe de vitamines et minéraux pour booster votre énergie quotidienne.",
                    prix: 2800,
                    prixOriginal: 3200,
                    categorie: "Vitalité",
                    marque: "Shifa",
                    stock: 50,
                    enPromotion: true,
                    pourcentagePromotion: 12,
                    enVedette: true,
                    actif: true
                },
                {
                    nom: "Shampoing Anti-Chute L'Oréal",
                    description: "Shampoing fortifiant pour cheveux fragiles.",
                    prix: 2500,
                    categorie: "Cheveux",
                    marque: "L'Oréal",
                    stock: 25,
                    actif: true
                },
                {
                    nom: "Crème Hydratante Visage Avène",
                    description: "Crème hydratante apaisante pour peaux sensibles.",
                    prix: 3200,
                    categorie: "Visage",
                    marque: "Avène",
                    stock: 30,
                    enVedette: true,
                    actif: true
                }
            ];

            await Product.insertMany(exampleProducts);
            console.log(`✅ Created ${exampleProducts.length} example products`);
        }
    } catch (error) {
        console.warn('⚠️ Could not create example products:', error.message);
    }
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    
    if (error.name === 'CastError') {
        return res.status(400).json({ message: 'ID invalide' });
    }
    
    if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({ message: messages.join(', ') });
    }
    
    if (error.code === 11000) {
        return res.status(400).json({ message: 'Données dupliquées' });
    }
    
    res.status(error.status || 500).json({ 
        message: error.message || 'Erreur interne du serveur',
        timestamp: new Date().toISOString()
    });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ 
        message: 'Route API non trouvée',
        requestedPath: req.path,
        availableEndpoints: [
            '/api/health',
            '/api/auth',
            '/api/products', 
            '/api/orders',
            '/api/admin',
            '/api/settings'
        ],
        timestamp: new Date().toISOString()
    });
});

// 404 handler for all other routes
app.use('*', (req, res) => {
    res.status(404).json({
        message: 'Route non trouvée',
        requestedPath: req.path,
        suggestion: 'Essayez /api pour voir les endpoints disponibles',
        timestamp: new Date().toISOString()
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    try {
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed');
    } catch (error) {
        console.error('❌ Error closing MongoDB:', error);
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    try {
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed');
    } catch (error) {
        console.error('❌ Error closing MongoDB:', error);
    }
    process.exit(0);
});

// Connect to database first
connectDB();

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log('🚀 Shifa Parapharmacie Backend Started');
    console.log(`📡 Port: ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🥼 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`💚 Server ready to accept connections!`);
});
