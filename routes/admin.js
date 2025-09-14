const express = require('express');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Middleware to check if user is admin
const adminAuth = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            message: 'Accès refusé - Droits administrateur requis'
        });
    }
    next();
};

// Apply auth middleware to all admin routes
router.use(auth);
router.use(adminAuth);

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private/Admin
router.get('/dashboard', async (req, res) => {
    try {
        console.log('📊 Loading admin dashboard...');
        
        // Get counts
        const totalProducts = await Product.countDocuments();
        const totalOrders = await Order.countDocuments();
        const pendingOrders = await Order.countDocuments({ statut: 'en-attente' });
        const totalUsers = await User.countDocuments({ actif: true });
        
        // Calculate monthly revenue
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const monthlyOrdersAgg = await Order.aggregate([
            {
                $match: {
                    dateCommande: { $gte: startOfMonth },
                    statut: { $nin: ['annulée'] }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$total' }
                }
            }
        ]);
        
        const monthlyRevenue = monthlyOrdersAgg[0]?.total || 0;
        
        // Low stock products
        const lowStockProducts = await Product.find({ 
            stock: { $lte: 5 }, 
            actif: true 
        }).limit(10);
        
        // Recent orders
        const recentOrders = await Order.find()
            .sort({ dateCommande: -1 })
            .limit(5)
            .populate('client', 'nom prenom email');
        
        const stats = {
            totalProducts,
            totalOrders,
            pendingOrders,
            totalUsers,
            monthlyRevenue,
            lowStockProducts: lowStockProducts.length,
            recentOrders: recentOrders.length
        };
        
        console.log('✅ Dashboard stats loaded');
        
        res.json({
            stats,
            lowStockProducts,
            recentOrders
        });
        
    } catch (error) {
        console.error('❌ Dashboard error:', error);
        res.status(500).json({
            message: 'Erreur lors du chargement du tableau de bord'
        });
    }
});

// @route   GET /api/admin/products
// @desc    Get all products for admin
// @access  Private/Admin
router.get('/products', async (req, res) => {
    try {
        console.log('📦 Loading admin products...');
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const skip = (page - 1) * limit;
        
        let query = {};
        
        // Filters
        if (req.query.actif !== undefined) {
            query.actif = req.query.actif === 'true';
        }
        
        if (req.query.categorie) {
            query.categorie = req.query.categorie;
        }
        
        if (req.query.search) {
            query.$or = [
                { nom: { $regex: req.query.search, $options: 'i' } },
                { description: { $regex: req.query.search, $options: 'i' } },
                { marque: { $regex: req.query.search, $options: 'i' } }
            ];
        }
        
        if (req.query.enVedette !== undefined) {
            query.enVedette = req.query.enVedette === 'true';
        }
        
        if (req.query.enPromotion !== undefined) {
            query.enPromotion = req.query.enPromotion === 'true';
        }
        
        // Sort
        let sort = { dateAjout: -1 };
        if (req.query.sort) {
            switch (req.query.sort) {
                case 'nom':
                    sort = { nom: 1 };
                    break;
                case 'prix':
                    sort = { prix: 1 };
                    break;
                case 'stock':
                    sort = { stock: 1 };
                    break;
                case 'dateAjout':
                    sort = { dateAjout: -1 };
                    break;
            }
        }
        
        const products = await Product.find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit);
            
        const total = await Product.countDocuments(query);
        const totalPages = Math.ceil(total / limit);
        
        console.log(`✅ Admin products loaded: ${products.length}`);
        
        res.json({
            products,
            pagination: {
                currentPage: page,
                totalPages,
                totalProducts: total,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
        
    } catch (error) {
        console.error('❌ Admin products error:', error);
        res.status(500).json({
            message: 'Erreur lors du chargement des produits'
        });
    }
});

// @route   POST /api/admin/products
// @desc    Create a new product
// @access  Private/Admin
router.post('/products', async (req, res) => {
    try {
        console.log('➕ Creating new product...');
        
        const {
            nom,
            description,
            prix,
            prixOriginal,
            categorie,
            image,
            stock,
            enPromotion,
            enVedette,
            marque,
            ingredients,
            modeEmploi,
            precautions,
            actif
        } = req.body;
        
        // Validation
        if (!nom || !description || !prix || prix < 0 || !categorie || stock < 0) {
            return res.status(400).json({
                message: 'Données invalides. Vérifiez tous les champs obligatoires.'
            });
        }
        
        // Check if product already exists
        const existingProduct = await Product.findOne({ 
            nom: { $regex: new RegExp(`^${nom}$`, 'i') },
            marque: marque || { $exists: false }
        });
        
        if (existingProduct) {
            return res.status(400).json({
                message: 'Un produit avec ce nom existe déjà'
            });
        }
        
        // Calculate promotion percentage if applicable
        let pourcentagePromotion = 0;
        if (enPromotion && prixOriginal && prixOriginal > prix) {
            pourcentagePromotion = Math.round((prixOriginal - prix) / prixOriginal * 100);
        }
        
        const product = new Product({
            nom: nom.trim(),
            description: description.trim(),
            prix: parseInt(prix),
            prixOriginal: prixOriginal ? parseInt(prixOriginal) : undefined,
            categorie,
            image: image || undefined,
            stock: parseInt(stock),
            enPromotion: Boolean(enPromotion),
            enVedette: Boolean(enVedette),
            marque: marque ? marque.trim() : undefined,
            ingredients: ingredients ? ingredients.trim() : undefined,
            modeEmploi: modeEmploi ? modeEmploi.trim() : undefined,
            precautions: precautions ? precautions.trim() : undefined,
            pourcentagePromotion,
            actif: actif !== false, // Default to true
            dateAjout: new Date()
        });
        
        await product.save();
        
        console.log('✅ Product created:', product.nom);
        
        res.status(201).json({
            message: 'Produit créé avec succès',
            product
        });
        
    } catch (error) {
        console.error('❌ Create product error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: messages[0] || 'Données invalides'
            });
        }
        
        res.status(500).json({
            message: 'Erreur lors de la création du produit'
        });
    }
});

