const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// CORS configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// User Schema
const UserSchema = new mongoose.Schema({
    nom: { type: String, required: true },
    prenom: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },
    telephone: { type: String, required: true },
    adresse: String,
    ville: String,
    wilaya: { type: String, required: true },
    codePostal: String,
    role: { type: String, enum: ['client', 'admin'], default: 'client' },
    actif: { type: Boolean, default: true },
    dateInscription: { type: Date, default: Date.now },
    dernierConnexion: Date
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Compare password method
UserSchema.methods.comparePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
};

const User = mongoose.model('User', UserSchema);

// Product Schema
const ProductSchema = new mongoose.Schema({
    nom: { type: String, required: true },
    description: String,
    prix: { type: Number, required: true },
    prixPromo: Number,
    image: String,
    images: [String],
    categorie: { type: String, required: true },
    sousCategorie: String,
    stock: { type: Number, default: 0 },
    actif: { type: Boolean, default: true },
    vedette: { type: Boolean, default: false },
    promotion: { type: Boolean, default: false },
    dateAjout: { type: Date, default: Date.now },
    dateModification: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', ProductSchema);

// Order Schema - SIMPLIFIED to avoid validation issues
const OrderSchema = new mongoose.Schema({
    utilisateur: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    produits: [{
        produit: String, // String instead of ObjectId to avoid reference issues
        nom: String,
        prix: Number,
        quantite: Number,
        total: Number
    }],
    montantTotal: Number,
    statut: {
        type: String,
        default: 'en_attente'
    },
    modeLivraison: {
        type: String,
        default: 'domicile'
    },
    adresseLivraison: {
        nom: String,
        prenom: String,
        adresse: String,
        ville: String,
        wilaya: String,
        codePostal: String,
        telephone: String
    },
    notes: String,
    dateCommande: { type: Date, default: Date.now },
    dateModification: { type: Date, default: Date.now }
}, { strict: false }); // Allow additional fields

const Order = mongoose.model('Order', OrderSchema);

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024', {
        expiresIn: '30d'
    });
};

// Auth middleware
const auth = async (req, res, next) => {
    try {
        const token = req.header('x-auth-token');
        if (!token) {
            return res.status(401).json({ message: 'Token manquant' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024');
        const user = await User.findById(decoded.id);
        
        if (!user) {
            return res.status(401).json({ message: 'Utilisateur non trouvé' });
        }

        req.user = { id: user._id, role: user.role };
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token invalide' });
    }
};

// Admin middleware
const adminAuth = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Accès refusé - droits administrateur requis' });
    }
};

// ROOT ROUTE
app.get('/', (req, res) => {
    res.json({
        message: 'Shifa Parapharmacie API',
        status: 'running',
        timestamp: new Date().toISOString()
    });
});

// HEALTH CHECK
app.get('/api/health', (req, res) => {
    res.json({
        message: 'API is healthy',
        status: 'running',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// AUTH ROUTES
// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        console.log('📝 Registration attempt:', req.body.email);
        
        const { nom, prenom, email, password, telephone, wilaya, adresse, ville, codePostal } = req.body;
        
        if (!nom || !prenom || !email || !password || !telephone || !wilaya) {
            return res.status(400).json({ message: 'Tous les champs requis doivent être remplis' });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ message: 'Un utilisateur avec cet email existe déjà' });
        }

        const existingPhone = await User.findOne({ telephone });
        if (existingPhone) {
            return res.status(400).json({ message: 'Ce numéro de téléphone est déjà utilisé' });
        }

        const user = new User({
            nom: nom.trim(),
            prenom: prenom.trim(),
            email: email.toLowerCase().trim(),
            password,
            telephone: telephone.replace(/\s+/g, ''),
            adresse: adresse || '',
            ville: ville || '',
            wilaya,
            codePostal: codePostal || ''
        });

        await user.save();
        console.log('✅ User registered:', user.email);

        const token = generateToken(user._id);
        
        res.status(201).json({
            message: 'Inscription réussie',
            token,
            user: {
                id: user._id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                telephone: user.telephone,
                adresse: user.adresse,
                ville: user.ville,
                wilaya: user.wilaya,
                role: user.role
            }
        });

    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'inscription' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        console.log('🔐 Login attempt:', req.body.email);
        
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ message: 'Email et mot de passe requis' });
        }

        const user = await User.findOne({ 
            email: email.toLowerCase(),
            actif: true 
        }).select('+password');

        if (!user) {
            console.log('❌ User not found:', email);
            return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log('❌ Password mismatch for:', email);
            return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
        }

        console.log('✅ Login successful:', user.email, 'Role:', user.role);

        const token = generateToken(user._id);
        
        // Update last connection
        user.dernierConnexion = new Date();
        await user.save();

        res.json({
            message: 'Connexion réussie',
            token,
            user: {
                id: user._id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                telephone: user.telephone,
                adresse: user.adresse,
                ville: user.ville,
                wilaya: user.wilaya,
                role: user.role,
                dateInscription: user.dateInscription,
                dernierConnexion: user.dernierConnexion
            }
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la connexion' });
    }
});

