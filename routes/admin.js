const express = require('express');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Settings = require('../models/Settings');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// All routes require admin authentication
router.use(adminAuth);

// @route   GET /api/admin/dashboard
// @desc    Get dashboard statistics
// @access  Private/Admin
router.get('/dashboard', async (req, res) => {
    try {
        console.log('📊 Admin dashboard request by:', req.user.email);
        
        // Get current date ranges
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        
        // Parallel queries for better performance
        const [
            // Basic counts
            totalProducts,
            activeProducts,
            totalOrders,
            totalUsers,
            
            // Orders by status
            pendingOrders,
            confirmedOrders,
            shippedOrders,
            deliveredOrders,
            cancelledOrders,
            
            // Recent activity
            recentOrders,
            recentUsers,
            lowStockProducts,
            featuredProducts,
            promotionProducts,
            
            // Revenue statistics
            monthlyRevenue,
            weeklyRevenue,
            dailyRevenue,
            
            // Popular products
            popularProducts,
            
            // User statistics by wilaya
            usersByWilaya
        ] = await Promise.all([
            // Basic counts
            Product.countDocuments(),
            Product.countDocuments({ actif: true }),
            Order.countDocuments(),
            User.countDocuments({ actif: true }),
            
            // Orders by status
            Order.countDocuments({ statut: 'en-attente' }),
            Order.countDocuments({ statut: 'confirmée' }),
            Order.countDocuments({ statut: 'expédiée' }),
            Order.countDocuments({ statut: 'livrée' }),
            Order.countDocuments({ statut: 'annulée' }),
            
            // Recent activity
            Order.find().sort({ dateCommande: -1 }).limit(5)
                .select('numeroCommande client.nom client.prenom total statut dateCommande'),
            User.find({ actif: true }).sort({ dateInscription: -1 }).limit(5)
                .select('nom prenom email dateInscription role'),
            Product.find({ actif: true, stock: { $lte: 5 } }).sort({ stock: 1 })
                .select('nom stock categorie'),
            Product.countDocuments({ actif: true, enVedette: true }),
            Product.countDocuments({ actif: true, enPromotion: true }),
            
            // Revenue statistics
            Order.aggregate([
                { $match: { dateCommande: { $gte: startOfMonth }, statut: { $ne: 'annulée' } } },
                { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }
            ]),
            Order.aggregate([
                { $match: { dateCommande: { $gte: startOfWeek }, statut: { $ne: 'annulée' } } },
                { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }
            ]),
            Order.aggregate([
                { $match: { dateCommande: { $gte: startOfDay }, statut: { $ne: 'annulée' } } },
                { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }
            ]),
            
            // Popular products (by order frequency)
            Order.aggregate([
                { $match: { statut: { $ne: 'annulée' } } },
                { $unwind: '$articles' },
                { $group: { _id: '$articles.nom', count: { $sum: '$articles.quantite' } } },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ]),
            
            // Users by wilaya
            User.aggregate([
                { $match: { actif: true } },
                { $group: { _id: '$wilaya', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ])
        ]);
        
        // Process revenue data
        const monthlyRevenueData = monthlyRevenue[0] || { total: 0, count: 0 };
        const weeklyRevenueData = weeklyRevenue[0] || { total: 0, count: 0 };
        const dailyRevenueData = dailyRevenue[0] || { total: 0, count: 0 };
        
        // Calculate averages
        const avgOrderValue = totalOrders > 0 ? monthlyRevenueData.total / Math.max(monthlyRevenueData.count, 1) : 0;
        
        // Build dashboard data
        const dashboardStats = {
            overview: {
                totalProducts,
                activeProducts,
                inactiveProducts: totalProducts - activeProducts,
                totalOrders,
                totalUsers,
                featuredProducts,
                promotionProducts
            },
            orders: {
                total: totalOrders,
                pending: pendingOrders,
                confirmed: confirmedOrders,
                shipped: shippedOrders,
                delivered: deliveredOrders,
                cancelled: cancelledOrders,
                byStatus: [
                    { status: 'en-attente', count: pendingOrders, color: '#f59e0b' },
                    { status: 'confirmée', count: confirmedOrders, color: '#10b981' },
                    { status: 'expédiée', count: shippedOrders, color: '#3b82f6' },
                    { status: 'livrée', count: deliveredOrders, color: '#059669' },
                    { status: 'annulée', count: cancelledOrders, color: '#ef4444' }
                ]
            },
            revenue: {
                monthly: {
                    total: Math.round(monthlyRevenueData.total),
                    orders: monthlyRevenueData.count,
                    average: Math.round(avgOrderValue)
                },
                weekly: {
                    total: Math.round(weeklyRevenueData.total),
                    orders: weeklyRevenueData.count
                },
                daily: {
                    total: Math.round(dailyRevenueData.total),
                    orders: dailyRevenueData.count
                }
            },
            recentActivity: {
                orders: recentOrders.map(order => ({
                    id: order._id,
                    numeroCommande: order.numeroCommande,
                    client: `${order.client.prenom} ${order.client.nom}`,
                    total: order.total,
                    statut: order.statut,
                    date: order.dateCommande
                })),
                users: recentUsers.map(user => ({
                    id: user._id,
                    nom: `${user.prenom} ${user.nom}`,
                    email: user.email,
                    role: user.role,
                    dateInscription: user.dateInscription
                }))
            },
            inventory: {
                lowStock: lowStockProducts.map(product => ({
                    id: product._id,
                    nom: product.nom,
                    stock: product.stock,
                    categorie: product.categorie
                })),
                outOfStock: lowStockProducts.filter(p => p.stock === 0).length
            },
            analytics: {
                popularProducts: popularProducts.map(item => ({
                    nom: item._id,
                    quantiteVendue: item.count
                })),
                usersByWilaya: usersByWilaya.map(item => ({
                    wilaya: item._id,
                    count: item.count
                }))
            }
        };
        
        console.log('✅ Dashboard statistics generated');
        
        res.json({
            success: true,
            stats: dashboardStats,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Dashboard statistics error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement des statistiques'
        });
    }
});

// @route   GET /api/admin/products
// @desc    Get all products for admin management
// @access  Private/Admin
router.get('/products', async (req, res) => {
    try {
        console.log('📦 Admin products request by:', req.user.email);
        
        const {
            page = 1,
            limit = 50,
            sortBy = 'dateAjout',
            sortOrder = 'desc',
            status = 'all', // all, active, inactive
            category,
            search
        } = req.query;
        
        // Build filter
        const filter = {};
        
        if (status === 'active') filter.actif = true;
        else if (status === 'inactive') filter.actif = false;
        
        if (category && category !== 'all') filter.categorie = category;
        
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            filter.$or = [
                { nom: searchRegex },
                { description: searchRegex },
                { marque: searchRegex },
                { sousCategorie: searchRegex }
            ];
        }
        
        // Build sort
        const validSortFields = ['nom', 'prix', 'stock', 'dateAjout', 'categorie', 'marque'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'dateAjout';
        const sort = { [sortField]: sortOrder === 'desc' ? -1 : 1 };
        
        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = Math.min(parseInt(limit), 100);
        
        // Execute queries
        const [products, totalProducts, categories] = await Promise.all([
            Product.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(limitNum),
            Product.countDocuments(filter),
            Product.aggregate([
                { $group: { _id: '$categorie', count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ])
        ]);
        
        const totalPages = Math.ceil(totalProducts / limitNum);
        
        console.log(`✅ Found ${products.length} products for admin`);
        
        res.json({
            success: true,
            products,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalProducts,
                hasNextPage: parseInt(page) < totalPages,
                hasPrevPage: parseInt(page) > 1
            },
            categories: categories.map(cat => ({
                nom: cat._id,
                count: cat.count
            })),
            filters: {
                status,
                category,
                search
            }
        });
        
    } catch (error) {
        console.error('❌ Admin products error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement des produits'
        });
    }
});

// @route   GET /api/admin/orders
// @desc    Get all orders for admin management
// @access  Private/Admin
router.get('/orders', async (req, res) => {
    try {
        console.log('📋 Admin orders request by:', req.user.email);
        
        const {
            page = 1,
            limit = 30,
            status,
            dateFrom,
            dateTo,
            search,
            sortBy = 'dateCommande',
            sortOrder = 'desc'
        } = req.query;
        
        // Build filter
        const filter = {};
        
        if (status && status !== 'all') filter.statut = status;
        
        if (dateFrom || dateTo) {
            filter.dateCommande = {};
            if (dateFrom) filter.dateCommande.$gte = new Date(dateFrom);
            if (dateTo) {
                const endDate = new Date(dateTo);
                endDate.setHours(23, 59, 59, 999);
                filter.dateCommande.$lte = endDate;
            }
        }
        
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            filter.$or = [
                { numeroCommande: searchRegex },
                { 'client.nom': searchRegex },
                { 'client.prenom': searchRegex },
                { 'client.email': searchRegex },
                { 'client.telephone': searchRegex }
            ];
        }
        
        // Build sort
        const validSortFields = ['dateCommande', 'total', 'statut', 'numeroCommande'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'dateCommande';
        const sort = { [sortField]: sortOrder === 'desc' ? -1 : 1 };
        
        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = Math.min(parseInt(limit), 100);
        
        // Execute queries
        const [orders, totalOrders, statusStats] = await Promise.all([
            Order.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(limitNum),
            Order.countDocuments(filter),
            Order.aggregate([
                { $group: { _id: '$statut', count: { $sum: 1 } } }
            ])
        ]);
        
        const totalPages = Math.ceil(totalOrders / limitNum);
        
        console.log(`✅ Found ${orders.length} orders for admin`);
        
        res.json({
            success: true,
            orders,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalOrders,
                hasNextPage: parseInt(page) < totalPages,
                hasPrevPage: parseInt(page) > 1
            },
            statusStats: statusStats.reduce((acc, stat) => {
                acc[stat._id] = stat.count;
                return acc;
            }, {}),
            filters: {
                status,
                dateFrom,
                dateTo,
                search
            }
        });
        
    } catch (error) {
        console.error('❌ Admin orders error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement des commandes'
        });
    }
});

