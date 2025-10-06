const express = require('express');
const Order = require('../models/Order');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/orders
// @desc    Create new order
// @access  Public
router.post('/', async (req, res) => {
    try {
        console.log('📦 New order creation request received');
        console.log('📦 Request body:', JSON.stringify(req.body, null, 2));
        
        const {
            numeroCommande,
            orderNumber, // FIXED: Accept both field names
            client,
            articles,
            sousTotal,
            fraisLivraison,
            total,
            modePaiement,
            commentaires
        } = req.body;
        
        // CRITICAL FIX: Use either numeroCommande or orderNumber
        const finalOrderNumber = numeroCommande || orderNumber;
        
        console.log('📦 Final order number:', finalOrderNumber);
        
        // Validation
        if (!finalOrderNumber) {
            return res.status(400).json({
                message: 'Numéro de commande requis',
                error: 'Missing numeroCommande or orderNumber'
            });
        }
        
        if (!client || !articles || articles.length === 0) {
            return res.status(400).json({
                message: 'Données de commande incomplètes',
                error: 'Missing client or articles'
            });
        }
        
        if (!client.prenom || !client.nom || !client.email || !client.telephone || !client.adresse || !client.wilaya) {
            return res.status(400).json({
                message: 'Informations client incomplètes',
                error: 'Missing required client fields'
            });
        }
        
        // Check for duplicate order number
        const existingOrder = await Order.findOne({
            $or: [
                { numeroCommande: finalOrderNumber },
                { orderNumber: finalOrderNumber }
            ]
        });
        
        if (existingOrder) {
            console.log('⚠️ Duplicate order number detected:', finalOrderNumber);
            return res.status(409).json({
                message: 'Ce numéro de commande existe déjà',
                error: 'Duplicate order number',
                existingOrder: existingOrder.numeroCommande
            });
        }
        
        // Create order with BOTH fields for backward compatibility
        const order = new Order({
            numeroCommande: finalOrderNumber,
            orderNumber: finalOrderNumber, // FIXED: Set both fields
            client: {
                userId: req.user ? req.user.id : null,
                prenom: client.prenom.trim(),
                nom: client.nom.trim(),
                email: client.email.toLowerCase().trim(),
                telephone: client.telephone.replace(/\s+/g, ''),
                adresse: client.adresse.trim(),
                wilaya: client.wilaya,
                ville: client.ville || '',
                codePostal: client.codePostal || ''
            },
            articles: articles.map(article => ({
                productId: String(article.productId),
                nom: article.nom,
                prix: parseFloat(article.prix),
                quantite: parseInt(article.quantite),
                image: article.image || ''
            })),
            sousTotal: parseFloat(sousTotal) || 0,
            fraisLivraison: parseFloat(fraisLivraison) || 0,
            total: parseFloat(total) || 0,
            statut: 'en-attente',
            modePaiement: modePaiement || 'Paiement à la livraison',
            commentaires: commentaires || '',
            dateCommande: new Date()
        });
        
        console.log('📦 Saving order to database...');
        await order.save();
        console.log('✅ Order created successfully:', order.numeroCommande);
        
        res.status(201).json({
            message: 'Commande créée avec succès',
            order: {
                _id: order._id,
                numeroCommande: order.numeroCommande,
                orderNumber: order.orderNumber,
                statut: order.statut,
                total: order.total,
                dateCommande: order.dateCommande
            }
        });
        
    } catch (error) {
        console.error('❌ Order creation error:', error);
        console.error('❌ Error name:', error.name);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error code:', error.code);
        
        // Handle MongoDB duplicate key error
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern || {})[0];
            return res.status(409).json({
                message: 'Cette commande existe déjà',
                error: `Duplicate key error on field: ${field}`
            });
        }
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: messages[0] || 'Données de commande invalides',
                error: 'Validation error'
            });
        }
        
        res.status(500).json({
            message: 'Erreur lors de la création de la commande',
            error: error.message
        });
    }
});