// Get Profile
app.get('/api/auth/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        res.json({
            id: user._id,
            nom: user.nom,
            prenom: user.prenom,
            email: user.email,
            telephone: user.telephone,
            adresse: user.adresse,
            ville: user.ville,
            wilaya: user.wilaya,
            codePostal: user.codePostal,
            role: user.role,
            dateInscription: user.dateInscription,
            dernierConnexion: user.dernierConnexion
        });

    } catch (error) {
        console.error('❌ Profile error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// PRODUCT ROUTES
// Get All Products
app.get('/api/products', async (req, res) => {
    try {
        console.log('🛍️ Getting products');
        
        const { categorie, promotion, vedette, limit, page } = req.query;
        const query = { actif: true };
        
        if (categorie) query.categorie = categorie;
        if (promotion === 'true') query.promotion = true;
        if (vedette === 'true') query.vedette = true;
        
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 50;
        const skip = (pageNum - 1) * limitNum;
        
        const products = await Product.find(query)
            .sort({ dateAjout: -1 })
            .skip(skip)
            .limit(limitNum);
            
        const totalProducts = await Product.countDocuments(query);
        
        console.log(`✅ Found ${products.length} products`);
        
        res.json({
            products,
            totalProducts,
            currentPage: pageNum,
            totalPages: Math.ceil(totalProducts / limitNum)
        });
        
    } catch (error) {
        console.error('❌ Products error:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération des produits' });
    }
});

// Get Product by ID
app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Produit non trouvé' });
        }
        res.json(product);
    } catch (error) {
        console.error('❌ Get product error:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération du produit' });
    }
});

// Get Categories
app.get('/api/products/categories/all', async (req, res) => {
    try {
        const categories = await Product.distinct('categorie', { actif: true });
        res.json({ categories });
    } catch (error) {
        console.error('❌ Categories error:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération des catégories' });
    }
});

// Get Featured Products
app.get('/api/products/featured/all', async (req, res) => {
    try {
        const products = await Product.find({ vedette: true, actif: true })
            .sort({ dateAjout: -1 })
            .limit(8);
        res.json({ products });
    } catch (error) {
        console.error('❌ Featured products error:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération des produits vedettes' });
    }
});

// Get Promotion Products
app.get('/api/products/promotions/all', async (req, res) => {
    try {
        const products = await Product.find({ promotion: true, actif: true })
            .sort({ dateAjout: -1 })
            .limit(12);
        res.json({ products });
    } catch (error) {
        console.error('❌ Promotion products error:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération des promotions' });
    }
});