// @route   GET /api/admin/users
// @desc    Get all users for admin management
// @access  Private/Admin
router.get('/users', async (req, res) => {
    try {
        console.log('👥 Admin users request by:', req.user.email);
        
        const {
            page = 1,
            limit = 30,
            status = 'all', // all, active, inactive
            role = 'all', // all, client, admin
            wilaya,
            search,
            sortBy = 'dateInscription',
            sortOrder = 'desc'
        } = req.query;
        
        // Build filter
        const filter = {};
        
        if (status === 'active') filter.actif = true;
        else if (status === 'inactive') filter.actif = false;
        
        if (role && role !== 'all') filter.role = role;
        if (wilaya && wilaya !== 'all') filter.wilaya = wilaya;
        
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            filter.$or = [
                { nom: searchRegex },
                { prenom: searchRegex },
                { email: searchRegex },
                { telephone: searchRegex }
            ];
        }
        
        // Build sort
        const validSortFields = ['nom', 'prenom', 'email', 'dateInscription', 'dernierConnexion', 'role'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'dateInscription';
        const sort = { [sortField]: sortOrder === 'desc' ? -1 : 1 };
        
        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = Math.min(parseInt(limit), 100);
        
        // Execute queries
        const [users, totalUsers, wilayas] = await Promise.all([
            User.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(limitNum)
                .select('-password'),
            User.countDocuments(filter),
            User.aggregate([
                { $match: { actif: true } },
                { $group: { _id: '$wilaya', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ])
        ]);
        
        const totalPages = Math.ceil(totalUsers / limitNum);
        
        console.log(`✅ Found ${users.length} users for admin`);
        
        res.json({
            success: true,
            users,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalUsers,
                hasNextPage: parseInt(page) < totalPages,
                hasPrevPage: parseInt(page) > 1
            },
            wilayas: wilayas.map(w => ({
                nom: w._id,
                count: w.count
            })),
            filters: {
                status,
                role,
                wilaya,
                search
            }
        });
        
    } catch (error) {
        console.error('❌ Admin users error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement des utilisateurs'
        });
    }
});