// @route   PUT /api/admin/products/:id
// @desc    Update a product
// @access  Private/Admin
router.put('/products/:id', async (req, res) => {
    try {
        console.log('📝 Updating product:', req.params.id);
        
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                message: 'Produit non trouvé'
            });
        }
        
        const {
            nom,
            description,
            prix,
            prixOriginal,
            categorie,
            image,
            stock,
            enPromotion,
            enVedette,
            marque,
            ingredients,
            modeEmploi,
            precautions,
            actif
        } = req.body;
        
        // Update fields if provided
        if (nom !== undefined) product.nom = nom.trim();
        if (description !== undefined) product.description = description.trim();
        if (prix !== undefined) product.prix = parseInt(prix);
        if (prixOriginal !== undefined) product.prixOriginal = prixOriginal ? parseInt(prixOriginal) : undefined;
        if (categorie !== undefined) product.categorie = categorie;
        if (image !== undefined) product.image = image;
        if (stock !== undefined) product.stock = parseInt(stock);
        if (enPromotion !== undefined) product.enPromotion = Boolean(enPromotion);
        if (enVedette !== undefined) product.enVedette = Boolean(enVedette);
        if (marque !== undefined) product.marque = marque ? marque.trim() : undefined;
        if (ingredients !== undefined) product.ingredients = ingredients ? ingredients.trim() : undefined;
        if (modeEmploi !== undefined) product.modeEmploi = modeEmploi ? modeEmploi.trim() : undefined;
        if (precautions !== undefined) product.precautions = precautions ? precautions.trim() : undefined;
        if (actif !== undefined) product.actif = Boolean(actif);
        
        // Recalculate promotion percentage
        if (product.enPromotion && product.prixOriginal && product.prixOriginal > product.prix) {
            product.pourcentagePromotion = Math.round((product.prixOriginal - product.prix) / product.prixOriginal * 100);
        } else {
            product.pourcentagePromotion = 0;
        }
        
        await product.save();
        
        console.log('✅ Product updated:', product.nom);
        
        res.json({
            message: 'Produit mis à jour avec succès',
            product
        });
        
    } catch (error) {
        console.error('❌ Update product error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: messages[0] || 'Données invalides'
            });
        }
        
        res.status(500).json({
            message: 'Erreur lors de la mise à jour du produit'
        });
    }
});

// @route   DELETE /api/admin/products/:id
// @desc    Delete a product
// @access  Private/Admin
router.delete('/products/:id', async (req, res) => {
    try {
        console.log('🗑️ Deleting product:', req.params.id);
        
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                message: 'Produit non trouvé'
            });
        }
        
        await Product.findByIdAndDelete(req.params.id);
        
        console.log('✅ Product deleted:', product.nom);
        
        res.json({
            message: 'Produit supprimé avec succès'
        });
        
    } catch (error) {
        console.error('❌ Delete product error:', error);
        res.status(500).json({
            message: 'Erreur lors de la suppression du produit'
        });
    }
});