// ORDER ROUTES
// Create Order - SIMPLIFIED AND FIXED
app.post('/api/orders', async (req, res) => {
    try {
        console.log('📦 Creating order - SIMPLIFIED');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        
        // Get user ID if authenticated (optional)
        let userId = null;
        const token = req.header('x-auth-token');
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024');
                const user = await User.findById(decoded.id);
                if (user) {
                    userId = user._id;
                    console.log('✅ Authenticated user found:', user.email);
                }
            } catch (tokenError) {
                console.log('⚠️ Token validation failed, proceeding as guest');
            }
        } else {
            console.log('ℹ️ No token provided, creating guest order');
        }
        
        // Basic validation
        if (!req.body.montantTotal || req.body.montantTotal <= 0) {
            console.log('❌ Invalid total amount:', req.body.montantTotal);
            return res.status(400).json({ message: 'Montant total invalide' });
        }

        if (!req.body.produits || !Array.isArray(req.body.produits) || req.body.produits.length === 0) {
            console.log('❌ No products in order');
            return res.status(400).json({ message: 'Aucun produit dans la commande' });
        }

        if (!req.body.adresseLivraison || !req.body.adresseLivraison.nom || !req.body.adresseLivraison.prenom) {
            console.log('❌ Missing delivery address');
            return res.status(400).json({ message: 'Adresse de livraison incomplète' });
        }
        
        // Create order with minimal validation
        const orderData = {
            utilisateur: userId,
            produits: req.body.produits.map(p => ({
                produit: p.produit || 'unknown',
                nom: p.nom || 'Produit',
                prix: p.prix || 0,
                quantite: p.quantite || 1,
                total: p.total || (p.prix * p.quantite) || 0
            })),
            montantTotal: req.body.montantTotal,
            statut: 'en_attente',
            modeLivraison: req.body.modeLivraison || 'domicile',
            adresseLivraison: {
                nom: req.body.adresseLivraison.nom || '',
                prenom: req.body.adresseLivraison.prenom || '',
                adresse: req.body.adresseLivraison.adresse || '',
                ville: req.body.adresseLivraison.ville || '',
                wilaya: req.body.adresseLivraison.wilaya || '',
                codePostal: req.body.adresseLivraison.codePostal || '',
                telephone: req.body.adresseLivraison.telephone || ''
            },
            notes: req.body.notes || '',
            dateCommande: new Date(),
            dateModification: new Date()
        };
        
        console.log('📋 Order data to save:', JSON.stringify(orderData, null, 2));
        
        // Create and save order
        const order = new Order(orderData);
        const savedOrder = await order.save();
        
        console.log('✅ Order saved successfully with ID:', savedOrder._id);
        
        res.status(201).json({
            message: 'Commande créée avec succès',
            order: savedOrder,
            orderId: savedOrder._id
        });
        
    } catch (error) {
        console.error('❌ DETAILED ORDER CREATION ERROR:');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        if (error.errors) {
            console.error('Validation errors:', error.errors);
        }
        
        // Send detailed error in development
        const errorResponse = {
            message: 'Erreur serveur lors de la création de la commande',
            timestamp: new Date().toISOString()
        };
        
        // Add detailed error info for debugging
        if (process.env.NODE_ENV !== 'production') {
            errorResponse.error = {
                name: error.name,
                message: error.message,
                stack: error.stack
            };
        }
        
        res.status(500).json(errorResponse);
    }
});

// Test route for debugging
app.post('/api/test-order', async (req, res) => {
    try {
        console.log('🧪 Test order creation');
        console.log('Test request body:', req.body);
        
        const testOrder = {
            montantTotal: 1000,
            statut: 'en_attente',
            modeLivraison: 'domicile',
            adresseLivraison: {
                nom: 'Test',
                prenom: 'User',
                adresse: 'Test Address',
                telephone: '0123456789'
            },
            produits: [{
                produit: 'test-product-id',
                nom: 'Test Product',
                prix: 1000,
                quantite: 1,
                total: 1000
            }]
        };
        
        const order = new Order(testOrder);
        const saved = await order.save();
        
        res.json({
            message: 'Test order created successfully',
            orderId: saved._id
        });
        
    } catch (error) {
        console.error('Test order error:', error);
        res.status(500).json({
            message: 'Test failed',
            error: error.message
        });
    }
});

// Get User Orders
app.get('/api/orders/user/all', auth, async (req, res) => {
    try {
        const orders = await Order.find({ utilisateur: req.user.id })
            .sort({ dateCommande: -1 });
            
        res.json({ orders });
        
    } catch (error) {
        console.error('❌ Get user orders error:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération des commandes' });
    }
});

// Get Order by ID
app.get('/api/orders/:id', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
            
        if (!order) {
            return res.status(404).json({ message: 'Commande non trouvée' });
        }
        
        // Check if user owns the order or is admin
        if (order.utilisateur && order.utilisateur.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Accès refusé' });
        }
        
        res.json(order);
        
    } catch (error) {
        console.error('❌ Get order error:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération de la commande' });
    }
});

// Admin: Get All Orders - SIMPLIFIED
app.get('/api/orders', async (req, res) => {
    try {
        console.log('📋 Getting orders - SIMPLIFIED');
        
        // Check if user is admin (optional authentication)
        let isAdmin = false;
        const token = req.header('x-auth-token');
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024');
                const user = await User.findById(decoded.id);
                if (user && user.role === 'admin') {
                    isAdmin = true;
                }
            } catch (tokenError) {
                console.log('⚠️ Token validation failed');
            }
        }
        
        if (!isAdmin) {
            return res.status(403).json({ message: 'Accès administrateur requis' });
        }
        
        const { statut, page, limit } = req.query;
        const query = {};
        
        if (statut) query.statut = statut;
        
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 20;
        const skip = (pageNum - 1) * limitNum;
        
        const orders = await Order.find(query)
            .sort({ dateCommande: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(); // Use lean for better performance
            
        const totalOrders = await Order.countDocuments(query);
        
        console.log(`✅ Found ${orders.length} orders`);
        
        res.json({
            orders,
            totalOrders,
            currentPage: pageNum,
            totalPages: Math.ceil(totalOrders / limitNum)
        });
        
    } catch (error) {
        console.error('❌ Get orders error:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération des commandes' });
    }
});

