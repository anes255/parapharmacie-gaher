const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { auth, optionalAuth } = require('../middleware/auth');

// @route   POST /api/orders
// @desc    Create a new order
// @access  Public (no auth required for placing orders)
router.post('/', optionalAuth, async (req, res) => {
    try {
        const {
            client,
            articles,
            sousTotal,
            fraisLivraison,
            total,
            modePaiement,
            commentaires
        } = req.body;
        
        // Validation
        if (!client || !client.nom || !client.prenom || !client.telephone || !client.wilaya) {
            return res.status(400).json({
                message: 'Informations client incomplètes'
            });
        }
        
        if (!articles || articles.length === 0) {
            return res.status(400).json({
                message: 'Aucun article dans la commande'
            });
        }
        
        // Generate order number
        const numeroCommande = 'CMD' + Date.now();
        
        // Create order
        const order = new Order({
            numeroCommande,
            utilisateur: req.user ? req.user.id : null, // Optional user link
            client,
            articles,
            sousTotal,
            fraisLivraison,
            total,
            modePaiement: modePaiement || 'Paiement à la livraison',
            statut: 'en-attente',
            commentaires
        });
        
        await order.save();
        
        console.log('✅ Order created:', numeroCommande);
        
        res.status(201).json({
            message: 'Commande créée avec succès',
            order
        });
        
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({
            message: 'Erreur lors de la création de la commande',
            error: error.message
        });
    }
});

// @route   GET /api/orders
// @desc    Get all orders (admin) or user orders
// @access  Public with optional auth (returns all if admin, filtered if user, empty if no auth)
router.get('/', optionalAuth, async (req, res) => {
    try {
        let query = {};
        
        // If user is authenticated and is admin, return all orders
        if (req.user && req.user.role === 'admin') {
            // Admin can see all orders
            console.log('📋 Admin fetching all orders');
        } 
        // If user is authenticated but not admin, return only their orders
        else if (req.user) {
            query.utilisateur = req.user.id;
            console.log('📋 User fetching their orders');
        }
        // If no user, return empty array (for security)
        else {
            console.log('⚠️ Unauthenticated request for orders - returning empty');
            return res.json({
                orders: [],
                pagination: {
                    total: 0,
                    page: 1,
                    pages: 0
                }
            });
        }
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        
        const orders = await Order.find(query)
            .sort({ dateCommande: -1 })
            .limit(limit)
            .skip(skip);
        
        const total = await Order.countDocuments(query);
        
        res.json({
            orders,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit)
            }
        });
        
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des commandes',
            error: error.message
        });
    }
});

// @route   GET /api/orders/:id
// @desc    Get order by ID
// @access  Public with optional auth (owner or admin can see details)
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({
                message: 'Commande non trouvée'
            });
        }
        
        // Check if user has permission to view this order
        // Admin can view any order, user can view their own, others get 403
        if (req.user) {
            if (req.user.role !== 'admin' && 
                order.utilisateur && 
                order.utilisateur.toString() !== req.user.id) {
                return res.status(403).json({
                    message: 'Accès refusé à cette commande'
                });
            }
        } else {
            // No auth - can only view if we have the order number in query
            // This is for order confirmation pages
            const queryOrderNumber = req.query.numeroCommande;
            if (!queryOrderNumber || order.numeroCommande !== queryOrderNumber) {
                return res.status(403).json({
                    message: 'Authentification requise pour voir cette commande'
                });
            }
        }
        
        res.json(order);
        
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération de la commande',
            error: error.message
        });
    }
});

// @route   PUT /api/orders/:id
// @desc    Update order status
// @access  Private (Admin only)
router.put('/:id', auth, async (req, res) => {
    try {
        // Only admin can update orders
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                message: 'Accès refusé. Droits administrateur requis.'
            });
        }
        
        const { statut, commentaires, dateLivraison } = req.body;
        
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({
                message: 'Commande non trouvée'
            });
        }
        
        // Update fields
        if (statut) order.statut = statut;
        if (commentaires !== undefined) order.commentaires = commentaires;
        if (dateLivraison) order.dateLivraison = dateLivraison;
        
        await order.save();
        
        console.log('✅ Order updated:', order.numeroCommande);
        
        res.json({
            message: 'Commande mise à jour avec succès',
            order
        });
        
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({
            message: 'Erreur lors de la mise à jour de la commande',
            error: error.message
        });
    }
});

// @route   DELETE /api/orders/:id
// @desc    Delete an order
// @access  Private (Admin only)
router.delete('/:id', auth, async (req, res) => {
    try {
        // Only admin can delete orders
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                message: 'Accès refusé. Droits administrateur requis.'
            });
        }
        
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({
                message: 'Commande non trouvée'
            });
        }
        
        await order.deleteOne();
        
        console.log('🗑️ Order deleted:', order.numeroCommande);
        
        res.json({
            message: 'Commande supprimée avec succès'
        });
        
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({
            message: 'Erreur lors de la suppression de la commande',
            error: error.message
        });
    }
});

// @route   GET /api/orders/user/all
// @desc    Get all orders for logged in user
// @access  Private
router.get('/user/all', auth, async (req, res) => {
    try {
        const orders = await Order.find({ utilisateur: req.user.id })
            .sort({ dateCommande: -1 });
        
        res.json({
            orders
        });
        
    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des commandes',
            error: error.message
        });
    }
});

// @route   GET /api/orders/number/:numeroCommande
// @desc    Get order by order number (for confirmation pages)
// @access  Public
router.get('/number/:numeroCommande', async (req, res) => {
    try {
        const order = await Order.findOne({ numeroCommande: req.params.numeroCommande });
        
        if (!order) {
            return res.status(404).json({
                message: 'Commande non trouvée'
            });
        }
        
        res.json(order);
        
    } catch (error) {
        console.error('Error fetching order by number:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération de la commande',
            error: error.message
        });
    }
});

module.exports = router;