// @route   GET /api/orders/user/all
// @desc    Get user orders
// @access  Private
router.get('/user/all', auth, async (req, res) => {
    try {
        console.log('📦 Getting orders for user:', req.user.id);
        
        const orders = await Order.find({ 
            'client.userId': req.user.id 
        }).sort({ dateCommande: -1 });
        
        res.json({
            orders,
            count: orders.length
        });
        
    } catch (error) {
        console.error('❌ Get user orders error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des commandes'
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
        
        // Check if user owns this order or is admin
        if (order.client.userId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                message: 'Accès non autorisé à cette commande'
            });
        }
        
        res.json(order);
        
    } catch (error) {
        console.error('❌ Get order error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération de la commande'
        });
    }
});

// @route   PUT /api/orders/:id
// @desc    Update order status
// @access  Private
router.put('/:id', auth, async (req, res) => {
    try {
        const { statut } = req.body;
        
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({
                message: 'Commande non trouvée'
            });
        }
        
        // Check permissions
        if (req.user.role !== 'admin') {
            if (order.client.userId !== req.user.id) {
                return res.status(403).json({
                    message: 'Accès non autorisé à cette commande'
                });
            }
            
            if (statut !== 'annulée' || order.statut !== 'en-attente') {
                return res.status(403).json({
                    message: 'Vous pouvez seulement annuler une commande en attente'
                });
            }
        }
        
        // Validate status
        const validStatuses = ['en-attente', 'confirmée', 'préparée', 'expédiée', 'livrée', 'annulée'];
        if (!validStatuses.includes(statut)) {
            return res.status(400).json({
                message: 'Statut de commande invalide'
            });
        }
        
        order.statut = statut;
        
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
            message: 'Erreur lors de la mise à jour de la commande'
        });
    }
});

// @route   GET /api/orders
// @desc    Get all orders (Admin only)
// @access  Private/Admin
router.get('/', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                message: 'Accès administrateur requis'
            });
        }
        
        console.log('📦 Admin getting all orders');
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        let query = {};
        
        if (req.query.statut) {
            query.statut = req.query.statut;
        }
        
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
        console.error('❌ Get all orders error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des commandes'
        });
    }
});

// @route   DELETE /api/orders/:id
// @desc    Delete order (Admin only)
// @access  Private/Admin
router.delete('/:id', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                message: 'Accès administrateur requis'
            });
        }
        
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({
                message: 'Commande non trouvée'
            });
        }
        
        await Order.findByIdAndDelete(req.params.id);
        
        console.log(`✅ Order ${order.numeroCommande} deleted by admin`);
        
        res.json({
            message: 'Commande supprimée avec succès'
        });
        
    } catch (error) {
        console.error('❌ Delete order error:', error);
        res.status(500).json({
            message: 'Erreur lors de la suppression de la commande'
        });
    }
});

// @route   GET /api/orders/stats/dashboard
// @desc    Get order statistics for admin dashboard
// @access  Private/Admin
router.get('/stats/dashboard', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                message: 'Accès administrateur requis'
            });
        }
        
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const totalOrders = await Order.countDocuments();
        const pendingOrders = await Order.countDocuments({ statut: 'en-attente' });
        const monthlyOrders = await Order.countDocuments({ 
            dateCommande: { $gte: startOfMonth } 
        });
        
        const monthlyRevenue = await Order.aggregate([
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
        
        const ordersByStatus = await Order.aggregate([
            {
                $group: {
                    _id: '$statut',
                    count: { $sum: 1 }
                }
            }
        ]);
        
        res.json({
            totalOrders,
            pendingOrders,
            monthlyOrders,
            monthlyRevenue: monthlyRevenue[0]?.total || 0,
            ordersByStatus: ordersByStatus.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {})
        });
        
    } catch (error) {
        console.error('❌ Get order stats error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des statistiques'
        });
    }
});

module.exports = router;
