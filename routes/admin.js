const express = require('express');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Settings = require('../models/Settings');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// Apply admin auth middleware to all routes
router.use(adminAuth);

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard stats
// @access  Admin
router.get('/dashboard', async (req, res) => {
    try {
        console.log('📊 Loading admin dashboard stats...');
        
        // Get basic counts
        const totalProducts = await Product.countDocuments({ actif: true });
        const totalOrders = await Order.countDocuments();
        const totalUsers = await User.countDocuments({ actif: true });
        const pendingOrders = await Order.countDocuments({ statut: 'en-attente' });
        
        // Get recent orders (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentOrders = await Order.find({
            dateCommande: { $gte: thirtyDaysAgo }
        });
        
        // Calculate revenue
        const monthlyRevenue = recentOrders.reduce((sum, order) => sum + order.total, 0);
        const dailyRevenue = recentOrders
            .filter(order => {
                const today = new Date();
                const orderDate = new Date(order.dateCommande);
                return orderDate.toDateString() === today.toDateString();
            })
            .reduce((sum, order) => sum + order.total, 0);
        
        // Get top categories
        const products = await Product.find({ actif: true });
        const categoryStats = products.reduce((acc, product) => {
            acc[product.categorie] = (acc[product.categorie] || 0) + 1;
            return acc;
        }, {});
        
        // Get low stock products
        const lowStockProducts = await Product.find({
            actif: true,
            stock: { $lt: 5 }
        }).limit(10);
        
        // Get recent activity (orders)
        const recentActivity = await Order.find()
            .sort({ dateCommande: -1 })
            .limit(5)
            .populate('user', 'nom prenom email');
        
        const stats = {
            totalProducts,
            totalOrders,
            totalUsers,
            pendingOrders,
            monthlyRevenue,
            dailyRevenue,
            categoryStats,
            lowStockProducts,
            recentActivity
        };
        
        console.log('✅ Dashboard stats loaded');
        res.json({ stats });
        
    } catch (error) {
        console.error('❌ Dashboard error:', error);
        res.status(500).json({ 
            message: 'Erreur lors du chargement du tableau de bord' 
        });
    }
});

// @route   GET /api/admin/products
// @desc    Get all products for admin
// @access  Admin
router.get('/products', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        let query = {};
        
        // Filters
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
        
        if (req.query.stock) {
            if (req.query.stock === 'low') {
                query.stock = { $lt: 5 };
            } else if (req.query.stock === 'out') {
                query.stock = 0;
            }
        }
        
        if (req.query.status) {
            query.actif = req.query.status === 'active';
        }
        
        // Sort
        let sort = {};
        switch (req.query.sort) {
            case 'name_asc':
                sort.nom = 1;
                break;
            case 'name_desc':
                sort.nom = -1;
                break;
            case 'price_asc':
                sort.prix = 1;
                break;
            case 'price_desc':
                sort.prix = -1;
                break;
            case 'stock_asc':
                sort.stock = 1;
                break;
            case 'stock_desc':
                sort.stock = -1;
                break;
            case 'newest':
                sort.dateAjout = -1;
                break;
            default:
                sort.dateAjout = -1;
        }
        
        const products = await Product.find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit);
            
        const total = await Product.countDocuments(query);
        const totalPages = Math.ceil(total / limit);
        
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
            message: 'Erreur lors de la récupération des produits' 
        });
    }
});

// @route   POST /api/admin/products
// @desc    Create new product
// @access  Admin
router.post('/products', async (req, res) => {
    try {
        console.log('🆕 Creating new product:', req.body.nom);
        
        const productData = {
            ...req.body,
            dateAjout: new Date()
        };
        
        const product = new Product(productData);
        await product.save();
        
        console.log('✅ Product created:', product._id);
        res.status(201).json({
            message: 'Produit créé avec succès',
            product
        });
        
    } catch (error) {
        console.error('❌ Product creation error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: messages[0] || 'Données de produit invalides'
            });
        }
        
        res.status(500).json({ 
            message: 'Erreur lors de la création du produit' 
        });
    }
});

