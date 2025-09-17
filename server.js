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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Simple User Schema
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

// Order Schema
const OrderSchema = new mongoose.Schema({
    utilisateur: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Allow guest orders
    },
    produits: [{
        produit: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        nom: { type: String, required: true },
        prix: { type: Number, required: true },
        quantite: { type: Number, required: true },
        total: { type: Number, required: true }
    }],
    montantTotal: { type: Number, required: true },
    statut: {
        type: String,
        enum: ['en_attente', 'confirme', 'expdie', 'livre', 'annule'],
        default: 'en_attente'
    },
    modeLivraison: {
        type: String,
        enum: ['domicile', 'point_relais', 'retrait'],
        default: 'domicile'
    },
    adresseLivraison: {
        nom: { type: String, required: true },
        prenom: { type: String, required: true },
        adresse: { type: String, required: true },
        ville: String,
        wilaya: String,
        codePostal: String,
        telephone: { type: String, required: true }
    },
    notes: String,
    dateCommande: { type: Date, default: Date.now },
    dateModification: { type: Date, default: Date.now }
});

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

// AUTH ROUTES - DIRECTLY IN SERVER FILE
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

// ADMIN ROUTES
// Admin middleware
const adminAuth = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Accès refusé - droits administrateur requis' });
    }
};

// Admin Dashboard
app.get('/api/admin/dashboard', auth, adminAuth, async (req, res) => {
    try {
        console.log('📊 Admin dashboard request');
        
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

        // Get order stats - FIXED to handle optional users
        const totalOrders = await Order.countDocuments();
        const pendingOrders = await Order.countDocuments({ statut: 'en_attente' });
        const completedOrders = await Order.countDocuments({ statut: 'livre' });
        
        // Calculate total revenue
        const revenueResult = await Order.aggregate([
            { $match: { statut: { $ne: 'annule' } } },
            { $group: { _id: null, total: { $sum: '$montantTotal' } } }
        ]);
        const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

        // Get users by wilaya
        const usersByWilaya = await User.aggregate([
            { $group: { _id: '$wilaya', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        // Get recent orders for activity - handle both authenticated and guest orders
        const recentOrders = await Order.find()
            .populate('utilisateur', 'nom prenom')
            .sort({ dateCommande: -1 })
            .limit(5);

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
                recentActivity: recentOrders.map(order => ({
                    id: order._id,
                    user: order.utilisateur 
                        ? `${order.utilisateur.prenom} ${order.utilisateur.nom}` 
                        : `${order.adresseLivraison.prenom} ${order.adresseLivraison.nom} (Invité)`,
                    total: order.montantTotal,
                    status: order.statut,
                    date: order.dateCommande
                }))
            }
        };

        console.log('✅ Dashboard stats generated');
        res.json(stats);

    } catch (error) {
        console.error('❌ Dashboard error:', error);
        res.status(500).json({ message: 'Erreur lors du chargement du dashboard' });
    }
});

// Get All Users (Admin)
app.get('/api/admin/users', auth, adminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const users = await User.find()
            .select('-password')
            .sort({ dateInscription: -1 })
            .skip(skip)
            .limit(limit);

        const totalUsers = await User.countDocuments();

        res.json({
            users,
            totalUsers,
            currentPage: page,
            totalPages: Math.ceil(totalUsers / limit)
        });

    } catch (error) {
        console.error('❌ Get users error:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération des utilisateurs' });
    }
});

// Update User Status (Admin)
app.put('/api/admin/users/:id/status', auth, adminAuth, async (req, res) => {
    try {
        const { actif } = req.body;
        
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { actif },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        res.json({
            message: `Utilisateur ${actif ? 'activé' : 'désactivé'} avec succès`,
            user
        });

    } catch (error) {
        console.error('❌ Update user status error:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour' });
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

// Admin: Create Product
app.post('/api/admin/products', auth, adminAuth, async (req, res) => {
    try {
        const product = new Product(req.body);
        await product.save();
        console.log('✅ Product created:', product.nom);
        res.status(201).json({ message: 'Produit créé avec succès', product });
    } catch (error) {
        console.error('❌ Create product error:', error);
        res.status(500).json({ message: 'Erreur lors de la création du produit' });
    }
});

// Admin: Update Product
app.put('/api/admin/products/:id', auth, adminAuth, async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { ...req.body, dateModification: new Date() },
            { new: true }
        );
        if (!product) {
            return res.status(404).json({ message: 'Produit non trouvé' });
        }
        res.json({ message: 'Produit mis à jour avec succès', product });
    } catch (error) {
        console.error('❌ Update product error:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour du produit' });
    }
});

// Admin: Delete Product
app.delete('/api/admin/products/:id', auth, adminAuth, async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { actif: false },
            { new: true }
        );
        if (!product) {
            return res.status(404).json({ message: 'Produit non trouvé' });
        }
        res.json({ message: 'Produit désactivé avec succès' });
    } catch (error) {
        console.error('❌ Delete product error:', error);
        res.status(500).json({ message: 'Erreur lors de la suppression du produit' });
    }
});

