const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { auth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/orders
// @desc    Create new order
// @access  Public
router.post('/', async (req, res) => {
    try {
        console.log('📦 Creating new order:', req.body);
        
        const {
            numeroCommande,
            client,
            articles,
            sousTotal,
            fraisLivraison,
            total,
            modePaiement,
            commentaires
        } = req.body;
        
        // Validation
        if (!numeroCommande || !client || !articles || articles.length === 0) {
            return res.status(400).json({
                message: 'Données de commande incomplètes'
            });
        }
        
        if (!client.prenom || !client.nom || !client.email || !client.telephone || !client.adresse || !client.wilaya) {
            return res.status(400).json({
                message: 'Informations client incomplètes'
            });
        }
        
        // Validate articles
        for (let article of articles) {
            if (!article.produitId || !article.nom || !article.prix || !article.quantite) {
                return res.status(400).json({
                    message: 'Informations d\'article incomplètes'
                });
            }
            
            if (article.quantite <= 0) {
                return res.status(400).json({
                    message: 'La quantité doit être supérieure à 0'
                });
            }
        }
        
        // Check if order number already exists
        const existingOrder = await Order.findOne({ numeroCommande });
        if (existingOrder) {
            return res.status(400).json({
                message: 'Numéro de commande déjà existant'
            });
        }
        
        // Create order with complete client structure
        const order = new Order({
            numeroCommande,
            client: {
                userId: req.user ? req.user.userId : null,
                prenom: client.prenom,
                nom: client.nom,
                email: client.email,
                telephone: client.telephone,
                adresse: client.adresse,
                codePostal: client.codePostal || '',
                ville: client.ville || '',
                wilaya: client.wilaya
            },
            articles: articles.map(article => ({
                produitId: article.produitId,
                nom: article.nom,
                prix: parseFloat(article.prix),
                quantite: parseInt(article.quantite),
                total: parseFloat(article.prix) * parseInt(article.quantite)
            })),
            sousTotal: parseFloat(sousTotal),
            fraisLivraison: parseFloat(fraisLivraison) || 0,
            total: parseFloat(total),
            modePaiement: modePaiement || 'paiement-livraison',
            statut: 'en-attente',
            commentaires: commentaires || '',
            dateCommande: new Date(),
            dateMiseAJour: new Date()
        });
        
        const savedOrder = await order.save();
        console.log('✅ Order created successfully:', savedOrder._id);
        
        res.status(201).json({
            message: 'Commande créée avec succès',
            order: savedOrder
        });
        
    } catch (error) {
        console.error('❌ Order creation error:', error);
        res.status(500).json({
            message: 'Erreur lors de la création de la commande',
            error: error.message
        });
    }
});

// @route   GET /api/orders
// @desc    Get orders (for admin or user's own orders)
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        const { 
            statut, 
            dateDebut, 
            dateFin,
            search,
            sortBy = 'dateCommande',
            sortOrder = 'desc'
        } = req.query;
        
        // Build filter object
        let filter = {};
        
        // If not admin, only show user's orders
        if (req.user.role !== 'admin') {
            filter['client.userId'] = req.user.userId;
        }
        
        if (statut) filter.statut = statut;
        
        if (dateDebut || dateFin) {
            filter.dateCommande = {};
            if (dateDebut) filter.dateCommande.$gte = new Date(dateDebut);
            if (dateFin) filter.dateCommande.$lte = new Date(dateFin);
        }
        
        if (search) {
            filter.$or = [
                { numeroCommande: { $regex: search, $options: 'i' } },
                { 'client.prenom': { $regex: search, $options: 'i' } },
                { 'client.nom': { $regex: search, $options: 'i' } },
                { 'client.email': { $regex: search, $options: 'i' } }
            ];
        }
        
        // Build sort object
        const sortObj = {};
        sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;
        
        console.log('📋 Orders query:', { filter, sortObj, page, limit });
        
        const orders = await Order.find(filter)
            .sort(sortObj)
            .skip(skip)
            .limit(limit)
            .lean();
        
        const total = await Order.countDocuments(filter);
        
        res.json({
            orders,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalOrders: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        });
        
    } catch (error) {
        console.error('❌ Orders fetch error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des commandes',
            error: error.message
        });
    }
});

