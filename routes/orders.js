const express = require('express');
const router = express.Router();

console.log('📦 Loading orders routes...');

// Import dependencies with error handling
let Order = null;
let auth = null;

try {
    Order = require('../models/Order');
    console.log('✅ Order model loaded');
} catch (error) {
    console.error('❌ Failed to load Order model:', error.message);
}

try {
    auth = require('../middleware/auth');
    console.log('✅ Auth middleware loaded');
} catch (error) {
    console.error('❌ Failed to load auth middleware:', error.message);
}

// Test route - always works
router.get('/test', (req, res) => {
    console.log('📦 Orders test route accessed');
    res.json({ 
        message: 'Orders API is working',
        timestamp: new Date().toISOString(),
        success: true
    });
});

// Debug status route
router.get('/debug-status', (req, res) => {
    console.log('📦 Orders debug status accessed');
    res.json({
        message: 'Orders debug status',
        orderModelLoaded: !!Order,
        authMiddlewareLoaded: !!auth,
        timestamp: new Date().toISOString()
    });
});

// @route   GET /api/orders
// @desc    Get all orders (Admin only)
// @access  Private/Admin
if (auth && Order) {
    router.get('/', auth, async (req, res) => {
        try {
            console.log('📦 GET /api/orders accessed');
            console.log('📦 User:', req.user ? `${req.user.email} (${req.user.role})` : 'No user');
            
            // Check if user is admin
            if (!req.user || req.user.role !== 'admin') {
                console.log('❌ Access denied - not admin');
                return res.status(403).json({
                    message: 'Accès administrateur requis',
                    userRole: req.user ? req.user.role : 'no user'
                });
            }
            
            console.log('✅ Admin access confirmed, fetching orders...');
            
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;
            const skip = (page - 1) * limit;
            
            let query = {};
            
            // Filter by status if provided
            if (req.query.statut) {
                query.statut = req.query.statut;
                console.log('📦 Filtering by status:', req.query.statut);
            }
            
            // Filter by date range if provided
            if (req.query.dateFrom || req.query.dateTo) {
                query.dateCommande = {};
                if (req.query.dateFrom) {
                    query.dateCommande.$gte = new Date(req.query.dateFrom);
                }
                if (req.query.dateTo) {
                    query.dateCommande.$lte = new Date(req.query.dateTo);
                }
                console.log('📦 Filtering by date range:', query.dateCommande);
            }
            
            console.log('📦 Query:', query);
            
            const orders = await Order.find(query)
                .sort({ dateCommande: -1 })
                .skip(skip)
                .limit(limit)
                .lean(); // Use lean() for better performance
                
            const total = await Order.countDocuments(query);
            const totalPages = Math.ceil(total / limit);
            
            console.log(`✅ Found ${orders.length} orders (total: ${total})`);
            
            res.json({
                message: 'Orders retrieved successfully',
                orders: orders,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalOrders: total,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                },
                success: true
            });
            
        } catch (error) {
            console.error('❌ Error fetching orders:', error);
            res.status(500).json({
                message: 'Erreur lors de la récupération des commandes',
                error: error.message,
                orders: []
            });
        }
    });
} else {
    // Fallback route when dependencies aren't loaded
    router.get('/', (req, res) => {
        console.log('📦 Fallback orders route accessed');
        res.status(500).json({
            message: 'Orders service unavailable',
            error: 'Required dependencies not loaded',
            orderModelLoaded: !!Order,
            authMiddlewareLoaded: !!auth,
            orders: []
        });
    });
}

// @route   POST /api/orders
// @desc    Create new order
// @access  Public
router.post('/', async (req, res) => {
    try {
        console.log('📦 POST /api/orders - Creating new order');
        
        if (!Order) {
            return res.status(500).json({
                message: 'Order model not available'
            });
        }
        
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
        
        // Create order
        const order = new Order({
            numeroCommande,
            client: {
                userId: req.user ? req.user.id : null,
                prenom: client.prenom.trim(),
                nom: client.nom.trim(),
                email: client.email.toLowerCase().trim(),
                telephone: client.telephone.replace(/\s+/g, ''),
                adresse: client.adresse.trim(),
                wilaya: client.wilaya
            },
            articles: articles.map(article => ({
                productId: article.productId,
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
        
        await order.save();
        console.log('✅ Order created successfully:', order.numeroCommande);
        
        res.status(201).json({
            message: 'Commande créée avec succès',
            order: {
                _id: order._id,
                numeroCommande: order.numeroCommande,
                statut: order.statut,
                total: order.total,
                dateCommande: order.dateCommande
            },
            success: true
        });
        
    } catch (error) {
        console.error('❌ Order creation error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: messages[0] || 'Données de commande invalides'
            });
        }
        
        res.status(500).json({
            message: 'Erreur serveur lors de la création de la commande'
        });
    }
});

// Other routes with proper error handling
if (auth && Order) {
    // @route   GET /api/orders/user/all
    // @desc    Get user orders
    // @access  Private
    router.get('/user/all', auth, async (req, res) => {
        try {
            console.log('📦 Getting orders for user:', req.user.id);
            
            const orders = await Order.find({ 
                'client.userId': req.user.id 
            }).sort({ dateCommande: -1 }).lean();
            
            res.json({
                orders,
                count: orders.length,
                success: true
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
                },
                success: true
            });
            
        } catch (error) {
            console.error('❌ Update order error:', error);
            res.status(500).json({
                message: 'Erreur lors de la mise à jour de la commande'
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
                message: 'Commande supprimée avec succès',
                success: true
            });
            
        } catch (error) {
            console.error('❌ Delete order error:', error);
            res.status(500).json({
                message: 'Erreur lors de la suppression de la commande'
            });
        }
    });
}

console.log('📦 ✅ Orders routes loaded successfully');
module.exports = router;
