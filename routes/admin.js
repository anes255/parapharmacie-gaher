const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');

const router = express.Router();

// Admin middleware
const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            message: 'Accès administrateur requis'
        });
    }
    next();
};

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private/Admin
router.get('/dashboard', auth, requireAdmin, async (req, res) => {
    try {
        console.log('📊 Admin dashboard requested by:', req.user.email);
        
        const Product = mongoose.model('Product');
        const Order = mongoose.model('Order');
        const User = mongoose.model('User');
        
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        // Get basic statistics
        const totalProducts = await Product.countDocuments({ actif: true });
        const totalOrders = await Order.countDocuments();
        const pendingOrders = await Order.countDocuments({ statut: 'en-attente' });
        const totalUsers = await User.countDocuments({ actif: true, role: 'user' });
        
        // Monthly orders
        const monthlyOrders = await Order.countDocuments({
            dateCommande: { $gte: startOfMonth }
        });
        
        // Monthly revenue
        const monthlyRevenueResult = await Order.aggregate([
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
        
        const monthlyRevenue = monthlyRevenueResult[0]?.total || 0;
        
        // Orders by status
        const ordersByStatus = await Order.aggregate([
            {
                $group: {
                    _id: '$statut',
                    count: { $sum: 1 }
                }
            }
        ]);
        
        // Recent orders
        const recentOrders = await Order.find()
            .sort({ dateCommande: -1 })
            .limit(5)
            .lean();
        
        // Low stock products
        const lowStockProducts = await Product.find({
            stock: { $lte: 5 },
            actif: true
        }).limit(10).lean();
        
        res.json({
            success: true,
            stats: {
                totalProducts,
                totalOrders,
                pendingOrders,
                totalUsers,
                monthlyOrders,
                monthlyRevenue
            },
            ordersByStatus: ordersByStatus.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {}),
            recentOrders,
            lowStockProducts
        });
        
    } catch (error) {
        console.error('❌ Admin dashboard error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des statistiques'
        });
    }
});

// @route   GET /api/admin/orders
// @desc    Get all orders for admin
// @access  Private/Admin
router.get('/orders', auth, requireAdmin, async (req, res) => {
    try {
        console.log('📦 Admin getting all orders');
        
        const Order = mongoose.model('Order');
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
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
            .limit(limit)
            .lean();
            
        const total = await Order.countDocuments(query);
        const totalPages = Math.ceil(total / limit);
        
        console.log(`✅ Found ${orders.length} orders for admin`);
        
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
        console.error('❌ Admin get orders error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des commandes'
        });
    }
});

// @route   PUT /api/admin/orders/:id
// @desc    Update order status (Admin only)
// @access  Private/Admin
router.put('/orders/:id', auth, requireAdmin, async (req, res) => {
    try {
        const { statut } = req.body;
        const Order = mongoose.model('Order');
        
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
        
        // Set delivery date if delivered
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
            message: 'Erreur lors de la mise à jour de la commande'
        });
    }
});

