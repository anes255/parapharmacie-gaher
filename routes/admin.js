/ ================================
// FIXED routes/admin.js - Enhanced with better authentication handling
// ================================

const express = require('express');
const Product = require('../models/Product');
const Order = require('../models/Order'); 
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// FIXED: Enhanced auth middleware for admin routes
const requireAdmin = (req, res, next) => {
    console.log('🔐 Admin auth check for user:', req.user?.email, 'Role:', req.user?.role);
    
    if (!req.user) {
        console.log('❌ No user found in request');
        return res.status(401).json({
            success: false,
            message: 'Authentification requise'
        });
    }
    
    if (req.user.role !== 'admin') {
        console.log('❌ User is not admin:', req.user.role);
        return res.status(403).json({
            success: false,
            message: 'Accès refusé. Droits administrateur requis.'
        });
    }
    
    console.log('✅ Admin access granted');
    next();
};

// Apply middleware to all admin routes
router.use(auth);
router.use(requireAdmin);

// GET admin dashboard - FIXED
router.get('/dashboard', async (req, res) => {
    try {
        console.log('📊 Loading admin dashboard for:', req.user.email);
        
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        // Initialize default values
        let stats = {
            products: { total: 0, active: 0, featured: 0, inactive: 0 },
            orders: { total: 0, pending: 0, monthly: 0, daily: 0, byStatus: {} },
            users: { total: 0, active: 0, inactive: 0 },
            revenue: { monthly: 0, average: 0 },
            topProducts: [],
            recentOrders: []
        };

        try {
            // Product statistics
            const totalProducts = await Product.countDocuments();
            const activeProducts = await Product.countDocuments({ actif: true });
            const featuredProducts = await Product.countDocuments({ enVedette: true });
            
            stats.products = {
                total: totalProducts,
                active: activeProducts,
                featured: featuredProducts,
                inactive: Math.max(0, totalProducts - activeProducts)
            };
            
            console.log('📦 Product stats loaded:', stats.products);
        } catch (error) {
            console.log('⚠️ Product stats error:', error.message);
        }

        try {
            // Order statistics
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
            
            stats.recentOrders = recentOrders;
            
            console.log('🛍️ Order stats loaded:', stats.orders);
        } catch (error) {
            console.log('⚠️ Order stats error:', error.message);
        }

        try {
            // User statistics
            const totalUsers = await User.countDocuments();
            const activeUsers = await User.countDocuments({ actif: true });
            
            stats.users = {
                total: totalUsers,
                active: activeUsers,
                inactive: Math.max(0, totalUsers - activeUsers)
            };
            
            console.log('👥 User stats loaded:', stats.users);
        } catch (error) {
            console.log('⚠️ User stats error:', error.message);
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
            
            const monthlyRevenue = revenueAggregation[0]?.total || 0;
            
            stats.revenue = {
                monthly: monthlyRevenue,
                average: stats.orders.monthly > 0 ? Math.round(monthlyRevenue / stats.orders.monthly) : 0
            };
            
            console.log('💰 Revenue stats loaded:', stats.revenue);
        } catch (error) {
            console.log('⚠️ Revenue stats error:', error.message);
        }

        try {
            // Top selling products
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
            
            console.log('🏆 Top products loaded:', topProducts.length);
        } catch (error) {
            console.log('⚠️ Top products error:', error.message);
            stats.topProducts = [];
        }

        console.log('✅ Dashboard stats completed');
        
        res.json({
            success: true,
            ...stats,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques',
            error: error.message
        });
    }
});

// GET admin products - FIXED
router.get('/products', async (req, res) => {
    try {
        console.log('📦 Admin getting products with filters:', req.query);
        
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
        
        console.log(`✅ Retrieved ${products.length} products out of ${total} total`);
        
        res.json({
            success: true,
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
            success: false,
            message: 'Erreur lors de la récupération des produits',
            error: error.message
        });
    }
});

// POST create product - FIXED
router.post('/products', async (req, res) => {
    try {
        console.log('📦 Admin creating product:', req.body.nom);
        
        const productData = {
            ...req.body,
            dateAjout: new Date()
        };
        
        const product = new Product(productData);
        await product.save();
        
        console.log('✅ Product created successfully:', product._id);
        
        res.status(201).json({
            success: true,
            message: 'Produit créé avec succès',
            product
        });
        
    } catch (error) {
        console.error('❌ Product creation error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: messages[0] || 'Données de produit invalides'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la création du produit',
            error: error.message
        });
    }
});

// PUT update product - FIXED
router.put('/products/:id', async (req, res) => {
    try {
        console.log('📦 Admin updating product:', req.params.id);
        
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                success: false,
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
            success: true,
            message: 'Produit mis à jour avec succès',
            product
        });
        
    } catch (error) {
        console.error('❌ Product update error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: messages[0] || 'Données de produit invalides'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour du produit',
            error: error.message
        });
    }
});

// DELETE product - FIXED
router.delete('/products/:id', async (req, res) => {
    try {
        console.log('📦 Admin deleting product:', req.params.id);
        
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Produit non trouvé'
            });
        }
        
        await Product.findByIdAndDelete(req.params.id);
        
        console.log('✅ Product deleted successfully:', req.params.id);
        
        res.json({
            success: true,
            message: 'Produit supprimé avec succès'
        });
        
    } catch (error) {
        console.error('❌ Product deletion error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression du produit',
            error: error.message
        });
    }
});

// GET admin orders - FIXED
router.get('/orders', async (req, res) => {
    try {
        console.log('🛍️ Admin getting orders with filters:', req.query);
        
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
            success: true,
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
            success: false,
            message: 'Erreur lors de la récupération des commandes',
            error: error.message
        });
    }
});

// PUT update order status - FIXED
router.put('/orders/:id', async (req, res) => {
    try {
        const { statut } = req.body;
        
        console.log(`🛍️ Admin updating order ${req.params.id} to status: ${statut}`);
        
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Commande non trouvée'
            });
        }
        
        // Validate status
        const validStatuses = ['en-attente', 'confirmée', 'préparée', 'expédiée', 'livrée', 'annulée'];
        if (!validStatuses.includes(statut)) {
            return res.status(400).json({
                success: false,
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
            success: true,
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
            success: false,
            message: 'Erreur lors de la mise à jour de la commande',
            error: error.message
        });
    }
});

module.exports = router;
