const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

// Middleware to check if user is admin
const adminAuth = (req, res, next) => {
    if (req.user && req.user.role !== 'admin') {
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

        // Mock statistics for demo purposes
        const stats = {
            users: {
                total: 1,
                newThisMonth: 0
            },
            products: {
                total: 0,
                outOfStock: 0,
                lowStock: 0
            },
            orders: {
                total: 0,
                pending: 0,
                monthly: 0,
                daily: 0,
                byStatus: {}
            },
            revenue: {
                total: 0,
                monthly: 0,
                average: 0
            },
            topProducts: [],
            recentActivity: []
        };

        // Try to get real data if models are available
        try {
            const User = require('../models/User');
            const Product = require('../models/Product');
            const Order = require('../models/Order');

            const [
                totalUsers,
                totalProducts,
                totalOrders,
                pendingOrders,
                monthlyOrders
            ] = await Promise.all([
                User.countDocuments({ role: 'user' }),
                Product.countDocuments({ actif: true }),
                Order.countDocuments(),
                Order.countDocuments({ statut: 'en-attente' }),
                Order.countDocuments({ dateCommande: { $gte: startOfMonth } })
            ]);

            stats.users.total = totalUsers;
            stats.products.total = totalProducts;
            stats.orders.total = totalOrders;
            stats.orders.pending = pendingOrders;
            stats.orders.monthly = monthlyOrders;

            // Get revenue statistics
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

            const revenue = revenueAggregation[0] || stats.revenue;
            stats.revenue.total = Math.round(revenue.totalRevenue || 0);
            stats.revenue.monthly = Math.round(revenue.monthlyRevenue || 0);
            stats.revenue.average = Math.round(revenue.averageOrderValue || 0);

        } catch (modelError) {
            console.log('⚠️ Models not available, using mock data:', modelError.message);
        }

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
        
        // Mock user data
        let users = [
            {
                _id: 'admin-1',
                prenom: 'Admin',
                nom: 'Shifa',
                email: 'pharmaciegaher@gmail.com',
                role: 'admin',
                actif: true,
                dateInscription: new Date()
            }
        ];

        try {
            const User = require('../models/User');
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
            
            users = await User.find(query)
                .select('-password')
                .sort({ dateInscription: -1 })
                .skip(skip)
                .limit(limit);
                
            const total = await User.countDocuments(query);
            const totalPages = Math.ceil(total / limit);
            
            return res.json({
                users,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalUsers: total,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            });

        } catch (modelError) {
            console.log('⚠️ User model not available, using mock data');
        }

        res.json({
            users,
            pagination: {
                currentPage: 1,
                totalPages: 1,
                totalUsers: users.length,
                hasNextPage: false,
                hasPrevPage: false
            }
        });

    } catch (error) {
        console.error('❌ Get users error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des utilisateurs'
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
            uptime: Math.round(process.uptime()),
            memoryUsage: process.memoryUsage(),
            environment: process.env.NODE_ENV || 'development',
            timestamp: new Date().toISOString()
        };

        res.json({
            message: 'Informations système récupérées',
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