// @route   GET /api/orders/:id
// @desc    Get order by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({
                message: 'Commande non trouvée'
            });
        }
        
        // Check if user can access this order
        if (req.user.role !== 'admin' && order.client.userId !== req.user.userId) {
            return res.status(403).json({
                message: 'Accès non autorisé'
            });
        }
        
        res.json(order);
        
    } catch (error) {
        console.error('❌ Order fetch error:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                message: 'ID de commande invalide'
            });
        }
        res.status(500).json({
            message: 'Erreur lors de la récupération de la commande',
            error: error.message
        });
    }
});

// @route   PUT /api/orders/:id/status
// @desc    Update order status
// @access  Private/Admin
router.put('/:id/status', auth, requireAdmin, async (req, res) => {
    try {
        console.log('📋 Updating order status:', req.params.id, req.body.statut);
        
        const { statut } = req.body;
        
        const validStatuses = ['en-attente', 'confirmee', 'en-preparation', 'expediee', 'livree', 'annulee'];
        
        if (!statut || !validStatuses.includes(statut)) {
            return res.status(400).json({
                message: 'Statut invalide. Statuts valides: ' + validStatuses.join(', ')
            });
        }
        
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({
                message: 'Commande non trouvée'
            });
        }
        
        order.statut = statut;
        order.dateMiseAJour = new Date();
        
        const updatedOrder = await order.save();
        console.log('✅ Order status updated:', updatedOrder._id, updatedOrder.statut);
        
        res.json({
            message: 'Statut de la commande mis à jour',
            order: updatedOrder
        });
        
    } catch (error) {
        console.error('❌ Order status update error:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                message: 'ID de commande invalide'
            });
        }
        res.status(500).json({
            message: 'Erreur lors de la mise à jour du statut',
            error: error.message
        });
    }
});

// @route   GET /api/orders/stats/dashboard
// @desc    Get order statistics for dashboard
// @access  Private/Admin
router.get('/stats/dashboard', auth, requireAdmin, async (req, res) => {
    try {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const stats = await Promise.all([
            // Total orders
            Order.countDocuments(),
            
            // Today's orders
            Order.countDocuments({ 
                dateCommande: { $gte: startOfDay } 
            }),
            
            // This week's orders
            Order.countDocuments({ 
                dateCommande: { $gte: startOfWeek } 
            }),
            
            // This month's orders
            Order.countDocuments({ 
                dateCommande: { $gte: startOfMonth } 
            }),
            
            // Pending orders
            Order.countDocuments({ statut: 'en-attente' }),
            
            // Total revenue this month
            Order.aggregate([
                {
                    $match: {
                        dateCommande: { $gte: startOfMonth },
                        statut: { $ne: 'annulee' }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$total' }
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
            ])
        ]);
        
        const [
            totalOrders,
            todayOrders,
            weekOrders,
            monthOrders,
            pendingOrders,
            revenueResult,
            statusBreakdown
        ] = stats;
        
        const monthlyRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;
        
        res.json({
            totalOrders,
            todayOrders,
            weekOrders,
            monthOrders,
            pendingOrders,
            monthlyRevenue,
            statusBreakdown: statusBreakdown.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {})
        });
        
    } catch (error) {
        console.error('❌ Order stats error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des statistiques',
            error: error.message
        });
    }
});

// @route   DELETE /api/orders/:id
// @desc    Delete order (admin only)
// @access  Private/Admin
router.delete('/:id', auth, requireAdmin, async (req, res) => {
    try {
        console.log('🗑️ Deleting order:', req.params.id);
        
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({
                message: 'Commande non trouvée'
            });
        }
        
        await Order.findByIdAndDelete(req.params.id);
        console.log('✅ Order deleted:', req.params.id);
        
        res.json({
            message: 'Commande supprimée avec succès'
        });
        
    } catch (error) {
        console.error('❌ Order deletion error:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                message: 'ID de commande invalide'
            });
        }
        res.status(500).json({
            message: 'Erreur lors de la suppression de la commande',
            error: error.message
        });
    }
});

module.exports = router;
