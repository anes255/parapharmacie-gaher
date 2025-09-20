const express = require('express');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Test route to verify router is working
router.get('/test', (req, res) => {
    res.json({ message: 'Orders route is working!' });
});

// @route   GET /api/orders
// @desc    Get all orders (Admin only) 
// @access  Private/Admin
router.get('/', auth, async (req, res) => {
    try {
        console.log('📦 Admin accessing orders, user:', req.user);
        
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                message: 'Accès administrateur requis'
            });
        }
        
        // Try to load Order model
        let Order;
        try {
            Order = require('../models/Order');
        } catch (modelError) {
            console.error('Failed to load Order model:', modelError);
            return res.status(500).json({
                message: 'Erreur de modèle de données',
                error: modelError.message
            });
        }
        
        console.log('📦 Admin verified, getting orders...');
        
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
        
        console.log('📦 Orders found:', orders.length);
        
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
            message: 'Erreur lors de la récupération des commandes',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// @route   POST /api/orders
// @desc    Create new order
// @access  Public
router.post('/', async (req, res) => {
    try {
        console.log('📦 New order creation request received');
        
        // Try to load Order model
        let Order;
        try {
            Order = require('../models/Order');
        } catch (modelError) {
            console.error('Failed to load Order model:', modelError);
            return res.status(500).json({
                message: 'Erreur de modèle de données',
                error: modelError.message
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
            }
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
            message: 'Erreur serveur lors de la création de la commande',
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
        
        const Order = require('../models/Order');
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
            message: 'Erreur lors de la récupération des commandes',
            error: error.message
        });
    }
});

// @route   DELETE /api/orders/:id
// @desc    Delete order (Admin only)
// @access  Private/Admin
router.delete('/:id', auth, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                message: 'Accès administrateur requis'
            });
        }
        
        const Order = require('../models/Order');
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
            message: 'Erreur lors de la suppression de la commande',
            error: error.message
        });
    }
});

module.exports = router;
