const express = require('express');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// Middleware pour vérifier les droits admin
const adminAuth = async (req, res, next) => {
    try {
        await auth(req, res, () => {});
        
        const user = await User.findById(req.user.id);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({
                message: 'Accès refusé - Droits administrateur requis'
            });
        }
        
        next();
    } catch (error) {
        return res.status(401).json({
            message: 'Token invalide'
        });
    }
};

// Configuration multer pour upload d'images
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Seules les images sont autorisées'), false);
        }
    }
});

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private (Admin only)
router.get('/dashboard', adminAuth, async (req, res) => {
    try {
        console.log('📊 Loading admin dashboard...');
        
        // Statistiques produits
        const totalProducts = await Product.countDocuments();
        const activeProducts = await Product.countDocuments({ actif: true });
        const featuredProducts = await Product.countDocuments({ enVedette: true });
        const promotionProducts = await Product.countDocuments({ enPromotion: true });
        
        // Statistiques commandes
        const totalOrders = await Order.countDocuments();
        const pendingOrders = await Order.countDocuments({ statut: 'en-attente' });
        const confirmedOrders = await Order.countDocuments({ statut: 'confirmée' });
        const deliveredOrders = await Order.countDocuments({ statut: 'livrée' });
        
        // Statistiques utilisateurs
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ actif: true });
        
        // Revenus du mois
        const currentMonth = new Date();
        const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const monthlyOrders = await Order.find({
            dateCommande: { $gte: startOfMonth },
            statut: { $in: ['confirmée', 'expédiée', 'livrée'] }
        });
        
        const monthlyRevenue = monthlyOrders.reduce((sum, order) => sum + (order.total || 0), 0);
        
        // Produits avec stock faible
        const lowStockProducts = await Product.find({ 
            stock: { $lte: 5 }, 
            actif: true 
        }).limit(10);
        
        // Commandes récentes
        const recentOrders = await Order.find()
            .sort({ dateCommande: -1 })
            .limit(5)
            .populate('client', 'nom prenom email');
        
        const stats = {
            products: {
                total: totalProducts,
                active: activeProducts,
                featured: featuredProducts,
                promotions: promotionProducts
            },
            orders: {
                total: totalOrders,
                pending: pendingOrders,
                confirmed: confirmedOrders,
                delivered: deliveredOrders
            },
            users: {
                total: totalUsers,
                active: activeUsers
            },
            revenue: {
                monthly: monthlyRevenue,
                currency: 'DA'
            },
            lowStockProducts,
            recentOrders
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
// @access  Private (Admin only)
router.get('/products', adminAuth, async (req, res) => {
    try {
        console.log('📦 Loading all products for admin...');
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        
        let query = {};
        
        // Filtres admin
        if (req.query.categorie) {
            query.categorie = req.query.categorie;
        }
        
        if (req.query.actif !== undefined) {
            query.actif = req.query.actif === 'true';
        }
        
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
            .limit(limit);
            
        const total = await Product.countDocuments(query);
        
        console.log(`✅ Loaded ${products.length} products for admin`);
        
        res.json({
            products,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalProducts: total
            }
        });
        
    } catch (error) {
        console.error('❌ Admin products error:', error);
        res.status(500).json({
            message: 'Erreur lors du chargement des produits'
        });
    }
});

// @route   POST /api/admin/products
// @desc    Create new product
// @access  Private (Admin only)
router.post('/products', adminAuth, upload.single('image'), async (req, res) => {
    try {
        console.log('➕ Creating new product...');
        console.log('Product data:', req.body);
        
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
            enVedette,
            enPromotion,
            actif
        } = req.body;
        
        // Validation
        if (!nom || !description || !prix || !stock || !categorie) {
            return res.status(400).json({
                message: 'Champs obligatoires manquants'
            });
        }
        
        // Prepare product data
        const productData = {
            nom: nom.trim(),
            description: description.trim(),
            prix: parseFloat(prix),
            stock: parseInt(stock),
            categorie,
            actif: actif !== 'false',
            enVedette: enVedette === 'true',
            enPromotion: enPromotion === 'true',
            dateAjout: new Date()
        };
        
        // Optional fields
        if (marque) productData.marque = marque.trim();
        if (ingredients) productData.ingredients = ingredients.trim();
        if (modeEmploi) productData.modeEmploi = modeEmploi.trim();
        if (precautions) productData.precautions = precautions.trim();
        
        // Handle promotion
        if (prixOriginal && productData.enPromotion) {
            productData.prixOriginal = parseFloat(prixOriginal);
            if (productData.prixOriginal > productData.prix) {
                productData.pourcentagePromotion = Math.round(
                    ((productData.prixOriginal - productData.prix) / productData.prixOriginal) * 100
                );
            }
        }
        
        // Handle image
        if (req.file) {
            // Convert image to base64 for storage
            const imageBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
            productData.image = imageBase64;
            console.log('Image uploaded and converted to base64');
        } else if (req.body.imageUrl) {
            // Use provided image URL/base64
            productData.image = req.body.imageUrl;
        }
        
        // Create product
        const product = new Product(productData);
        await product.save();
        
        console.log('✅ Product created:', product._id);
        
        res.status(201).json({
            message: 'Produit créé avec succès',
            product
        });
        
    } catch (error) {
        console.error('❌ Create product error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: messages[0] || 'Données invalides'
            });
        }
        
        res.status(500).json({
            message: 'Erreur lors de la création du produit'
        });
    }
});