// @route   PATCH /api/admin/products/:id/toggle-active
// @desc    Toggle product active status
// @access  Private/Admin
router.patch('/products/:id/toggle-active', async (req, res) => {
    try {
        console.log('🔄 Toggle product active:', req.params.id, 'by:', req.user.email);
        
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Produit non trouvé'
            });
        }
        
        product.actif = !product.actif;
        await product.save();
        
        console.log(`✅ Product ${product.actif ? 'activated' : 'deactivated'}:`, product.nom);
        
        res.json({
            success: true,
            message: `Produit ${product.actif ? 'activé' : 'désactivé'}`,
            product: {
                id: product._id,
                nom: product.nom,
                actif: product.actif
            }
        });
        
    } catch (error) {
        console.error('❌ Toggle product active error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la modification du statut'
        });
    }
});

// @route   PATCH /api/admin/users/:id/toggle-active
// @desc    Toggle user active status
// @access  Private/Admin
router.patch('/users/:id/toggle-active', async (req, res) => {
    try {
        console.log('🔄 Toggle user active:', req.params.id, 'by:', req.user.email);
        
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }
        
        // Prevent admin from deactivating themselves
        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Vous ne pouvez pas désactiver votre propre compte'
            });
        }
        
        user.actif = !user.actif;
        await user.save();
        
        console.log(`✅ User ${user.actif ? 'activated' : 'deactivated'}:`, user.email);
        
        res.json({
            success: true,
            message: `Utilisateur ${user.actif ? 'activé' : 'désactivé'}`,
            user: {
                id: user._id,
                nom: `${user.prenom} ${user.nom}`,
                email: user.email,
                actif: user.actif
            }
        });
        
    } catch (error) {
        console.error('❌ Toggle user active error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la modification du statut utilisateur'
        });
    }
});