// Admin: Update Order Status
app.put('/api/orders/:id/status', auth, adminAuth, async (req, res) => {
    try {
        const { statut } = req.body;
        
        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { statut, dateModification: new Date() },
            { new: true }
        );
        
        if (!order) {
            return res.status(404).json({ message: 'Commande non trouvée' });
        }
        
        res.json({
            message: 'Statut de la commande mis à jour avec succès',
            order
        });
        
    } catch (error) {
        console.error('❌ Update order status error:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour du statut' });
    }
});

// ADMIN ROUTES
// Dashboard Stats - SIMPLIFIED
async function getDashboardStats() {
    try {
        console.log('📊 Getting dashboard stats - SIMPLIFIED');
        
        // Get basic stats
        const totalUsers = await User.countDocuments();
        const adminUsers = await User.countDocuments({ role: 'admin' });
        const clientUsers = await User.countDocuments({ role: 'client' });
        const activeUsers = await User.countDocuments({ actif: true });
        
        // Get recent users (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentUsers = await User.countDocuments({ 
            dateInscription: { $gte: thirtyDaysAgo } 
        });

        // Get product stats
        const totalProducts = await Product.countDocuments({ actif: true });
        const featuredProducts = await Product.countDocuments({ vedette: true, actif: true });
        const promotionProducts = await Product.countDocuments({ promotion: true, actif: true });
        const outOfStockProducts = await Product.countDocuments({ stock: 0, actif: true });
        
        // Get categories
        const categories = await Product.distinct('categorie', { actif: true });

        // Get order stats - simplified
        const totalOrders = await Order.countDocuments();
        const pendingOrders = await Order.countDocuments({ statut: 'en_attente' });
        const completedOrders = await Order.countDocuments({ statut: 'livre' });
        
        // Calculate total revenue - simplified
        let totalRevenue = 0;
        try {
            const orders = await Order.find({ statut: { $ne: 'annule' } }).select('montantTotal').lean();
            totalRevenue = orders.reduce((sum, order) => sum + (order.montantTotal || 0), 0);
        } catch (revenueError) {
            console.log('Revenue calculation failed, using 0');
        }

        // Get users by wilaya
        let usersByWilaya = [];
        try {
            usersByWilaya = await User.aggregate([
                { $group: { _id: '$wilaya', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]);
        } catch (wilayaError) {
            console.log('Wilaya aggregation failed');
        }

        // Get recent orders for activity - simplified
        let recentActivity = [];
        try {
            const recentOrders = await Order.find()
                .sort({ dateCommande: -1 })
                .limit(5)
                .lean();
                
            recentActivity = recentOrders.map(order => ({
                id: order._id,
                user: order.adresseLivraison 
                    ? `${order.adresseLivraison.prenom || ''} ${order.adresseLivraison.nom || ''}`.trim() || 'Client'
                    : 'Client',
                total: order.montantTotal || 0,
                status: order.statut || 'en_attente',
                date: order.dateCommande || new Date()
            }));
        } catch (activityError) {
            console.log('Recent activity calculation failed');
        }

        const stats = {
            users: {
                total: totalUsers,
                admins: adminUsers,
                clients: clientUsers,
                active: activeUsers,
                recent: recentUsers
            },
            products: {
                total: totalProducts,
                categories: categories.length,
                featured: featuredProducts,
                promotions: promotionProducts,
                outOfStock: outOfStockProducts
            },
            orders: {
                total: totalOrders,
                pending: pendingOrders,
                completed: completedOrders,
                revenue: totalRevenue
            },
            analytics: {
                usersByWilaya: usersByWilaya,
                recentActivity: recentActivity
            }
        };

        console.log('✅ Dashboard stats calculated successfully');
        return stats;
        
    } catch (error) {
        console.error('❌ Dashboard stats error:', error);
        // Return default stats on error
        return {
            users: { total: 1, admins: 1, clients: 0, active: 1, recent: 0 },
            products: { total: 0, categories: 0, featured: 0, promotions: 0, outOfStock: 0 },
            orders: { total: 0, pending: 0, completed: 0, revenue: 0 },
            analytics: { usersByWilaya: [], recentActivity: [] }
        };
    }
}