// @route   PUT /api/admin/products/:id
// @desc    Update product
// @access  Admin
router.put('/products/:id', async (req, res) => {
    try {
        console.log('📝 Updating product:', req.params.id);
        
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!product) {
            return res.status(404).json({
                message: 'Produit non trouvé'
            });
        }
        
        console.log('✅ Product updated:', product._id);
        res.json({
            message: 'Produit mis à jour avec succès',
            product
        });
        
    } catch (error) {
        console.error('❌ Product update error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: messages[0] || 'Données de produit invalides'
            });
        }
        
        res.status(500).json({ 
            message: 'Erreur lors de la mise à jour du produit' 
        });
    }
});

// @route   DELETE /api/admin/products/:id
// @desc    Delete product
// @access  Admin
router.delete('/products/:id', async (req, res) => {
    try {
        console.log('🗑️ Deleting product:', req.params.id);
        
        const product = await Product.findByIdAndDelete(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                message: 'Produit non trouvé'
            });
        }
        
        console.log('✅ Product deleted:', product.nom);
        res.json({
            message: 'Produit supprimé avec succès'
        });
        
    } catch (error) {
        console.error('❌ Product deletion error:', error);
        res.status(500).json({ 
            message: 'Erreur lors de la suppression du produit' 
        });
    }
});

// @route   POST /api/admin/products/bulk-update
// @desc    Bulk update products (featured, promotion, etc.)
// @access  Admin
router.post('/products/bulk-update', async (req, res) => {
    try {
        const { productIds, updates } = req.body;
        
        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({
                message: 'Liste de produits requise'
            });
        }
        
        console.log(`📦 Bulk updating ${productIds.length} products:`, updates);
        
        const result = await Product.updateMany(
            { _id: { $in: productIds } },
            updates,
            { runValidators: true }
        );
        
        console.log('✅ Bulk update completed:', result);
        res.json({
            message: `${result.modifiedCount} produits mis à jour avec succès`,
            modifiedCount: result.modifiedCount
        });
        
    } catch (error) {
        console.error('❌ Bulk update error:', error);
        res.status(500).json({ 
            message: 'Erreur lors de la mise à jour groupée' 
        });
    }
});

// @route   POST /api/admin/products/cleanup
// @desc    Clean up unwanted products
// @access  Admin
router.post('/products/cleanup', async (req, res) => {
    try {
        const { criteria } = req.body;
        
        console.log('🧹 Starting product cleanup with criteria:', criteria);
        
        let deleteQuery = {};
        
        // Build delete query based on criteria
        if (criteria.includeInactive) {
            deleteQuery.actif = false;
        }
        
        if (criteria.includeOutOfStock) {
            deleteQuery.stock = 0;
        }
        
        if (criteria.includeOldProducts && criteria.daysBefore) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - criteria.daysBefore);
            deleteQuery.dateAjout = { $lt: cutoffDate };
        }
        
        if (criteria.categories && criteria.categories.length > 0) {
            deleteQuery.categorie = { $in: criteria.categories };
        }
        
        if (criteria.priceRange) {
            deleteQuery.prix = {};
            if (criteria.priceRange.min !== undefined) {
                deleteQuery.prix.$gte = criteria.priceRange.min;
            }
            if (criteria.priceRange.max !== undefined) {
                deleteQuery.prix.$lte = criteria.priceRange.max;
            }
        }
        
        // Get products to be deleted for logging
        const productsToDelete = await Product.find(deleteQuery);
        console.log(`Found ${productsToDelete.length} products matching cleanup criteria`);
        
        if (productsToDelete.length === 0) {
            return res.json({
                message: 'Aucun produit trouvé correspondant aux critères',
                deletedCount: 0,
                deletedProducts: []
            });
        }
        
        // Delete products
        const result = await Product.deleteMany(deleteQuery);
        
        console.log(`✅ Cleanup completed: ${result.deletedCount} products deleted`);
        
        res.json({
            message: `${result.deletedCount} produits supprimés avec succès`,
            deletedCount: result.deletedCount,
            deletedProducts: productsToDelete.map(p => ({
                id: p._id,
                nom: p.nom,
                categorie: p.categorie,
                prix: p.prix,
                stock: p.stock
            }))
        });
        
    } catch (error) {
        console.error('❌ Product cleanup error:', error);
        res.status(500).json({ 
            message: 'Erreur lors du nettoyage des produits' 
        });
    }
});

