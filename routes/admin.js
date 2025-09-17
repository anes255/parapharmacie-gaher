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
        console.log('📊 Admin dashboard request');
        
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        // Get various statistics
        const [
            totalProducts,
            activeProducts,
            featuredProducts,
            totalOrders,
            pendingOrders,
            monthlyOrders,
            dailyOrders,
            totalUsers,
            activeUsers,
            monthlyRevenue,
            ordersByStatus,
            topProducts,
            recentOrders
        ] = await Promise.all([
            // Product statistics
            Product.countDocuments(),
            Product.countDocuments({ actif: true }),
            Product.countDocuments({ enVedette: true }),
            
            // Order statistics
            Order.countDocuments(),
            Order.countDocuments({ statut: 'en-attente' }),
            Order.countDocuments({ 
                dateCommande: { $gte: startOfMonth } 
            }),
            Order.countDocuments({ 
                dateCommande: { $gte: startOfDay } 
            }),
            
            // User statistics
            User.countDocuments(),
            User.countDocuments({ actif: true }),
            
            // Revenue calculation
            Order.aggregate([
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
            ]),
            
            // Orders by status
            Order.aggregate([
                {
                    $group: {
                        _id: '$statut',
                        count: { $sum: 1 }
                    }
                }
            ]),
            
            // Top selling products (based on order frequency)
            Order.aggregate([
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
            ]),
            
            // Recent orders
            Order.find()
                .sort({ dateCommande: -1 })
                .limit(5)
                .select('numeroCommande client total statut dateCommande')
        ]);
        
        const dashboardData = {
            products: {
                total: totalProducts,
                active: activeProducts,
                featured: featuredProducts,
                inactive: totalProducts - activeProducts
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
            users: {
                total: totalUsers,
                active: activeUsers,
                inactive: totalUsers - activeUsers
            },
            revenue: {
                monthly: monthlyRevenue[0]?.total || 0,
                average: monthlyOrders > 0 ? Math.round((monthlyRevenue[0]?.total || 0) / monthlyOrders) : 0
            },
            topProducts: topProducts,
            recentOrders: recentOrders
        };
        
        res.json(dashboardData);
        
    } catch (error) {
        console.error('❌ Admin dashboard error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des statistiques'
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
            message: 'Erreur lors de la récupération des produits'
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
            message: 'Erreur serveur lors de la création du produit'
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
            message: 'Erreur lors de la mise à jour du produit'
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
            message: 'Erreur lors de la suppression du produit'
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
            message: 'Erreur lors de la récupération des utilisateurs'
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
            message: 'Erreur lors de la mise à jour de l\'utilisateur'
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
            message: 'Erreur lors de la suppression de l\'utilisateur'
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
        
        // Category analytics
        const categoryAnalytics = await Order.aggregate([
            { $unwind: '$articles' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'articles.productId',
                    foreignField: '_id',
                    as: 'productInfo'
                }
            },
            { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: '$productInfo.categorie',
                    totalSold: { $sum: '$articles.quantite' },
                    revenue: { $sum: { $multiply: ['$articles.prix', '$articles.quantite'] } }
                }
            },
            { $sort: { revenue: -1 } }
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
            dailyOrders,
            categoryAnalytics,
            userRegistrations,
            period: {
                days,
                startDate,
                endDate: new Date()
            }
        });
        
    } catch (error) {
        console.error('❌ Admin analytics error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des analyses'
        });
    }
});

module.exports = router;