// @route   DELETE /api/admin/orders/:id
// @desc    Delete order permanently (Admin only)
// @access  Private/Admin
router.delete('/orders/:id', async (req, res) => {
    try {
        console.log('🗑️ Admin order deletion:', req.params.id, 'by:', req.user.email);
        
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Commande non trouvée'
            });
        }
        
        // Restore product stock if order wasn't cancelled
        if (order.statut !== 'annulée') {
            for (const item of order.articles) {
                await Product.findByIdAndUpdate(
                    item.productId,
                    { $inc: { stock: item.quantite } }
                );
            }
        }
        
        // Delete the order
        await Order.findByIdAndDelete(req.params.id);
        
        console.log('✅ Order deleted:', order.numeroCommande, 'by admin:', req.user.email);
        
        res.json({
            success: true,
            message: 'Commande supprimée définitivement'
        });
        
    } catch (error) {
        console.error('❌ Admin order deletion error:', error);
        
        if (error.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: 'Commande non trouvée'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression de la commande'
        });
    }
});

// @route   POST /api/admin/cleanup/products
// @desc    Clean up duplicate or invalid products
// @access  Private/Admin
router.post('/cleanup/products', async (req, res) => {
    try {
        console.log('🧹 Product cleanup request by:', req.user.email);
        
        const { action } = req.body; // 'duplicates', 'inactive', 'zero-stock'
        
        let result = { deletedCount: 0, message: '' };
        
        switch (action) {
            case 'duplicates':
                // Find and remove duplicate products (same name and category)
                const duplicates = await Product.aggregate([
                    { $group: { _id: { nom: '$nom', categorie: '$categorie' }, count: { $sum: 1 }, docs: { $push: '$_id' } } },
                    { $match: { count: { $gt: 1 } } }
                ]);
                
                for (const duplicate of duplicates) {
                    // Keep the first one, delete the rest
                    const toDelete = duplicate.docs.slice(1);
                    await Product.deleteMany({ _id: { $in: toDelete } });
                    result.deletedCount += toDelete.length;
                }
                result.message = `${result.deletedCount} produits dupliqués supprimés`;
                break;
                
            case 'inactive':
                // Delete products marked as inactive
                const inactiveResult = await Product.deleteMany({ actif: false });
                result.deletedCount = inactiveResult.deletedCount;
                result.message = `${result.deletedCount} produits inactifs supprimés`;
                break;
                
            case 'zero-stock':
                // Mark zero-stock products as inactive
                const zeroStockResult = await Product.updateMany(
                    { stock: 0 },
                    { $set: { actif: false } }
                );
                result.deletedCount = zeroStockResult.modifiedCount;
                result.message = `${result.deletedCount} produits en rupture désactivés`;
                break;
                
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Action de nettoyage invalide'
                });
        }
        
        console.log('✅ Product cleanup completed:', result.message);
        
        res.json({
            success: true,
            message: result.message,
            affected: result.deletedCount
        });
        
    } catch (error) {
        console.error('❌ Product cleanup error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du nettoyage des produits'
        });
    }
});