// @route   GET /api/admin/orders
// @desc    Get all orders for admin
// @access  Admin
router.get('/orders', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        let query = {};
        
        // Filters
        if (req.query.statut) {
            query.statut = req.query.statut;
        }
        
        if (req.query.search) {
            query.$or = [
                { numeroCommande: { $regex: req.query.search, $options: 'i' } },
                { 'clientInfo.nom': { $regex: req.query.search, $options: 'i' } },
                { 'clientInfo.telephone': { $regex: req.query.search, $options: 'i' } }
            ];
        }
        
        if (req.query.dateFrom || req.query.dateTo) {
            query.dateCommande = {};
            if (req.query.dateFrom) {
                query.dateCommande.$gte = new Date(req.query.dateFrom);
            }
            if (req.query.dateTo) {
                query.dateCommande.$lte = new Date(req.query.dateTo);
            }
        }
        
        // Sort
        let sort = {};
        switch (req.query.sort) {
            case 'oldest':
                sort.dateCommande = 1;
                break;
            case 'total_desc':
                sort.total = -1;
                break;
            case 'total_asc':
                sort.total = 1;
                break;
            default:
                sort.dateCommande = -1;
        }
        
        const orders = await Order.find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .populate('user', 'nom prenom email')
            .populate('produits.produit');
            
        const total = await Order.countDocuments(query);
        const totalPages = Math.ceil(total / limit);
        
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
            message: 'Erreur lors de la récupération des commandes' 
        });
    }
});

// @route   PUT /api/admin/orders/:id/status
// @desc    Update order status
// @access  Admin
router.put('/orders/:id/status', async (req, res) => {
    try {
        const { statut, notes } = req.body;
        
        const validStatuses = ['en-attente', 'confirmée', 'expédiée', 'livrée', 'annulée'];
        
        if (!validStatuses.includes(statut)) {
            return res.status(400).json({
                message: 'Statut invalide'
            });
        }
        
        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { 
                statut, 
                notes: notes || '',
                dateModification: new Date() 
            },
            { new: true }
        ).populate('user', 'nom prenom email');
        
        if (!order) {
            return res.status(404).json({
                message: 'Commande non trouvée'
            });
        }
        
        console.log(`✅ Order ${order.numeroCommande} status updated to: ${statut}`);
        
        res.json({
            message: 'Statut de commande mis à jour avec succès',
            order
        });
        
    } catch (error) {
        console.error('❌ Order status update error:', error);
        res.status(500).json({ 
            message: 'Erreur lors de la mise à jour du statut' 
        });
    }
});

// @route   GET /api/admin/users
// @desc    Get all users for admin
// @access  Admin
router.get('/users', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        let query = {};
        
        if (req.query.search) {
            query.$or = [
                { nom: { $regex: req.query.search, $options: 'i' } },
                { prenom: { $regex: req.query.search, $options: 'i' } },
                { email: { $regex: req.query.search, $options: 'i' } },
                { telephone: { $regex: req.query.search, $options: 'i' } }
            ];
        }
        
        if (req.query.role) {
            query.role = req.query.role;
        }
        
        if (req.query.wilaya) {
            query.wilaya = req.query.wilaya;
        }
        
        const users = await User.find(query)
            .sort({ dateInscription: -1 })
            .skip(skip)
            .limit(limit);
            
        const total = await User.countDocuments(query);
        const totalPages = Math.ceil(total / limit);
        
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
            message: 'Erreur lors de la récupération des utilisateurs' 
        });
    }
});

// @route   GET /api/admin/settings
// @desc    Get site settings
// @access  Admin
router.get('/settings', async (req, res) => {
    try {
        const settings = await Settings.getSettings();
        res.json(settings);
        
    } catch (error) {
        console.error('❌ Settings error:', error);
        res.status(500).json({ 
            message: 'Erreur lors de la récupération des paramètres' 
        });
    }
});

// @route   PUT /api/admin/settings
// @desc    Update site settings
// @access  Admin
router.put('/settings', async (req, res) => {
    try {
        const settings = await Settings.getSettings();
        await settings.updateSettings(req.body, req.user.id);
        
        res.json({
            message: 'Paramètres mis à jour avec succès',
            settings
        });
        
    } catch (error) {
        console.error('❌ Settings update error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: messages[0] || 'Données invalides'
            });
        }
        
        res.status(500).json({ 
            message: 'Erreur lors de la mise à jour des paramètres' 
        });
    }
});

module.exports = router;
