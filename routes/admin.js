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
        let totalProducts = 0;
        let activeProducts = 0;
        let featuredProducts = 0;
        let totalOrders = 0;
        let pendingOrders = 0;
        let monthlyOrders = 0;
        let dailyOrders = 0;
        let totalUsers = 0;
        let activeUsers = 0;
        let monthlyRevenue = 0;
        let ordersByStatus = {};
        let topProducts = [];
        let recentOrders = [];
        
        try {
            // Product statistics
            totalProducts = await Product.countDocuments();
            activeProducts = await Product.countDocuments({ actif: true });
            featuredProducts = await Product.countDocuments({ enVedette: true });
        } catch (error) {
            console.log('Product stats error:', error.message);
        }
        
        try {
            // Order statistics
            totalOrders = await Order.countDocuments();
            pendingOrders = await Order.countDocuments({ statut: 'en-attente' });
            monthlyOrders = await Order.countDocuments({ 
                dateCommande: { $gte: startOfMonth } 
            });
            dailyOrders = await Order.countDocuments({ 
                dateCommande: { $gte: startOfDay } 
            });
            
            // Orders by status
            const statusAggregation = await Order.aggregate([
                {
                    $group: {
                        _id: '$statut',
                        count: { $sum: 1 }
                    }
                }
            ]);
            
            ordersByStatus = statusAggregation.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {});
            
            // Recent orders
            recentOrders = await Order.find()
                .sort({ dateCommande: -1 })
                .limit(5)
                .select('numeroCommande client total statut dateCommande');
                
        } catch (error) {
            console.log('Order stats error:', error.message);
        }
        
        try {
            // User statistics
            totalUsers = await User.countDocuments();
            activeUsers = await User.countDocuments({ actif: true });
        } catch (error) {
            console.log('User stats error:', error.message);
        }
        
        try {
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
            
            monthlyRevenue = revenueAggregation[0]?.total || 0;
        } catch (error) {
            console.log('Revenue stats error:', error.message);
        }
        
        try {
            // Top selling products
            topProducts = await Order.aggregate([
                { $unwind: '$articles' },
                {
                    $group: {
                        _id: '$articles.productId',
                        nom: { $first: '$articles.nom' },
                        totalSold: { $sum: '$articles.quantite' },
                        revenue: { $sum: { $multiply: ['$articles.prix', '$articles.quantite'] } }
                    }
                },
                { $sort: { totalSold: -1 } },
                { $limit: 5 }
            ]);
        } catch (error) {
            console.log('Top products stats error:', error.message);
            topProducts = [];
        }
        
        const dashboardData = {
            products: {
                total: totalProducts,
                active: activeProducts,
                featured: featuredProducts,
                inactive: Math.max(0, totalProducts - activeProducts)
            },
            orders: {
                total: totalOrders,
                pending: pendingOrders,
                monthly: monthlyOrders,
                daily: dailyOrders,
                byStatus: ordersByStatus
            },
            users: {
                total: totalUsers,
                active: activeUsers,
                inactive: Math.max(0, totalUsers - activeUsers)
            },
            revenue: {
                monthly: monthlyRevenue,
                average: monthlyOrders > 0 ? Math.round(monthlyRevenue / monthlyOrders) : 0
            },
            topProducts: topProducts,
            recentOrders: recentOrders,
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

// @route   GET /api/admin/users
// @desc    Get all users for admin management
// @access  Private/Admin
router.get('/users', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        let query = {};
        
        // Filters
        if (req.query.role) {
            query.role = req.query.role;
        }
        
        if (req.query.actif !== undefined) {
            query.actif = req.query.actif === 'true';
        }
        
        if (req.query.wilaya) {
            query.wilaya = req.query.wilaya;
        }
        
        if (req.query.search) {
            query.$or = [
                { nom: { $regex: req.query.search, $options: 'i' } },
                { prenom: { $regex: req.query.search, $options: 'i' } },
                { email: { $regex: req.query.search, $options: 'i' } },
                { telephone: { $regex: req.query.search, $options: 'i' } }
            ];
        }
        
        const users = await User.find(query)
            .select('-password -resetPasswordToken -emailVerificationToken')
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
            message: 'Erreur lors de la récupération des utilisateurs',
            error: error.message
        });
    }
});

// @route   PUT /api/admin/users/:id
// @desc    Update user (admin can change role, activate/deactivate)
// @access  Private/Admin
router.put('/users/:id', async (req, res) => {
    try {
        console.log('👤 Admin updating user:', req.params.id);
        
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                message: 'Utilisateur non trouvé'
            });
        }
        
        // Only allow admin to update specific fields
        const allowedUpdates = ['role', 'actif', 'emailVerifie', 'telephoneVerifie'];
        
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                user[field] = req.body[field];
            }
        });
        
        await user.save();
        
        console.log('✅ User updated successfully:', user._id);
        
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
        console.error('❌ User update error:', error);
        res.status(500).json({
            message: 'Erreur lors de la mise à jour de l\'utilisateur',
            error: error.message
        });
    }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete user
// @access  Private/Admin
router.delete('/users/:id', async (req, res) => {
    try {
        console.log('👤 Admin deleting user:', req.params.id);
        
        // Don't allow admin to delete themselves
        if (req.params.id === req.user.id) {
            return res.status(400).json({
                message: 'Vous ne pouvez pas supprimer votre propre compte'
            });
        }
        
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                message: 'Utilisateur non trouvé'
            });
        }
        
        await User.findByIdAndDelete(req.params.id);
        
        console.log('✅ User deleted successfully:', req.params.id);
        
        res.json({
            message: 'Utilisateur supprimé avec succès'
        });
        
    } catch (error) {
        console.error('❌ User deletion error:', error);
        res.status(500).json({
            message: 'Erreur lors de la suppression de l\'utilisateur',
            error: error.message
        });
    }
});

// @route   GET /api/admin/analytics
// @desc    Get detailed analytics
// @access  Private/Admin
router.get('/analytics', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        // Daily orders analytics
        const dailyOrders = await Order.aggregate([
            {
                $match: {
                    dateCommande: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$dateCommande' },
                        month: { $month: '$dateCommande' },
                        day: { $dayOfMonth: '$dateCommande' }
                    },
                    count: { $sum: 1 },
                    revenue: { $sum: '$total' }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
            }
        ]);
        
        // User registration analytics
        const userRegistrations = await User.aggregate([
            {
                $match: {
                    dateInscription: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$dateInscription' },
                        month: { $month: '$dateInscription' },
                        day: { $dayOfMonth: '$dateInscription' }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
            }
        ]);
        
        res.json({
            dailyOrders: dailyOrders || [],
            userRegistrations: userRegistrations || [],
            period: {
                days,
                startDate,
                endDate: new Date()
            }
        });
        
    } catch (error) {
        console.error('❌ Admin analytics error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des analyses',
            error: error.message
        });
    }
});

module.exports = router;