// Admin Dashboard
app.get('/api/admin/dashboard', async (req, res) => {
    try {
        console.log('📊 Admin dashboard request - SIMPLIFIED');
        
        // Check admin authentication
        let isAdmin = false;
        const token = req.header('x-auth-token');
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024');
                const user = await User.findById(decoded.id);
                if (user && user.role === 'admin') {
                    isAdmin = true;
                }
            } catch (tokenError) {
                console.log('⚠️ Token validation failed');
            }
        }
        
        if (!isAdmin) {
            return res.status(403).json({ message: 'Accès administrateur requis' });
        }
        
        const stats = await getDashboardStats();
        
        res.json(stats);

    } catch (error) {
        console.error('❌ Dashboard error:', error);
        res.status(500).json({ message: 'Erreur lors du chargement du dashboard' });
    }
});

// Create Admin User Function
async function createAdminUser() {
    try {
        const adminExists = await User.findOne({ role: 'admin' });
        if (adminExists) {
            console.log('✅ Admin user already exists');
            return;
        }

        const admin = new User({
            nom: 'Gaher',
            prenom: 'Parapharmacie',
            email: 'pharmaciegaher@gmail.com',
            password: 'anesaya75',
            telephone: '+213123456789',
            adresse: 'Tipaza, Algérie',
            wilaya: 'Tipaza',
            role: 'admin'
        });

        await admin.save();
        console.log('✅ Admin user created successfully');

    } catch (error) {
        console.error('❌ Admin creation error:', error);
    }
}

// Create Sample Products Function
async function createSampleProducts() {
    try {
        const productCount = await Product.countDocuments();
        if (productCount > 0) {
            console.log('✅ Products already exist');
            return;
        }

        const sampleProducts = [
            {
                nom: 'Paracétamol 500mg',
                description: 'Médicament contre la douleur et la fièvre',
                prix: 150,
                prixPromo: 120,
                image: '/images/paracetamol.jpg',
                categorie: 'Médicaments',
                sousCategorie: 'Antalgiques',
                stock: 100,
                vedette: true,
                promotion: true
            },
            {
                nom: 'Vitamine C 1000mg',
                description: 'Complément alimentaire vitamine C',
                prix: 800,
                image: '/images/vitamine-c.jpg',
                categorie: 'Compléments alimentaires',
                stock: 50,
                vedette: true
            },
            {
                nom: 'Crème hydratante visage',
                description: 'Crème pour peaux sèches et sensibles',
                prix: 1200,
                prixPromo: 900,
                image: '/images/creme-hydratante.jpg',
                categorie: 'Cosmétiques',
                sousCategorie: 'Soins du visage',
                stock: 30,
                promotion: true
            },
            {
                nom: 'Thermomètre digital',
                description: 'Thermomètre médical précis et rapide',
                prix: 2500,
                image: '/images/thermometre.jpg',
                categorie: 'Matériel médical',
                stock: 20,
                vedette: true
            },
            {
                nom: 'Serum physiologique',
                description: 'Solution saline stérile 9ml x 20',
                prix: 180,
                image: '/images/serum-physiologique.jpg',
                categorie: 'Hygiène',
                sousCategorie: 'Soins bébé',
                stock: 80
            },
            {
                nom: 'Magnésium 300mg',
                description: 'Complément alimentaire anti-stress',
                prix: 950,
                image: '/images/magnesium.jpg',
                categorie: 'Compléments alimentaires',
                stock: 40
            },
            {
                nom: 'Masque chirurgical',
                description: 'Boîte de 50 masques chirurgicaux',
                prix: 450,
                prixPromo: 350,
                image: '/images/masques.jpg',
                categorie: 'Protection',
                stock: 60,
                promotion: true
            },
            {
                nom: 'Sirop contre la toux',
                description: 'Sirop naturel au miel et plantes',
                prix: 320,
                image: '/images/sirop-toux.jpg',
                categorie: 'Médicaments',
                sousCategorie: 'ORL',
                stock: 25
            }
        ];

        await Product.insertMany(sampleProducts);
        console.log('✅ Sample products created successfully');

    } catch (error) {
        console.error('❌ Sample products creation error:', error);
    }
}

// MongoDB Connection
const connectDB = async () => {
    try {
        console.log('🔄 Connecting to MongoDB...');
        
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ MongoDB connected');
        await createAdminUser();
        await createSampleProducts();
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        setTimeout(connectDB, 10000);
    }
};

// Error handler
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
});

// 404 handler
app.use('*', (req, res) => {
    console.log(`❓ 404 - Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        message: 'Route non trouvée',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});

// Start server
connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Health: http://localhost:${PORT}/api/health`);
    console.log(`🔐 Login: http://localhost:${PORT}/api/auth/login`);
    console.log(`🛍️ Products: http://localhost:${PORT}/api/products`);
    console.log(`📦 Orders: http://localhost:${PORT}/api/orders`);
});