// @route   GET /api/admin/products
// @desc    Get all products for admin (including inactive)
// @access  Private/Admin
router.get('/products', auth, requireAdmin, async (req, res) => {
    try {
        console.log('📦 Admin getting all products');
        
        const Product = mongoose.model('Product');
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        
        let query = {};
        
        // Filter by category
        if (req.query.categorie) {
            query.categorie = req.query.categorie;
        }
        
        // Filter by status
        if (req.query.actif !== undefined) {
            query.actif = req.query.actif === 'true';
        }
        
        // Search
        if (req.query.search) {
            query.$or = [
                { nom: { $regex: req.query.search, $options: 'i' } },
                { description: { $regex: req.query.search, $options: 'i' } },
                { marque: { $regex: req.query.search, $options: 'i' } }
            ];
        }
        
        const products = await Product.find(query)
            .sort({ dateAjout: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
            
        const total = await Product.countDocuments(query);
        const totalPages = Math.ceil(total / limit);
        
        console.log(`✅ Found ${products.length} products for admin`);
        
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
        console.error('❌ Admin get products error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des produits'
        });
    }
});

// @route   POST /api/admin/products
// @desc    Create new product (Admin only)
// @access  Private/Admin
router.post('/products', auth, requireAdmin, async (req, res) => {
    try {
        const Product = mongoose.model('Product');
        
        const {
            nom,
            description,
            prix,
            prixOriginal,
            stock,
            categorie,
            marque,
            ingredients,
            modeEmploi,
            precautions,
            image,
            enVedette,
            enPromotion,
            actif
        } = req.body;
        
        // Validation
        if (!nom || !description || prix === undefined || stock === undefined || !categorie) {
            return res.status(400).json({
                message: 'Veuillez remplir tous les champs obligatoires (nom, description, prix, stock, categorie)'
            });
        }
        
        // Create product data
        const productData = {
            nom: nom.trim(),
            description: description.trim(),
            prix: parseFloat(prix),
            stock: parseInt(stock),
            categorie,
            marque: marque ? marque.trim() : '',
            actif: actif !== false,
            enVedette: enVedette || false,
            enPromotion: enPromotion || false
        };
        
        // Add optional fields
        if (prixOriginal) {
            productData.prixOriginal = parseFloat(prixOriginal);
            
            if (productData.enPromotion && productData.prixOriginal > productData.prix) {
                productData.pourcentagePromotion = Math.round(
                    (productData.prixOriginal - productData.prix) / productData.prixOriginal * 100
                );
            }
        }
        
        if (ingredients) productData.ingredients = ingredients.trim();
        if (modeEmploi) productData.modeEmploi = modeEmploi.trim();
        if (precautions) productData.precautions = precautions.trim();
        if (image) productData.image = image;
        
        const product = new Product(productData);
        await product.save();
        
        console.log('✅ Product created by admin:', product.nom);
        
        res.status(201).json({
            success: true,
            message: 'Produit créé avec succès',
            product
        });
        
    } catch (error) {
        console.error('❌ Admin create product error:', error);
        
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
// @desc    Update product (Admin only)
// @access  Private/Admin
router.put('/products/:id', auth, requireAdmin, async (req, res) => {
    try {
        const Product = mongoose.model('Product');
        
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                message: 'Produit non trouvé'
            });
        }
        
        // Update fields if provided
        const allowedFields = [
            'nom', 'description', 'prix', 'prixOriginal', 'stock', 'categorie',
            'marque', 'ingredients', 'modeEmploi', 'precautions', 'image',
            'enVedette', 'enPromotion', 'actif'
        ];
        
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                if (field === 'prix' || field === 'prixOriginal') {
                    product[field] = parseFloat(req.body[field]);
                } else if (field === 'stock') {
                    product[field] = parseInt(req.body[field]);
                } else {
                    product[field] = req.body[field];
                }
            }
        });
        
        // Calculate promotion percentage if applicable
        if (product.enPromotion && product.prixOriginal && product.prixOriginal > product.prix) {
            product.pourcentagePromotion = Math.round(
                (product.prixOriginal - product.prix) / product.prixOriginal * 100
            );
        } else {
            product.pourcentagePromotion = 0;
        }
        
        await product.save();
        
        console.log('✅ Product updated by admin:', product.nom);
        
        res.json({
            success: true,
            message: 'Produit mis à jour avec succès',
            product
        });
        
    } catch (error) {
        console.error('❌ Admin update product error:', error);
        
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
// @desc    Delete product (Admin only)
// @access  Private/Admin
router.delete('/products/:id', auth, requireAdmin, async (req, res) => {
    try {
        const Product = mongoose.model('Product');
        
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                message: 'Produit non trouvé'
            });
        }
        
        await Product.findByIdAndDelete(req.params.id);
        
        console.log('✅ Product deleted by admin:', product.nom);
        
        res.json({
            success: true,
            message: 'Produit supprimé avec succès'
        });
        
    } catch (error) {
        console.error('❌ Admin delete product error:', error);
        res.status(500).json({
            message: 'Erreur lors de la suppression du produit'
        });
    }
});

// @route   GET /api/admin/users
// @desc    Get all users (Admin only)
// @access  Private/Admin
router.get('/users', auth, requireAdmin, async (req, res) => {
    try {
        const User = mongoose.model('User');
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        const users = await User.find({ role: 'user' })
            .select('-password')
            .sort({ dateInscription: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
            
        const total = await User.countDocuments({ role: 'user' });
        const totalPages = Math.ceil(total / limit);
        
        res.json({
            success: true,
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
        console.error('❌ Admin get users error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des utilisateurs'
        });
    }
});

module.exports = router;
