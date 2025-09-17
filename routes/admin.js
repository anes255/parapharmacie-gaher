const express = require('express');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const auth = require('../middleware/auth');

const router = express.Router();

// Middleware to check if user is admin
const adminAuth = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            message: 'Accès administrateur requis'
        });
    }
    next();
};

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private/Admin
router.get('/dashboard', auth, adminAuth, async (req, res) => {
    try {
        console.log('📊 Loading admin dashboard statistics...');
        
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));

        // Get basic counts
        const [
            totalUsers,
            totalProducts,
            totalOrders,
            pendingOrders,
            monthlyOrders,
            dailyOrders
        ] = await Promise.all([
            User.countDocuments({ role: 'user' }),
            Product.countDocuments({ actif: true }),
            Order.countDocuments(),
            Order.countDocuments({ statut: 'en-attente' }),
            Order.countDocuments({ dateCommande: { $gte: startOfMonth } }),
            Order.countDocuments({ dateCommande: { $gte: startOfDay } })
        ]);

        // Calculate revenue statistics
        const revenueAggregation = await Order.aggregate([
            {
                $match: {
                    statut: { $in: ['confirmée', 'préparée', 'expédiée', 'livrée'] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$total' },
                    monthlyRevenue: {
                        $sum: {
                            $cond: [
                                { $gte: ['$dateCommande', startOfMonth] },
                                '$total',
                                0
                            ]
                        }
                    },
                    averageOrderValue: { $avg: '$total' }
                }
            }
        ]);

        const revenue = revenueAggregation[0] || {
            totalRevenue: 0,
            monthlyRevenue: 0,
            averageOrderValue: 0
        };

        // Get orders by status
        const ordersByStatus = await Order.aggregate([
            {
                $group: {
                    _id: '$statut',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Get top selling products
        const topProducts = await Order.aggregate([
            { $unwind: '$articles' },
            {
                $group: {
                    _id: '$articles.productId',
                    nom: { $first: '$articles.nom' },
                    totalQuantity: { $sum: '$articles.quantite' },
                    totalRevenue: { $sum: { $multiply: ['$articles.quantite', '$articles.prix'] } }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 5 }
        ]);

        // Get recent activity (recent orders)
        const recentOrders = await Order.find()
            .select('numeroCommande client.prenom client.nom total statut dateCommande')
            .sort({ dateCommande: -1 })
            .limit(10);

        const stats = {
            users: {
                total: totalUsers,
                newThisMonth: await User.countDocuments({ 
                    dateInscription: { $gte: startOfMonth },
                    role: 'user'
                })
            },
            products: {
                total: totalProducts,
                outOfStock: await Product.countDocuments({ stock: 0, actif: true }),
                lowStock: await Product.countDocuments({ stock: { $lte: 5 }, actif: true })
            },
            orders: {
                total: totalOrders,
                pending: pendingOrders,
                monthly: monthlyOrders,
                daily: dailyOrders,
                byStatus: ordersByStatus.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {})
            },
            revenue: {
                total: Math.round(revenue.totalRevenue || 0),
                monthly: Math.round(revenue.monthlyRevenue || 0),
                average: Math.round(revenue.averageOrderValue || 0)
            },
            topProducts,
            recentActivity: recentOrders
        };

        console.log('✅ Dashboard statistics loaded successfully');
        
        res.json({
            message: 'Statistiques du tableau de bord récupérées',
            stats
        });

    } catch (error) {
        console.error('❌ Dashboard statistics error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des statistiques'
        });
    }
});

// @route   GET /api/admin/users
// @desc    Get all users with pagination
// @access  Private/Admin
router.get('/users', auth, adminAuth, async (req, res) => {
    try {
        console.log('👥 Loading users for admin...');
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        let query = {};
        
        // Filter by role
        if (req.query.role) {
            query.role = req.query.role;
        }
        
        // Search by name or email
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            query.$or = [
                { prenom: searchRegex },
                { nom: searchRegex },
                { email: searchRegex }
            ];
        }
        
        const users = await User.find(query)
            .select('-password')
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
        console.error('❌ Get users error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des utilisateurs'
        });
    }
});

// @route   PUT /api/admin/users/:id/status
// @desc    Update user active status
// @access  Private/Admin
router.put('/users/:id/status', auth, adminAuth, async (req, res) => {
    try {
        const { actif } = req.body;
        
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                message: 'Utilisateur non trouvé'
            });
        }
        
        // Prevent admin from disabling themselves
        if (user._id.toString() === req.user.id && !actif) {
            return res.status(400).json({
                message: 'Vous ne pouvez pas désactiver votre propre compte'
            });
        }
        
        user.actif = actif;
        await user.save();
        
        console.log(`✅ User ${user.email} status updated to: ${actif ? 'active' : 'inactive'}`);
        
        res.json({
            message: `Utilisateur ${actif ? 'activé' : 'désactivé'} avec succès`,
            user: {
                id: user._id,
                email: user.email,
                actif: user.actif
            }
        });

    } catch (error) {
        console.error('❌ Update user status error:', error);
        res.status(500).json({
            message: 'Erreur lors de la mise à jour du statut utilisateur'
        });
    }
});

