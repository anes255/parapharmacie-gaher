const express = require('express');
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
        console.log('📊 Admin dashboard request from user:', req.user?.email || req.user?.id);
        
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        // Initialize default values
        let stats = {
            products: {
                total: 0,
                active: 0,
                featured: 0,
                inactive: 0
            },
            orders: {
                total: 0,
                pending: 0,
                monthly: 0,
                daily: 0,
                byStatus: {}
            },
            users: {
                total: 1, // At least the admin user exists
                active: 1,
                inactive: 0
            },
            revenue: {
                monthly: 0,
                average: 0
            },
            topProducts: [],
            recentOrders: [],
            timestamp: new Date().toISOString()
        };

        try {
            // Try to load Product model and get product statistics
            const Product = require('../models/Product');
            
            const totalProducts = await Product.countDocuments();
            const activeProducts = await Product.countDocuments({ actif: true });
            const featuredProducts = await Product.countDocuments({ enVedette: true });
            
            stats.products = {
                total: totalProducts,
                active: activeProducts,
                featured: featuredProducts,
                inactive: Math.max(0, totalProducts - activeProducts)
            };
            
            console.log('✅ Product stats loaded');
        } catch (error) {
            console.log('⚠️ Product stats not available:', error.message);
        }

        try {
            // Try to load Order model and get order statistics
            const Order = require('../models/Order');
            
            const totalOrders = await Order.countDocuments();
            const pendingOrders = await Order.countDocuments({ statut: 'en-attente' });
            const monthlyOrders = await Order.countDocuments({ 
                dateCommande: { $gte: startOfMonth } 
            });
            const dailyOrders = await Order.countDocuments({ 
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
            
            const ordersByStatus = statusAggregation.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {});
            
            // Recent orders
            const recentOrders = await Order.find()
                .sort({ dateCommande: -1 })
                .limit(5)
                .select('numeroCommande client total statut dateCommande');
            
            stats.orders = {
                total: totalOrders,
                pending: pendingOrders,
                monthly: monthlyOrders,
                daily: dailyOrders,
                byStatus: ordersByStatus
            };
            
            stats.recentOrders = recentOrders.map(order => ({
                _id: order._id,
                numeroCommande: order.numeroCommande,
                clientName: `${order.client?.prenom || ''} ${order.client?.nom || ''}`.trim(),
                total: order.total,
                statut: order.statut,
                dateCommande: order.dateCommande
            }));
            
            // Revenue calculation
            try {
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
                
                const monthlyRevenue = revenueAggregation[0]?.total || 0;
                stats.revenue = {
                    monthly: monthlyRevenue,
                    average: monthlyOrders > 0 ? Math.round(monthlyRevenue / monthlyOrders) : 0
                };
            } catch (error) {
                console.log('⚠️ Revenue stats not available:', error.message);
            }
            
            // Top selling products
            try {
                const topProducts = await Order.aggregate([
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
                
                stats.topProducts = topProducts;
            } catch (error) {
                console.log('⚠️ Top products stats not available:', error.message);
            }
            
            console.log('✅ Order stats loaded');
        } catch (error) {
            console.log('⚠️ Order stats not available:', error.message);
        }

        try {
            // Try to load User model and get user statistics
            const User = require('../models/User');
            
            const totalUsers = await User.countDocuments();
            const activeUsers = await User.countDocuments({ actif: true });
            
            stats.users = {
                total: totalUsers,
                active: activeUsers,
                inactive: Math.max(0, totalUsers - activeUsers)
            };
            
            console.log('✅ User stats loaded');
        } catch (error) {
            console.log('⚠️ User stats not available:', error.message);
        }
        
        console.log('✅ Dashboard stats compiled successfully');
        res.json(stats);
        
    } catch (error) {
        console.error('❌ Admin dashboard error:', error);
        
        // Return basic stats even if there are errors
        const fallbackStats = {
            products: { total: 0, active: 0, featured: 0, inactive: 0 },
            orders: { total: 0, pending: 0, monthly: 0, daily: 0, byStatus: {} },
            users: { total: 1, active: 1, inactive: 0 },
            revenue: { monthly: 0, average: 0 },
            topProducts: [],
            recentOrders: [],
            timestamp: new Date().toISOString(),
            error: 'Some statistics may not be available'
        };
        
        res.status(200).json(fallbackStats);
    }
});

// @route   GET /api/admin/orders
// @desc    Get all orders for admin management
// @access  Private/Admin
router.get('/orders', async (req, res) => {
    try {
        console.log('📦 Admin getting all orders');
        
        const Order = require('../models/Order');
        
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
        
        // Return empty result if Order model not available
        res.json({
            orders: [],
            pagination: {
                currentPage: 1,
                totalPages: 0,
                totalOrders: 0,
                hasNextPage: false,
                hasPrevPage: false
            },
            error: 'Orders not available'
        });
    }
});

// @route   GET /api/admin/products
// @desc    Get all products for admin management
// @access  Private/Admin
router.get('/products', async (req, res) => {
    try {
        const Product = require('../models/Product');
        
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
        
        res.json({
            products: [],
            pagination: {
                currentPage: 1,
                totalPages: 0,
                totalProducts: 0,
                hasNextPage: false,
                hasPrevPage: false
            },
            error: 'Products not available'
        });
    }
});

// @route   PUT /api/admin/orders/:id
// @desc    Update order status
// @access  Private/Admin
router.put('/orders/:id', async (req, res) => {
    try {
        const { statut } = req.body;
        const Order = require('../models/Order');
        
        console.log(`📦 Admin updating order ${req.params.id} to status: ${statut}`);
        
        let order;
        
        // Try to find by MongoDB ID first, then by order number
        if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
            order = await Order.findById(req.params.id);
        } else {
            order = await Order.findOne({ numeroCommande: req.params.id });
        }
        
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
        const User = require('../models/User');
        
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
        res.json({
            users: [],
            pagination: {
                currentPage: 1,
                totalPages: 0,
                totalUsers: 0,
                hasNextPage: false,
                hasPrevPage: false
            },
            error: 'Users not available'
        });
    }
});

module.exports = router;