// @route   GET /api/admin/export/orders
// @desc    Export orders data (simplified JSON)
// @access  Private/Admin
router.get('/export/orders', async (req, res) => {
    try {
        console.log('📤 Orders export request by:', req.user.email);
        
        const { dateFrom, dateTo, status } = req.query;
        
        const filter = {};
        if (status) filter.statut = status;
        if (dateFrom || dateTo) {
            filter.dateCommande = {};
            if (dateFrom) filter.dateCommande.$gte = new Date(dateFrom);
            if (dateTo) {
                const endDate = new Date(dateTo);
                endDate.setHours(23, 59, 59, 999);
                filter.dateCommande.$lte = endDate;
            }
        }
        
        const orders = await Order.find(filter)
            .sort({ dateCommande: -1 })
            .limit(1000) // Limit for performance
            .lean();
        
        // Simplified export format
        const exportData = orders.map(order => ({
            numeroCommande: order.numeroCommande,
            dateCommande: order.dateCommande,
            client: {
                nom: `${order.client.prenom} ${order.client.nom}`,
                email: order.client.email,
                telephone: order.client.telephone,
                wilaya: order.client.wilaya
            },
            statut: order.statut,
            total: order.total,
            nombreArticles: order.articles.length
        }));
        
        console.log(`✅ Exported ${exportData.length} orders`);
        
        res.json({
            success: true,
            data: exportData,
            count: exportData.length,
            exportDate: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Orders export error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'export des commandes'
        });
    }
});

// @route   GET /api/admin/analytics/sales
// @desc    Get sales analytics
// @access  Private/Admin
router.get('/analytics/sales', async (req, res) => {
    try {
        console.log('📊 Sales analytics request by:', req.user.email);
        
        const { period = 'month' } = req.query; // week, month, year
        
        let matchCondition = { statut: { $ne: 'annulée' } };
        let dateFormat = '%Y-%m-%d';
        
        switch (period) {
            case 'week':
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                matchCondition.dateCommande = { $gte: weekAgo };
                dateFormat = '%Y-%m-%d';
                break;
            case 'year':
                const yearAgo = new Date();
                yearAgo.setFullYear(yearAgo.getFullYear() - 1);
                matchCondition.dateCommande = { $gte: yearAgo };
                dateFormat = '%Y-%m';
                break;
            default: // month
                const monthAgo = new Date();
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                matchCondition.dateCommande = { $gte: monthAgo };
                dateFormat = '%Y-%m-%d';
        }
        
        const salesData = await Order.aggregate([
            { $match: matchCondition },
            {
                $group: {
                    _id: { $dateToString: { format: dateFormat, date: '$dateCommande' } },
                    revenue: { $sum: '$total' },
                    orders: { $sum: 1 },
                    avgOrderValue: { $avg: '$total' }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        
        console.log(`✅ Sales analytics generated for period: ${period}`);
        
        res.json({
            success: true,
            period,
            data: salesData.map(item => ({
                date: item._id,
                revenue: Math.round(item.revenue),
                orders: item.orders,
                avgOrderValue: Math.round(item.avgOrderValue)
            })),
            summary: {
                totalRevenue: salesData.reduce((sum, item) => sum + item.revenue, 0),
                totalOrders: salesData.reduce((sum, item) => sum + item.orders, 0),
                avgOrderValue: salesData.length > 0 ? 
                    Math.round(salesData.reduce((sum, item) => sum + item.avgOrderValue, 0) / salesData.length) : 0
            }
        });
        
    } catch (error) {
        console.error('❌ Sales analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'analyse des ventes'
        });
    }
});

module.exports = router;