// @route   GET /api/admin/products/low-stock
// @desc    Get products with low stock
// @access  Private/Admin
router.get('/products/low-stock', auth, adminAuth, async (req, res) => {
    try {
        console.log('📦 Getting low stock products...');
        
        const threshold = parseInt(req.query.threshold) || 5;
        
        const lowStockProducts = await Product.find({
            stock: { $lte: threshold },
            actif: true
        }).sort({ stock: 1 });

        res.json({
            products: lowStockProducts,
            count: lowStockProducts.length,
            threshold
        });

    } catch (error) {
        console.error('❌ Get low stock products error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des produits en stock faible'
        });
    }
});

// @route   GET /api/admin/orders/export
// @desc    Export orders data
// @access  Private/Admin
router.get('/orders/export', auth, adminAuth, async (req, res) => {
    try {
        console.log('📊 Exporting orders data...');
        
        let query = {};
        
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
            .sort({ dateCommande: -1 });
        
        // Transform data for export
        const exportData = orders.map(order => ({
            numeroCommande: order.numeroCommande,
            clientNom: `${order.client.prenom} ${order.client.nom}`,
            clientEmail: order.client.email,
            clientTelephone: order.client.telephone,
            clientWilaya: order.client.wilaya,
            dateCommande: order.dateCommande.toISOString().split('T')[0],
            statut: order.statut,
            sousTotal: order.sousTotal,
            fraisLivraison: order.fraisLivraison,
            total: order.total,
            modePaiement: order.modePaiement,
            nombreArticles: order.articles.length
        }));

        res.json({
            data: exportData,
            count: exportData.length,
            exportDate: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Export orders error:', error);
        res.status(500).json({
            message: 'Erreur lors de l\'export des commandes'
        });
    }
});

// @route   GET /api/admin/analytics/sales
// @desc    Get sales analytics
// @access  Private/Admin
router.get('/analytics/sales', auth, adminAuth, async (req, res) => {
    try {
        console.log('📈 Getting sales analytics...');
        
        const period = req.query.period || 'month'; // day, week, month, year
        const now = new Date();
        let startDate;
        
        switch (period) {
            case 'day':
                startDate = new Date(now.setHours(0, 0, 0, 0));
                break;
            case 'week':
                startDate = new Date(now.setDate(now.getDate() - 7));
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        // Sales over time
        const salesData = await Order.aggregate([
            {
                $match: {
                    dateCommande: { $gte: startDate },
                    statut: { $in: ['confirmée', 'préparée', 'expédiée', 'livrée'] }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: period === 'day' ? '%H' : '%Y-%m-%d',
                            date: '$dateCommande'
                        }
                    },
                    sales: { $sum: '$total' },
                    orders: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Top selling products
        const topProducts = await Order.aggregate([
            { $match: { dateCommande: { $gte: startDate } } },
            { $unwind: '$articles' },
            {
                $group: {
                    _id: '$articles.nom',
                    totalQuantity: { $sum: '$articles.quantite' },
                    totalRevenue: { $sum: { $multiply: ['$articles.quantite', '$articles.prix'] } }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 10 }
        ]);

        res.json({
            period,
            salesData,
            topProducts,
            startDate
        });

    } catch (error) {
        console.error('❌ Sales analytics error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des analyses de ventes'
        });
    }
});

// @route   POST /api/admin/notifications/broadcast
// @desc    Send broadcast notification to users
// @access  Private/Admin
router.post('/notifications/broadcast', auth, adminAuth, async (req, res) => {
    try {
        console.log('📢 Broadcasting notification...');
        
        const { title, message, type = 'info' } = req.body;
        
        if (!title || !message) {
            return res.status(400).json({
                message: 'Titre et message requis'
            });
        }

        // In a real application, you would save this notification to a database
        // and possibly send push notifications, emails, etc.
        
        const notification = {
            id: Date.now().toString(),
            title,
            message,
            type,
            dateCreated: new Date(),
            sentBy: req.user.id
        };

        // For now, we'll just return success
        // In production, you might want to:
        // 1. Save to notifications collection
        // 2. Send email notifications
        // 3. Send push notifications
        // 4. Update user notification preferences

        console.log('✅ Notification broadcasted successfully');
        
        res.json({
            message: 'Notification diffusée avec succès',
            notification
        });

    } catch (error) {
        console.error('❌ Broadcast notification error:', error);
        res.status(500).json({
            message: 'Erreur lors de la diffusion de la notification'
        });
    }
});

// @route   GET /api/admin/system/info
// @desc    Get system information
// @access  Private/Admin
router.get('/system/info', auth, adminAuth, (req, res) => {
    try {
        const systemInfo = {
            nodeVersion: process.version,
            platform: process.platform,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
            environment: process.env.NODE_ENV || 'development',
            timestamp: new Date().toISOString()
        };

        res.json({
            system: systemInfo
        });

    } catch (error) {
        console.error('❌ System info error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des informations système'
        });
    }
});

module.exports = router;
