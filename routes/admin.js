const express = require('express');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const { auth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Apply admin authentication to all admin routes
router.use(auth);
router.use(requireAdmin);

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private/Admin
router.get('/dashboard', async (req, res) => {
    try {
        console.log('📊 Admin dashboard request from user:', req.user.email);
        
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        // Initialize default values
        let stats = {
            totalProducts: 0,
            activeProducts: 0,
            featuredProducts: 0,
            totalOrders: 0,
            pendingOrders: 0,
            monthlyOrders: 0,
            dailyOrders: 0,
            totalUsers: 0,
            activeUsers: 0,
            monthlyRevenue: 0
        };

        try {
            // Product statistics
            stats.totalProducts = await Product.countDocuments();
            stats.activeProducts = await Product.countDocuments({ actif: true });
            stats.featuredProducts = await Product.countDocuments({ enVedette: true });
        } catch (error) {
            console.log('Product stats error:', error.message);
        }
        
        try {
            // Order statistics
            stats.totalOrders = await Order.countDocuments();
            stats.pendingOrders = await Order.countDocuments({ statut: 'en-attente' });
            stats.monthlyOrders = await Order.countDocuments({ 
                dateCommande: { $gte: startOfMonth } 
            });
            stats.dailyOrders = await Order.countDocuments({ 
                dateCommande: { $gte: startOfDay } 
            });
            
            // Revenue calculation
            const revenueAggregation = await Order.aggregate([
                {
                    $match: {
                        dateCommande: { $gte: startOfMonth },
                        statut: { $in: ['confirmée', 'préparée', 'expédiée', 'livrée'] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$total' }
                    }
                }
            ]);
            
            stats.monthlyRevenue = revenueAggregation[0]?.total || 0;
                
        } catch (error) {
            console.log('Order stats error:', error.message);
        }
        
        try {
            // User statistics
            stats.totalUsers = await User.countDocuments();
            stats.activeUsers = await User.countDocuments({ actif: true });
        } catch (error) {
            console.log('User stats error:', error.message);
        }
        
        const dashboardData = {
            stats,
            timestamp: new Date().toISOString()
        };
        
        console.log('✅ Dashboard data prepared successfully');
        res.json(dashboardData);
        
    } catch (error) {
        console.error('❌ Admin dashboard error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des statistiques',
            error: error.message
        });
    }
});

// @route   GET /api/admin/orders
// @desc    Get all orders for admin management
// @access  Private/Admin
router.get('/orders', async (req, res) => {
    try {
        console.log('📦 Admin getting all orders');
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        let query = {};
        
        // Filter by status
        if (req.query.statut) {
            query.statut = req.query.statut;
        }
        
        // Filter by date range
        if (req.query.dateFrom || req.query.dateTo) {
            query.dateCommande = {};
            if (req.query.dateFrom) {
                query.dateCommande.$gte = new Date(req.query.dateFrom);
            }
            if (req.query.dateTo) {
                query.dateCommande.$lte = new Date(req.query.dateTo);
            }
        }
        
        const orders = await Order.find(query)
            .sort({ dateCommande: -1 })
            .skip(skip)
            .limit(limit);
            
        const total = await Order.countDocuments(query);
        const totalPages = Math.ceil(total / limit);
        
        console.log(`✅ Retrieved ${orders.length} orders out of ${total} total`);
        
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
        console.error('❌ Get admin orders error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des commandes',
            error: error.message
        });
    }
});

