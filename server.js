const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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

// EMBEDDED AUTH ROUTES - THIS FIXES THE PROBLEM
// Middleware d'authentification
const auth = (req, res, next) => {
    const token = req.header('x-auth-token');

    if (!token) {
        return res.status(401).json({ message: 'Accès refusé - Token manquant' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (error) {
        console.error('Erreur vérification token:', error);
        res.status(401).json({ message: 'Token invalide' });
    }
};

// Inscription
app.post('/api/auth/register', async (req, res) => {
    try {
        const User = require('./models/User');
        const { nom, prenom, email, telephone, adresse, wilaya, password } = req.body;

        console.log('Tentative d\'inscription:', email);

        // Validation des données
        if (!nom || !prenom || !email || !password) {
            return res.status(400).json({ message: 'Tous les champs requis doivent être remplis' });
        }

        // Vérifier si l'utilisateur existe déjà   
        let user = await User.findOne({ email: email.toLowerCase() });
        if (user) {
            return res.status(400).json({ message: 'Un utilisateur avec cet email existe déjà' });
        }

        // Hashage du mot de passe
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Créer l'utilisateur
        user = new User({
            nom,
            prenom,
            email: email.toLowerCase(),
            telephone,
            adresse,
            wilaya,
            password: hashedPassword
        });

        await user.save();
        console.log('Utilisateur créé:', user.email, 'Role:', user.role);

        // Créer le token JWT
        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
            if (err) throw err;
            res.json({
                token,
                user: {
                    id: user.id,
                    nom: user.nom,
                    prenom: user.prenom,
                    email: user.email,
                    telephone: user.telephone,
                    adresse: user.adresse,
                    wilaya: user.wilaya,
                    role: user.role
                }
            });
        });

    } catch (error) {
        console.error('Erreur inscription:', error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'inscription' });
    }
});

// Connexion
app.post('/api/auth/login', async (req, res) => {
    try {
        const User = require('./models/User');
        console.log('Tentative de connexion pour:', req.body.email);
        const { email, password } = req.body;

        // Validation des données
        if (!email || !password) {
            console.log('Email ou mot de passe manquant');
            return res.status(400).json({ message: 'Email et mot de passe requis' });
        }

        console.log('Recherche de l\'utilisateur:', email.toLowerCase());

        // Vérifier si l'utilisateur existe - INCLURE LE MOT DE PASSE
        let user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        if (!user) {
            console.log('Utilisateur non trouvé:', email);
            return res.status(400).json({ message: 'Email ou mot de passe incorrect' });
        }

        console.log('Utilisateur trouvé:', user.email);
        console.log('Rôle:', user.role);
        console.log('Password hash présent:', !!user.password);

        // Vérifier que le mot de passe existe
        if (!user.password) {
            console.log('Mot de passe manquant dans la base de données pour:', email);
            return res.status(500).json({ message: 'Erreur de configuration du compte. Veuillez contacter l\'administrateur.' });
        }

        // Vérifier le mot de passe
        console.log('Vérification du mot de passe...');
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log('Mot de passe incorrect pour:', email);
            return res.status(400).json({ message: 'Email ou mot de passe incorrect' });
        }

        console.log('Authentification réussie pour:', user.email, 'Role:', user.role);

        // Vérifier que JWT_SECRET existe
        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET non défini');
            return res.status(500).json({ message: 'Configuration serveur incorrecte' });
        }

        // Créer le token JWT
        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        console.log('Token créé avec succès pour:', user.email);

        res.json({
            token,
            user: {
                id: user.id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                telephone: user.telephone,
                adresse: user.adresse,
                wilaya: user.wilaya,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Erreur connexion détaillée:', error);
        res.status(500).json({ 
            message: 'Erreur serveur lors de la connexion',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Profil utilisateur
app.get('/api/auth/profile', auth, async (req, res) => {
    try {
        const User = require('./models/User');
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        res.json(user);
    } catch (error) {
        console.error('Erreur récupération profil:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Mettre à jour le profil
app.put('/api/auth/profile', auth, async (req, res) => {
    try {
        const User = require('./models/User');
        const { nom, prenom, telephone, adresse, wilaya } = req.body;
        
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { nom, prenom, telephone, adresse, wilaya },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        res.json(user);
    } catch (error) {
        console.error('Erreur mise à jour profil:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Route de test pour vérifier l'état des utilisateurs
app.get('/api/auth/test-users', async (req, res) => {
    try {
        const User = require('./models/User');
        const users = await User.find({}).select('+password');
        const userInfo = users.map(user => ({
            email: user.email,
            role: user.role,
            hasPassword: !!user.password,
            passwordLength: user.password ? user.password.length : 0
        }));
        
        res.json({
            message: 'État des utilisateurs',
            users: userInfo,
            totalUsers: users.length
        });
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la récupération des utilisateurs' });
    }
});

// Load other routes safely
async function loadOtherRoutes() {
    try {
        const productRoutes = require('./routes/products');
        app.use('/api/products', productRoutes);
        console.log('Product routes loaded');
    } catch (error) {
        console.warn('Could not load product routes:', error.message);
    }

    try {
        const orderRoutes = require('./routes/orders');
        app.use('/api/orders', orderRoutes);
        console.log('Order routes loaded');
    } catch (error) {
        console.warn('Could not load order routes:', error.message);
    }

    try {
        const adminRoutes = require('./routes/admin');
        app.use('/api/admin', adminRoutes);
        console.log('Admin routes loaded');
    } catch (error) {
        console.warn('Could not load admin routes:', error.message);
    }

    try {
        const settingsRoutes = require('./routes/settings');
        app.use('/api/settings', settingsRoutes);
        console.log('Settings routes loaded');
    } catch (error) {
        console.warn('Could not load settings routes:', error.message);
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
        console.log('Attempting to connect to MongoDB...');
        
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
        
        console.log('Connected to MongoDB Atlas');
        console.log('Database:', conn.connection.name);
        console.log('Host:', conn.connection.host);
        
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.warn('MongoDB disconnected');
        });
        
        mongoose.connection.on('reconnected', () => {
            console.log('MongoDB reconnected');
        });
        
        await initializeDefaultData();
        await loadOtherRoutes();
        
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        console.log('Retrying connection in 10 seconds...');
        setTimeout(connectDB, 10000);
    }
};

// Initialize default data
async function initializeDefaultData() {
    try {
        console.log('Initializing default data...');
        
        try {
            const User = require('./models/User');
            
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
                console.log('Admin user created');
            }
        } catch (error) {
            console.warn('Could not create admin user:', error.message);
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
                console.log('Default settings created');
            }
        } catch (error) {
            console.warn('Could not create settings:', error.message);
        }

        try {
            await createExampleProducts();
        } catch (error) {
            console.warn('Could not create products:', error.message);
        }
        
    } catch (error) {
        console.error('Error in default data initialization:', error.message);
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
            console.log(`Created ${exampleProducts.length} example products`);
        }
    } catch (error) {
        console.warn('Could not create example products:', error.message);
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
    console.log('\nShutting down gracefully...');
    try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
    } catch (error) {
        console.error('Error closing MongoDB:', error);
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
    } catch (error) {
        console.error('Error closing MongoDB:', error);
    }
    process.exit(0);
});

// Connect to database first
connectDB();

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log('Shifa Parapharmacie Backend Started');
    console.log(`Port: ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Health Check: http://localhost:${PORT}/api/health`);
    console.log(`Auth endpoints: /api/auth/login, /api/auth/register`);
    console.log('Server ready to accept connections!');
});