// @route   PUT /api/admin/products/:id
// @desc    Update product
// @access  Private (Admin only)
router.put('/products/:id', adminAuth, upload.single('image'), async (req, res) => {
    try {
        console.log('🔄 Updating product:', req.params.id);
        
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({
                message: 'Produit non trouvé'
            });
        }
        
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
            enVedette,
            enPromotion,
            actif
        } = req.body;
        
        // Update fields
        if (nom) product.nom = nom.trim();
        if (description) product.description = description.trim();
        if (prix !== undefined) product.prix = parseFloat(prix);
        if (stock !== undefined) product.stock = parseInt(stock);
        if (categorie) product.categorie = categorie;
        if (marque !== undefined) product.marque = marque.trim();
        if (ingredients !== undefined) product.ingredients = ingredients.trim();
        if (modeEmploi !== undefined) product.modeEmploi = modeEmploi.trim();
        if (precautions !== undefined) product.precautions = precautions.trim();
        if (actif !== undefined) product.actif = actif !== 'false';
        if (enVedette !== undefined) product.enVedette = enVedette === 'true';
        if (enPromotion !== undefined) product.enPromotion = enPromotion === 'true';
        
        // Handle promotion
        if (prixOriginal !== undefined) {
            if (prixOriginal && product.enPromotion) {
                product.prixOriginal = parseFloat(prixOriginal);
                if (product.prixOriginal > product.prix) {
                    product.pourcentagePromotion = Math.round(
                        ((product.prixOriginal - product.prix) / product.prixOriginal) * 100
                    );
                }
            } else {
                product.prixOriginal = null;
                product.pourcentagePromotion = 0;
            }
        }
        
        // Handle image update
        if (req.file) {
            const imageBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
            product.image = imageBase64;
            console.log('New image uploaded');
        } else if (req.body.imageUrl) {
            product.image = req.body.imageUrl;
        }
        
        await product.save();
        
        console.log('✅ Product updated:', product._id);
        
        res.json({
            message: 'Produit mis à jour avec succès',
            product
        });
        
    } catch (error) {
        console.error('❌ Update product error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: messages[0] || 'Données invalides'
            });
        }
        
        res.status(500).json({
            message: 'Erreur lors de la mise à jour du produit'
        });
    }
});

// @route   DELETE /api/admin/products/:id
// @desc    Delete product
// @access  Private (Admin only)
router.delete('/products/:id', adminAuth, async (req, res) => {
    try {
        console.log('🗑️ Deleting product:', req.params.id);
        
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({
                message: 'Produit non trouvé'
            });
        }
        
        await Product.findByIdAndDelete(req.params.id);
        
        console.log('✅ Product deleted:', req.params.id);
        
        res.json({
            message: 'Produit supprimé avec succès'
        });
        
    } catch (error) {
        console.error('❌ Delete product error:', error);
        res.status(500).json({
            message: 'Erreur lors de la suppression du produit'
        });
    }
});

// @route   GET /api/admin/orders
// @desc    Get all orders for admin
// @access  Private (Admin only)
router.get('/orders', adminAuth, async (req, res) => {
    try {
        console.log('📋 Loading orders for admin...');
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        let query = {};
        
        if (req.query.statut) {
            query.statut = req.query.statut;
        }
        
        const orders = await Order.find(query)
            .populate('client', 'nom prenom email telephone adresse wilaya')
            .sort({ dateCommande: -1 })
            .skip(skip)
            .limit(limit);
            
        const total = await Order.countDocuments(query);
        
        console.log(`✅ Loaded ${orders.length} orders for admin`);
        
        res.json({
            orders,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalOrders: total
            }
        });
        
    } catch (error) {
        console.error('❌ Admin orders error:', error);
        res.status(500).json({
            message: 'Erreur lors du chargement des commandes'
        });
    }
});

// @route   PUT /api/admin/orders/:id
// @desc    Update order status
// @access  Private (Admin only)
router.put('/orders/:id', adminAuth, async (req, res) => {
    try {
        console.log('🔄 Updating order status:', req.params.id);
        
        const { statut } = req.body;
        
        const validStatuses = ['en-attente', 'confirmée', 'préparée', 'expédiée', 'livrée', 'annulée'];
        if (!validStatuses.includes(statut)) {
            return res.status(400).json({
                message: 'Statut invalide'
            });
        }
        
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({
                message: 'Commande non trouvée'
            });
        }
        
        order.statut = statut;
        
        if (statut === 'livrée' && !order.dateLivraison) {
            order.dateLivraison = new Date();
        }
        
        await order.save();
        
        console.log('✅ Order status updated:', order._id, 'to', statut);
        
        res.json({
            message: 'Statut de la commande mis à jour',
            order
        });
        
    } catch (error) {
        console.error('❌ Update order error:', error);
        res.status(500).json({
            message: 'Erreur lors de la mise à jour de la commande'
        });
    }
});

// @route   GET /api/admin/users
// @desc    Get all users for admin
// @access  Private (Admin only)
router.get('/users', adminAuth, async (req, res) => {
    try {
        console.log('👥 Loading users for admin...');
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        let query = {};
        
        if (req.query.actif !== undefined) {
            query.actif = req.query.actif === 'true';
        }
        
        if (req.query.role) {
            query.role = req.query.role;
        }
        
        const users = await User.find(query)
            .select('-password')
            .sort({ dateInscription: -1 })
            .skip(skip)
            .limit(limit);
            
        const total = await User.countDocuments(query);
        
        console.log(`✅ Loaded ${users.length} users for admin`);
        
        res.json({
            users,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalUsers: total
            }
        });
        
    } catch (error) {
        console.error('❌ Admin users error:', error);
        res.status(500).json({
            message: 'Erreur lors du chargement des utilisateurs'
        });
    }
});

module.exports = router;