// @route   GET /api/admin/products
// @desc    Get all products for admin management
// @access  Private/Admin
router.get('/products', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        
        let query = {};
        
        // Filters
        if (req.query.categorie) {
            query.categorie = req.query.categorie;
        }
        
        if (req.query.actif !== undefined) {
            query.actif = req.query.actif === 'true';
        }
        
        if (req.query.enVedette !== undefined) {
            query.enVedette = req.query.enVedette === 'true';
        }
        
        if (req.query.search) {
            query.$or = [
                { nom: { $regex: req.query.search, $options: 'i' } },
                { description: { $regex: req.query.search, $options: 'i' } },
                { marque: { $regex: req.query.search, $options: 'i' } }
            ];
        }
        
        // Sort
        let sort = { dateAjout: -1 };
        if (req.query.sort) {
            switch (req.query.sort) {
                case 'name_asc':
                    sort = { nom: 1 };
                    break;
                case 'name_desc':
                    sort = { nom: -1 };
                    break;
                case 'price_asc':
                    sort = { prix: 1 };
                    break;
                case 'price_desc':
                    sort = { prix: -1 };
                    break;
                case 'stock_asc':
                    sort = { stock: 1 };
                    break;
                case 'stock_desc':
                    sort = { stock: -1 };
                    break;
            }
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
            message: 'Erreur lors de la récupération des produits',
            error: error.message
        });
    }
});

// @route   POST /api/admin/products
// @desc    Create new product
// @access  Private/Admin
router.post('/products', async (req, res) => {
    try {
        console.log('📦 Admin creating new product:', req.body.nom);
        
        const productData = {
            ...req.body,
            dateAjout: new Date()
        };
        
        const product = new Product(productData);
        await product.save();
        
        console.log('✅ Product created successfully:', product._id);
        
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
            message: 'Erreur serveur lors de la création du produit',
            error: error.message
        });
    }
});

// @route   PUT /api/admin/products/:id
// @desc    Update product
// @access  Private/Admin
router.put('/products/:id', async (req, res) => {
    try {
        console.log('📦 Admin updating product:', req.params.id);
        
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                message: 'Produit non trouvé'
            });
        }
        
        // Update product with new data
        Object.keys(req.body).forEach(key => {
            if (req.body[key] !== undefined) {
                product[key] = req.body[key];
            }
        });
        
        await product.save();
        
        console.log('✅ Product updated successfully:', product._id);
        
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
            message: 'Erreur lors de la mise à jour du produit',
            error: error.message
        });
    }
});

// @route   DELETE /api/admin/products/:id
// @desc    Delete product
// @access  Private/Admin
router.delete('/products/:id', async (req, res) => {
    try {
        console.log('📦 Admin deleting product:', req.params.id);
        
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                message: 'Produit non trouvé'
            });
        }
        
        await Product.findByIdAndDelete(req.params.id);
        
        console.log('✅ Product deleted successfully:', req.params.id);
        
        res.json({
            message: 'Produit supprimé avec succès'
        });
        
    } catch (error) {
        console.error('❌ Product deletion error:', error);
        res.status(500).json({
            message: 'Erreur lors de la suppression du produit',
            error: error.message
        });
    }
});

// @route   PUT /api/admin/orders/:id
// @desc    Update order status
// @access  Private/Admin
router.put('/orders/:id', async (req, res) => {
    try {
        const { statut } = req.body;
        
        console.log(`📦 Admin updating order ${req.params.id} to status: ${statut}`);
        
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({
                message: 'Commande non trouvée'
            });
        }
        
        // Validate status
        const validStatuses = ['en-attente', 'confirmée', 'préparée', 'expédiée', 'livrée', 'annulée'];
        if (!validStatuses.includes(statut)) {
            return res.status(400).json({
                message: 'Statut de commande invalide'
            });
        }
        
        order.statut = statut;
        
        // Set delivery date if status is delivered
        if (statut === 'livrée') {
            order.dateLivraison = new Date();
        }
        
        await order.save();
        
        console.log(`✅ Order ${order.numeroCommande} status updated to: ${statut}`);
        
        res.json({
            message: 'Statut de commande mis à jour',
            order: {
                _id: order._id,
                numeroCommande: order.numeroCommande,
                statut: order.statut,
                dateLivraison: order.dateLivraison
            }
        });
        
    } catch (error) {
        console.error('❌ Update order error:', error);
        res.status(500).json({
            message: 'Erreur lors de la mise à jour de la commande',
            error: error.message
        });
    }
});

module.exports = router;