// @route   GET /api/admin/orders
// @desc    Get all orders for admin
// @access  Private/Admin
router.get('/orders', async (req, res) => {
    try {
        console.log('📋 Loading admin orders...');
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        
        let query = {};
        
        // Filters
        if (req.query.statut) {
            query.statut = req.query.statut;
        }
        
        if (req.query.dateFrom || req.query.dateTo) {
            query.dateCommande = {};
            if (req.query.dateFrom) {
                query.dateCommande.$gte = new Date(req.query.dateFrom);
            }
            if (req.query.dateTo) {
                const dateTo = new Date(req.query.dateTo);
                dateTo.setHours(23, 59, 59, 999);
                query.dateCommande.$lte = dateTo;
            }
        }
        
        if (req.query.search) {
            query.$or = [
                { numeroCommande: { $regex: req.query.search, $options: 'i' } },
                { 'client.nom': { $regex: req.query.search, $options: 'i' } },
                { 'client.prenom': { $regex: req.query.search, $options: 'i' } },
                { 'client.email': { $regex: req.query.search, $options: 'i' } }
            ];
        }
        
        const orders = await Order.find(query)
            .sort({ dateCommande: -1 })
            .skip(skip)
            .limit(limit)
            .populate('client', 'nom prenom email telephone');
            
        const total = await Order.countDocuments(query);
        const totalPages = Math.ceil(total / limit);
        
        console.log(`✅ Admin orders loaded: ${orders.length}`);
        
        res.json({
            orders,
            pagination: {
                currentPage: page,
                totalPages,
                totalOrders: total,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
        
    } catch (error) {
        console.error('❌ Admin orders error:', error);
        res.status(500).json({
            message: 'Erreur lors du chargement des commandes'
        });
    }
});

// @route   PUT /api/admin/orders/:id
// @desc    Update order status
// @access  Private/Admin
router.put('/orders/:id', async (req, res) => {
    try {
        console.log('📝 Updating order:', req.params.id);
        
        const { statut, commentaires } = req.body;
        
        if (!statut) {
            return res.status(400).json({
                message: 'Statut requis'
            });
        }
        
        const validStatuts = ['en-attente', 'confirmée', 'préparée', 'expédiée', 'livrée', 'annulée'];
        if (!validStatuts.includes(statut)) {
            return res.status(400).json({
                message: 'Statut invalide'
            });
        }
        
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({
                message: 'Commande non trouvée'
            });
        }
        
        // Update order
        order.statut = statut;
        if (commentaires !== undefined) order.commentaires = commentaires;
        
        // Set delivery date if delivered
        if (statut === 'livrée' && !order.dateLivraison) {
            order.dateLivraison = new Date();
        }
        
        await order.save();
        
        console.log('✅ Order updated:', order.numeroCommande);
        
        res.json({
            message: 'Commande mise à jour avec succès',
            order
        });
        
    } catch (error) {
        console.error('❌ Update order error:', error);
        res.status(500).json({
            message: 'Erreur lors de la mise à jour de la commande'
        });
    }
});

// @route   GET /api/admin/orders/:id
// @desc    Get order details
// @access  Private/Admin
router.get('/orders/:id', async (req, res) => {
    try {
        console.log('👁️ Getting order details:', req.params.id);
        
        const order = await Order.findById(req.params.id)
            .populate('client', 'nom prenom email telephone adresse wilaya');
        
        if (!order) {
            return res.status(404).json({
                message: 'Commande non trouvée'
            });
        }
        
        res.json(order);
        
    } catch (error) {
        console.error('❌ Get order error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération de la commande'
        });
    }
});

// @route   GET /api/admin/users
// @desc    Get all users for admin
// @access  Private/Admin
router.get('/users', async (req, res) => {
    try {
        console.log('👥 Loading admin users...');
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        
        let query = {};
        
        // Filters
        if (req.query.actif !== undefined) {
            query.actif = req.query.actif === 'true';
        }
        
        if (req.query.role) {
            query.role = req.query.role;
        }
        
        if (req.query.search) {
            query.$or = [
                { nom: { $regex: req.query.search, $options: 'i' } },
                { prenom: { $regex: req.query.search, $options: 'i' } },
                { email: { $regex: req.query.search, $options: 'i' } }
            ];
        }
        
        const users = await User.find(query)
            .select('-password')
            .sort({ dateInscription: -1 })
            .skip(skip)
            .limit(limit);
            
        const total = await User.countDocuments(query);
        const totalPages = Math.ceil(total / limit);
        
        console.log(`✅ Admin users loaded: ${users.length}`);
        
        res.json({
            users,
            pagination: {
                currentPage: page,
                totalPages,
                totalUsers: total,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
        
    } catch (error) {
        console.error('❌ Admin users error:', error);
        res.status(500).json({
            message: 'Erreur lors du chargement des utilisateurs'
        });
    }
});

// @route   PUT /api/admin/users/:id
// @desc    Update user (toggle active status, change role)
// @access  Private/Admin
router.put('/users/:id', async (req, res) => {
    try {
        console.log('📝 Updating user:', req.params.id);
        
        const { actif, role } = req.body;
        
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                message: 'Utilisateur non trouvé'
            });
        }
        
        // Don't allow deactivating the last admin
        if (user.role === 'admin' && actif === false) {
            const adminCount = await User.countDocuments({ role: 'admin', actif: true });
            if (adminCount <= 1) {
                return res.status(400).json({
                    message: 'Impossible de désactiver le dernier administrateur'
                });
            }
        }
        
        // Update fields
        if (actif !== undefined) user.actif = Boolean(actif);
        if (role !== undefined && ['user', 'admin'].includes(role)) {
            user.role = role;
        }
        
        await user.save();
        
        console.log('✅ User updated:', user.email);
        
        res.json({
            message: 'Utilisateur mis à jour avec succès',
            user: {
                id: user._id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                role: user.role,
                actif: user.actif
            }
        });
        
    } catch (error) {
        console.error('❌ Update user error:', error);
        res.status(500).json({
            message: 'Erreur lors de la mise à jour de l\'utilisateur'
        });
    }
});

module.exports = router;
