const express = require('express');
const router = express.Router();

// @route   POST /api/orders
// @desc    Create a new order
// @access  Public
router.post('/', async (req, res) => {
    try {
        console.log('📝 Creating new order...');
        console.log('📦 Order data:', JSON.stringify(req.body, null, 2));
        
        const {
            client,
            articles,
            fraisLivraison,
            remise,
            modePaiement,
            commentaires
        } = req.body;
        
        // Basic validation
        if (!client || !client.nom || !client.prenom || !client.email || !client.telephone || !client.adresse || !client.wilaya) {
            return res.status(400).json({
                message: 'Informations client incomplètes'
            });
        }
        
        if (!articles || !Array.isArray(articles) || articles.length === 0) {
            return res.status(400).json({
                message: 'Au moins un article est requis'
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(client.email)) {
            return res.status(400).json({
                message: 'Format d\'email invalide'
            });
        }
        
        // Validate and calculate totals
        let sousTotal = 0;
        const validatedArticles = [];
        
        for (const article of articles) {
            if (!article.id || !article.nom || !article.prix || !article.quantite) {
                return res.status(400).json({
                    message: 'Informations article incomplètes'
                });
            }
            
            if (article.prix < 0 || article.quantite < 1) {
                return res.status(400).json({
                    message: 'Prix ou quantité invalide'
                });
            }
            
            const articleSousTotal = article.prix * article.quantite;
            sousTotal += articleSousTotal;
            
            validatedArticles.push({
                id: article.id,
                nom: article.nom,
                prix: article.prix,
                quantite: article.quantite,
                sousTotal: articleSousTotal,
                image: article.image || '',
                categorie: article.categorie || '',
                marque: article.marque || ''
            });
        }
        
        // Calculate delivery fees
        const calculatedFraisLivraison = fraisLivraison !== undefined ? fraisLivraison : (sousTotal >= 5000 ? 0 : 300);
        
        // Calculate total
        const total = sousTotal + calculatedFraisLivraison - (remise || 0);
        
        if (total < 0) {
            return res.status(400).json({
                message: 'Total de commande invalide'
            });
        }
        
        // Try to use Order model
        let Order;
        try {
            Order = require('../models/Order');
        } catch (error) {
            console.error('❌ Order model not found:', error.message);
            return res.status(500).json({
                message: 'Erreur de configuration serveur - modèle commande manquant',
                error: error.message
            });
        }
        
        // Get device info
        const deviceInfo = {
            userAgent: req.get('User-Agent') || '',
            platform: req.get('X-Platform') || 'web',
            ip: req.ip || req.connection.remoteAddress || ''
        };
        
        // Create order
        const order = new Order({
            client: {
                nom: client.nom.trim(),
                prenom: client.prenom.trim(),
                email: client.email.toLowerCase().trim(),
                telephone: client.telephone.trim(),
                adresse: client.adresse.trim(),
                ville: client.ville ? client.ville.trim() : '',
                wilaya: client.wilaya,
                codePostal: client.codePostal ? client.codePostal.trim() : ''
            },
            articles: validatedArticles,
            sousTotal,
            fraisLivraison: calculatedFraisLivraison,
            remise: remise || 0,
            total,
            modePaiement: modePaiement || 'Paiement à la livraison',
            commentaires: commentaires ? commentaires.trim() : '',
            dateCommande: new Date(),
            deviceInfo,
            source: 'web'
        });
        
        await order.save();
        
        console.log('✅ Order created successfully:', order.numeroCommande);
        console.log('📊 Order total:', order.total, 'DA');
        
        res.status(201).json({
            message: 'Commande créée avec succès',
            order: {
                _id: order._id,
                numeroCommande: order.numeroCommande,
                total: order.total,
                statut: order.statut,
                dateCommande: order.dateCommande,
                client: order.client,
                articles: order.articles
            }
        });
        
    } catch (error) {
        console.error('❌ Create order error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: messages[0] || 'Données invalides'
            });
        }
        
        res.status(500).json({
            message: 'Erreur lors de la création de la commande',
            error: error.message
        });
    }
});

// @route   GET /api/orders
// @desc    Get all orders (for admin)
// @access  Public (should be protected)
router.get('/', async (req, res) => {
    try {
        console.log('📋 Loading all orders for admin...');
        
        let Order;
        try {
            Order = require('../models/Order');
        } catch (error) {
            return res.status(500).json({
                message: 'Erreur de configuration serveur - modèle commande manquant'
            });
        }
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        
        let query = {};
        
        // Filters
        if (req.query.statut) {
            query.statut = req.query.statut;
        }
        
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            query.$or = [
                { numeroCommande: searchRegex },
                { 'client.nom': searchRegex },
                { 'client.prenom': searchRegex },
                { 'client.email': searchRegex },
                { 'client.telephone': searchRegex }
            ];
        }
        
        if (req.query.dateFrom || req.query.dateTo) {
            query.dateCommande = {};
            if (req.query.dateFrom) {
                query.dateCommande.$gte = new Date(req.query.dateFrom);
            }
            if (req.query.dateTo) {
                const dateTo = new Date(req.query.dateTo);
                dateTo.setHours(23, 59, 59, 999);
                query.dateCommande.$lte = dateTo;
            }
        }
        
        const orders = await Order.find(query)
            .sort({ dateCommande: -1 })
            .skip(skip)
            .limit(limit);
            
        const total = await Order.countDocuments(query);
        const totalPages = Math.ceil(total / limit);
        
        console.log(`✅ Found ${orders.length} orders (total: ${total})`);
        
        res.json({
            orders,
            pagination: {
                currentPage: page,
                totalPages,
                totalOrders: total,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            },
            message: 'Orders loaded successfully'
        });
        
    } catch (error) {
        console.error('❌ Get orders error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des commandes',
            error: error.message
        });
    }
});