// ORDER ROUTES
// Create Order - FIXED with better error handling and optional auth
app.post('/api/orders', async (req, res) => {
    try {
        console.log('📦 Creating order...');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        
        const { produits, montantTotal, modeLivraison, adresseLivraison, notes } = req.body;
        
        // Validate required fields
        if (!produits || !Array.isArray(produits) || produits.length === 0) {
            console.log('❌ No products in order');
            return res.status(400).json({ message: 'Aucun produit dans la commande' });
        }
        
        if (!montantTotal || montantTotal <= 0) {
            console.log('❌ Invalid total amount');
            return res.status(400).json({ message: 'Montant total invalide' });
        }
        
        if (!adresseLivraison || !adresseLivraison.nom || !adresseLivraison.prenom) {
            console.log('❌ Missing delivery address');
            return res.status(400).json({ message: 'Adresse de livraison incomplète' });
        }
        
        // Get user ID if authenticated (optional)
        let userId = null;
        const token = req.header('x-auth-token');
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024');
                const user = await User.findById(decoded.id);
                if (user) {
                    userId = user._id;
                    console.log('✅ Order from authenticated user:', user.email);
                }
            } catch (tokenError) {
                console.log('⚠️ Invalid token, proceeding as guest');
            }
        }
        
        // Validate products exist and calculate total
        let calculatedTotal = 0;
        for (let item of produits) {
            if (!item.produit) {
                console.log('❌ Product ID missing for item:', item);
                continue;
            }
            
            const product = await Product.findById(item.produit);
            if (!product) {
                console.log('⚠️ Product not found:', item.produit);
                // Continue anyway for demo purposes
            }
            
            calculatedTotal += (item.prix || 0) * (item.quantite || 0);
        }
        
        console.log(`💰 Calculated total: ${calculatedTotal}, Received total: ${montantTotal}`);
        
        // Create order data
        const orderData = {
            utilisateur: userId,
            produits: produits.map(item => ({
                produit: item.produit || new mongoose.Types.ObjectId(), // Fallback for demo
                nom: item.nom || 'Produit',
                prix: item.prix || 0,
                quantite: item.quantite || 1,
                total: (item.prix || 0) * (item.quantite || 1)
            })),
            montantTotal: montantTotal,
            statut: 'en_attente',
            modeLivraison: modeLivraison || 'domicile',
            adresseLivraison: {
                nom: adresseLivraison.nom,
                prenom: adresseLivraison.prenom,
                adresse: adresseLivraison.adresse,
                ville: adresseLivraison.ville,
                wilaya: adresseLivraison.wilaya,
                codePostal: adresseLivraison.codePostal || '',
                telephone: adresseLivraison.telephone
            },
            notes: notes || ''
        };
        
        console.log('📋 Creating order with data:', JSON.stringify(orderData, null, 2));
        
        const order = new Order(orderData);
        await order.save();
        
        console.log('✅ Order created successfully:', order._id);
        
        // Try to populate but don't fail if it doesn't work
        let populatedOrder = order;
        try {
            if (userId) {
                await order.populate('utilisateur', 'nom prenom email telephone');
            }
            // Don't populate products for now as they might not exist
            populatedOrder = order;
        } catch (populateError) {
            console.log('⚠️ Population failed, continuing with basic order:', populateError.message);
        }
        
        res.status(201).json({
            message: 'Commande créée avec succès',
            order: populatedOrder
        });
        
    } catch (error) {
        console.error('❌ Create order error:', error);
        console.error('Error stack:', error.stack);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: `Erreur de validation: ${messages.join(', ')}`
            });
        }
        
        if (error.name === 'CastError') {
            return res.status(400).json({
                message: 'ID de produit invalide'
            });
        }
        
        res.status(500).json({ 
            message: 'Erreur serveur lors de la création de la commande',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get User Orders
app.get('/api/orders/user/all', auth, async (req, res) => {
    try {
        const orders = await Order.find({ utilisateur: req.user.id })
            .populate('produits.produit', 'nom prix image')
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
        const order = await Order.findById(req.params.id)
            .populate('utilisateur', 'nom prenom email telephone')
            .populate('produits.produit', 'nom prix image');
            
        if (!order) {
            return res.status(404).json({ message: 'Commande non trouvée' });
        }
        
        // Check if user owns the order or is admin
        if (order.utilisateur._id.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Accès refusé' });
        }
        
        res.json(order);
        
    } catch (error) {
        console.error('❌ Get order error:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération de la commande' });
    }
});

// Admin: Get All Orders - FIXED to work with optional user
app.get('/api/orders', auth, adminAuth, async (req, res) => {
    try {
        console.log('📋 Admin getting all orders');
        
        const { statut, page, limit } = req.query;
        const query = {};
        
        if (statut) query.statut = statut;
        
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 20;
        const skip = (pageNum - 1) * limitNum;
        
        const orders = await Order.find(query)
            .populate('utilisateur', 'nom prenom email telephone')
            .sort({ dateCommande: -1 })
            .skip(skip)
            .limit(limitNum);
            
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
        ).populate('utilisateur', 'nom prenom email');
        
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
});
