const express = require('express');
const Order = require('../models/Order');
const auth = require('../middleware/auth');

const router = express.Router();

// Create new order (public route - for checkout)
router.post('/', async (req, res) => {
    try {
        console.log('Creating new order:', req.body.numeroCommande);
        
        const {
            numeroCommande,
            client,
            articles,
            sousTotal,
            fraisLivraison,
            total,
            statut,
            modePaiement,
            dateCommande,
            commentaires
        } = req.body;
        
        // Validation
        if (!numeroCommande || !client || !articles || articles.length === 0) {
            return res.status(400).json({ 
                message: 'Données de commande incomplètes' 
            });
        }
        
        // Validate client data
        if (!client.prenom || !client.nom || !client.email || !client.telephone || !client.adresse || !client.wilaya) {
            return res.status(400).json({ 
                message: 'Informations client incomplètes' 
            });
        }
        
        // Validate articles
        for (const article of articles) {
            if (!article.id || !article.nom || !article.prix || !article.quantite) {
                return res.status(400).json({ 
                    message: 'Informations article incomplètes' 
                });
            }
        }
        
        // Check if order already exists
        const existingOrder = await Order.findOne({ numeroCommande });
        if (existingOrder) {
            return res.status(400).json({ 
                message: 'Cette commande existe déjà' 
            });
        }
        
        // Create order
        const order = new Order({
            numeroCommande,
            client: {
                prenom: client.prenom.trim(),
                nom: client.nom.trim(),
                email: client.email.trim().toLowerCase(),
                telephone: client.telephone.trim(),
                adresse: client.adresse.trim(),
                wilaya: client.wilaya.trim(),
                commentaires: client.commentaires?.trim() || ''
            },
            articles: articles.map(article => ({
                id: article.id,
                nom: article.nom,
                prix: Number(article.prix),
                quantite: Number(article.quantite),
                image: article.image || '',
                categorie: article.categorie || ''
            })),
            sousTotal: Number(sousTotal),
            fraisLivraison: Number(fraisLivraison),
            total: Number(total),
            statut: statut || 'en-attente',
            modePaiement: modePaiement || 'Paiement à la livraison',
            dateCommande: dateCommande ? new Date(dateCommande) : new Date(),
            commentaires: commentaires?.trim() || ''
        });
        
        const savedOrder = await order.save();
        
        console.log('Order created successfully:', savedOrder._id);
        
        res.status(201).json({
            success: true,
            order: savedOrder,
            message: 'Commande créée avec succès'
        });
        
    } catch (error) {
        console.error('Create order error:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Numéro de commande déjà utilisé' });
        }
        
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: errors.join(', ') });
        }
        
        res.status(500).json({ message: 'Erreur lors de la création de la commande' });
    }
});

// Get order by ID or order number
router.get('/:id', async (req, res) => {
    try {
        let order;
        
        // Try to find by MongoDB ID first, then by order number
        if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
            order = await Order.findById(req.params.id);
        } else {
            order = await Order.findOne({ numeroCommande: req.params.id });
        }
        
        if (!order) {
            return res.status(404).json({ message: 'Commande non trouvée' });
        }
        
        res.json({
            success: true,
            order
        });
        
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Update order status
router.put('/:id', async (req, res) => {
    try {
        console.log('Updating order:', req.params.id);
        
        let order;
        
        // Find order by ID or order number
        if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
            order = await Order.findById(req.params.id);
        } else {
            order = await Order.findOne({ numeroCommande: req.params.id });
        }
        
        if (!order) {
            return res.status(404).json({ message: 'Commande non trouvée' });
        }
        
        // Update allowed fields
        const allowedUpdates = ['statut', 'noteInterne', 'dateLivraison'];
        
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                order[field] = req.body[field];
            }
        });
        
        const updatedOrder = await order.save();
        
        console.log('Order updated successfully');
        
        res.json({
            success: true,
            order: updatedOrder,
            message: 'Commande mise à jour avec succès'
        });
        
    } catch (error) {
        console.error('Update order error:', error);
        
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: errors.join(', ') });
        }
        
        res.status(500).json({ message: 'Erreur lors de la mise à jour de la commande' });
    }
});

// Get user orders (protected route)
router.get('/user/all', auth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        const orders = await Order.find({ 'client.email': req.user.email })
            .sort({ dateCommande: -1 })
            .skip(skip)
            .limit(limit);
            
        const total = await Order.countDocuments({ 'client.email': req.user.email });
        
        res.json({
            success: true,
            orders,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalOrders: total,
                hasNextPage: page < Math.ceil(total / limit),
                hasPrevPage: page > 1
            }
        });
        
    } catch (error) {
        console.error('Get user orders error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Get order statistics
router.get('/stats/all', async (req, res) => {
    try {
        const stats = await Order.getStats();
        
        // Get orders by status
        const statusStats = await Order.aggregate([
            {
                $group: {
                    _id: '$statut',
                    count: { $sum: 1 }
                }
            }
        ]);
        
        // Get monthly orders for the last 12 months
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
        
        const monthlyStats = await Order.aggregate([
            {
                $match: {
                    dateCommande: { $gte: twelveMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$dateCommande' },
                        month: { $month: '$dateCommande' }
                    },
                    orders: { $sum: 1 },
                    revenue: { $sum: '$total' }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 }
            }
        ]);
        
        res.json({
            success: true,
            stats: {
                ...stats,
                statusStats,
                monthlyStats
            }
        });
        
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Search orders
router.get('/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        const searchRegex = new RegExp(query, 'i');
        
        const orders = await Order.find({
            $or: [
                { numeroCommande: searchRegex },
                { 'client.nom': searchRegex },
                { 'client.prenom': searchRegex },
                { 'client.email': searchRegex },
                { 'client.telephone': searchRegex }
            ]
        })
        .sort({ dateCommande: -1 })
        .skip(skip)
        .limit(limit);
        
        const total = await Order.countDocuments({
            $or: [
                { numeroCommande: searchRegex },
                { 'client.nom': searchRegex },
                { 'client.prenom': searchRegex },
                { 'client.email': searchRegex },
                { 'client.telephone': searchRegex }
            ]
        });
        
        res.json({
            success: true,
            orders,
            query,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalOrders: total,
                hasNextPage: page < Math.ceil(total / limit),
                hasPrevPage: page > 1
            }
        });
        
    } catch (error) {
        console.error('Search orders error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

module.exports = router;