// @route   GET /api/orders/:id
// @desc    Get order by ID
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        console.log('👁️ Getting order:', req.params.id);
        
        let Order;
        try {
            Order = require('../models/Order');
        } catch (error) {
            return res.status(500).json({
                message: 'Erreur de configuration serveur - modèle commande manquant'
            });
        }
        
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({
                message: 'Commande non trouvée'
            });
        }
        
        res.json(order);
        
    } catch (error) {
        console.error('❌ Get order error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération de la commande',
            error: error.message
        });
    }
});

// @route   GET /api/orders/track/:numeroCommande
// @desc    Track order by order number
// @access  Public
router.get('/track/:numeroCommande', async (req, res) => {
    try {
        console.log('📦 Tracking order:', req.params.numeroCommande);
        
        let Order;
        try {
            Order = require('../models/Order');
        } catch (error) {
            return res.status(500).json({
                message: 'Erreur de configuration serveur - modèle commande manquant'
            });
        }
        
        const order = await Order.findOne({ numeroCommande: req.params.numeroCommande });
        
        if (!order) {
            return res.status(404).json({
                message: 'Commande non trouvée'
            });
        }
        
        // Return limited information for tracking
        res.json({
            numeroCommande: order.numeroCommande,
            statut: order.statut,
            dateCommande: order.dateCommande,
            dateConfirmation: order.dateConfirmation,
            dateExpedition: order.dateExpedition,
            dateLivraison: order.dateLivraison,
            total: order.total
        });
        
    } catch (error) {
        console.error('❌ Track order error:', error);
        res.status(500).json({
            message: 'Erreur lors du suivi de la commande',
            error: error.message
        });
    }
});

// @route   PUT /api/orders/:id
// @desc    Update order status
// @access  Public (should be protected for admin)
router.put('/:id', async (req, res) => {
    try {
        console.log('📝 Updating order:', req.params.id);
        
        let Order;
        try {
            Order = require('../models/Order');
        } catch (error) {
            return res.status(500).json({
                message: 'Erreur de configuration serveur - modèle commande manquant'
            });
        }
        
        const { statut, commentairesAdmin } = req.body;
        
        if (!statut) {
            return res.status(400).json({
                message: 'Statut requis'
            });
        }
        
        const validStatuts = ['en-attente', 'confirmée', 'préparée', 'expédiée', 'livrée', 'annulée'];
        if (!validStatuts.includes(statut)) {
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
        
        // Update order
        order.statut = statut;
        if (commentairesAdmin) {
            order.commentairesAdmin = commentairesAdmin;
        }
        
        await order.save();
        
        console.log('✅ Order updated:', order.numeroCommande, 'Status:', statut);
        
        res.json({
            message: 'Commande mise à jour avec succès',
            order
        });
        
    } catch (error) {
        console.error('❌ Update order error:', error);
        res.status(500).json({
            message: 'Erreur lors de la mise à jour de la commande',
            error: error.message
        });
    }
});

// @route   DELETE /api/orders/:id
// @desc    Delete order
// @access  Public (should be protected for admin)
router.delete('/:id', async (req, res) => {
    try {
        console.log('🗑️ Deleting order:', req.params.id);
        
        let Order;
        try {
            Order = require('../models/Order');
        } catch (error) {
            return res.status(500).json({
                message: 'Erreur de configuration serveur - modèle commande manquant'
            });
        }
        
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({
                message: 'Commande non trouvée'
            });
        }
        
        await Order.findByIdAndDelete(req.params.id);
        
        console.log('✅ Order deleted:', order.numeroCommande);
        
        res.json({
            message: 'Commande supprimée avec succès',
            deletedOrder: {
                numeroCommande: order.numeroCommande,
                client: order.client.nomComplet || `${order.client.prenom} ${order.client.nom}`,
                total: order.total
            }
        });
        
    } catch (error) {
        console.error('❌ Delete order error:', error);
        res.status(500).json({
            message: 'Erreur lors de la suppression de la commande',
            error: error.message
        });
    }
});

// @route   GET /api/orders/stats/summary
// @desc    Get order statistics
// @access  Public (should be protected for admin)
router.get('/stats/summary', async (req, res) => {
    try {
        console.log('📊 Getting order statistics...');
        
        let Order;
        try {
            Order = require('../models/Order');
        } catch (error) {
            return res.status(500).json({
                message: 'Erreur de configuration serveur - modèle commande manquant'
            });
        }
        
        const stats = await Order.getStats();
        
        const summary = {
            total: 0,
            byStatus: {},
            totalRevenue: 0
        };
        
        stats.forEach(stat => {
            summary.total += stat.count;
            summary.byStatus[stat._id] = {
                count: stat.count,
                revenue: stat.totalAmount
            };
            summary.totalRevenue += stat.totalAmount;
        });
        
        res.json({
            stats: summary,
            message: 'Statistics loaded successfully'
        });
        
    } catch (error) {
        console.error('❌ Get stats error:', error);
        res.status(500).json({
            message: 'Erreur lors du calcul des statistiques',
            error: error.message
        });
    }
});

// @route   GET /api/orders/test
// @desc    Test orders route
// @access  Public
router.get('/test/check', (req, res) => {
    res.json({
        message: 'Orders routes are working!',
        timestamp: new Date().toISOString(),
        endpoints: [
            'POST /api/orders - Create order',
            'GET /api/orders - Get all orders',
            'GET /api/orders/:id - Get order by ID',
            'PUT /api/orders/:id - Update order status',
            'DELETE /api/orders/:id - Delete order',
            'GET /api/orders/track/:numeroCommande - Track order',
            'GET /api/orders/stats/summary - Get statistics'
        ]
    });
});

module.exports = router;
