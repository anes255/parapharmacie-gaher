const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { auth, adminAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Helper function to generate order number
const generateOrderNumber = () => {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `CMD${timestamp.slice(-8)}${random}`;
};

// Helper function to calculate shipping cost
const calculateShippingCost = (wilaya, total) => {
    // Free shipping for orders over 5000 DA
    if (total >= 5000) return 0;
    
    // Standard shipping cost
    return 300;
};

// Helper function to validate order items
const validateOrderItems = async (items) => {
    const errors = [];
    const validatedItems = [];
    
    for (const item of items) {
        if (!item.productId || !item.quantite || item.quantite <= 0) {
            errors.push(`Article invalide: ${item.nom || 'Inconnu'}`);
            continue;
        }
        
        // Get product from database to validate
        const product = await Product.findById(item.productId);
        if (!product || !product.actif) {
            errors.push(`Produit non disponible: ${item.nom || 'Inconnu'}`);
            continue;
        }
        
        if (product.stock < item.quantite) {
            errors.push(`Stock insuffisant pour ${product.nom}. Stock disponible: ${product.stock}`);
            continue;
        }
        
        // Add validated item with current product data
        validatedItems.push({
            productId: product._id.toString(),
            nom: product.nom,
            prix: product.prix,
            quantite: item.quantite,
            image: product.image || '',
            sousTotal: product.prix * item.quantite
        });
    }
    
    return { errors, validatedItems };
};

// @route   POST /api/orders
// @desc    Create new order
// @access  Public (can be used by guests or logged-in users)
router.post('/', optionalAuth, async (req, res) => {
    try {
        console.log('🛒 Order creation request from:', req.user?.email || 'Guest');
        
        const {
            client,
            articles,
            modePaiement = 'Paiement à la livraison',
            commentaires = ''
        } = req.body;
        
        // Validate client information
        const requiredClientFields = ['prenom', 'nom', 'email', 'telephone', 'adresse', 'wilaya'];
        const missingFields = requiredClientFields.filter(field => !client || !client[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Informations client manquantes',
                missingFields
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(client.email)) {
            return res.status(400).json({
                success: false,
                message: 'Format d\'email invalide'
            });
        }
        
        // Validate phone format (Algerian)
        const phoneRegex = /^(\+213|0)[5-9]\d{8}$/;
        if (!phoneRegex.test(client.telephone.replace(/\s+/g, ''))) {
            return res.status(400).json({
                success: false,
                message: 'Format de téléphone invalide'
            });
        }
        
        // Validate articles
        if (!articles || !Array.isArray(articles) || articles.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Aucun article dans la commande'
            });
        }
        
        // Validate and get current product data
        const { errors, validatedItems } = await validateOrderItems(articles);
        
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Erreurs dans les articles de la commande',
                errors
            });
        }
        
        // Calculate totals
        const sousTotal = validatedItems.reduce((sum, item) => sum + item.sousTotal, 0);
        const fraisLivraison = calculateShippingCost(client.wilaya, sousTotal);
        const total = sousTotal + fraisLivraison;
        
        // Generate order number
        let numeroCommande;
        let orderExists;
        do {
            numeroCommande = generateOrderNumber();
            orderExists = await Order.findOne({ numeroCommande });
        } while (orderExists);
        
        // Create order object
        const orderData = {
            numeroCommande,
            client: {
                userId: req.user?._id || null,
                prenom: client.prenom.trim(),
                nom: client.nom.trim(),
                email: client.email.toLowerCase().trim(),
                telephone: client.telephone.replace(/\s+/g, ''),
                adresse: client.adresse.trim(),
                ville: client.ville?.trim() || '',
                wilaya: client.wilaya,
                codePostal: client.codePostal?.trim() || ''
            },
            articles: validatedItems,
            sousTotal,
            fraisLivraison,
            total,
            modePaiement,
            commentaires: commentaires.trim(),
            statut: 'en-attente',
            statutPaiement: 'en-attente',
            dateCommande: new Date()
        };
        
        // Create order
        const order = new Order(orderData);
        await order.save();
        
        // Update product stock
        for (const item of validatedItems) {
            await Product.findByIdAndUpdate(
                item.productId,
                { $inc: { stock: -item.quantite } }
            );
        }
        
        // Update user statistics if user is logged in
        if (req.user) {
            await User.findByIdAndUpdate(req.user._id, {
                $inc: {
                    'statistiques.totalCommandes': 1,
                    'statistiques.totalDepense': total
                },
                $set: {
                    'statistiques.derniereCommande': new Date(),
                    'statistiques.commandeMoyenne': (req.user.statistiques.totalDepense + total) / (req.user.statistiques.totalCommandes + 1)
                }
            });
        }
        
        console.log(`✅ Order created: ${numeroCommande} - Total: ${total} DA`);
        
        res.status(201).json({
            success: true,
            message: 'Commande créée avec succès',
            order: {
                id: order._id,
                numeroCommande: order.numeroCommande,
                total: order.total,
                statut: order.statut,
                dateCommande: order.dateCommande,
                client: order.client,
                articles: order.articles,
                fraisLivraison: order.fraisLivraison
            }
        });
        
    } catch (error) {
        console.error('❌ Order creation error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Données de commande invalides',
                errors: messages
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de la commande'
        });
    }
});

// @route   GET /api/orders/:id
// @desc    Get single order by ID
// @access  Private (user can only see their own orders, admin can see all)
router.get('/:id', auth, async (req, res) => {
    try {
        console.log('📋 Order fetch request:', req.params.id, 'by:', req.user.email);
        
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Commande non trouvée'
            });
        }
        
        // Check if user can access this order
        const canAccess = req.user.role === 'admin' || 
                         (order.client.userId && order.client.userId.toString() === req.user._id.toString()) ||
                         (order.client.email === req.user.email);
        
        if (!canAccess) {
            return res.status(403).json({
                success: false,
                message: 'Accès refusé à cette commande'
            });
        }
        
        console.log(`✅ Order found: ${order.numeroCommande}`);
        
        res.json({
            success: true,
            order
        });
        
    } catch (error) {
        console.error('❌ Order fetch error:', error);
        
        if (error.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: 'Commande non trouvée'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement de la commande'
        });
    }
});

// @route   GET /api/orders/user/:userId
// @desc    Get all orders for a specific user
// @access  Private (user can only see their own orders, admin can see all)
router.get('/user/:userId', auth, async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10, status } = req.query;
        
        console.log('👤 User orders request:', userId, 'by:', req.user.email);
        
        // Check if user can access these orders
        if (req.user.role !== 'admin' && req.user._id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Accès refusé aux commandes de cet utilisateur'
            });
        }
        
        // Build filter
        const filter = {
            $or: [
                { 'client.userId': userId },
                { 'client.email': req.user.email }
            ]
        };
        
        if (status) {
            filter.statut = status;
        }
        
        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = Math.min(parseInt(limit), 50);
        
        // Execute query
        const [orders, totalOrders] = await Promise.all([
            Order.find(filter)
                .sort({ dateCommande: -1 })
                .skip(skip)
                .limit(limitNum),
            Order.countDocuments(filter)
        ]);
        
        const totalPages = Math.ceil(totalOrders / limitNum);
        
        console.log(`✅ Found ${orders.length} orders for user`);
        
        res.json({
            success: true,
            orders,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalOrders,
                hasNextPage: parseInt(page) < totalPages,
                hasPrevPage: parseInt(page) > 1
            }
        });
        
    } catch (error) {
        console.error('❌ User orders fetch error:', error);
        
        if (error.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement des commandes'
        });
    }
});

// @route   GET /api/orders
// @desc    Get all orders (Admin only) or current user orders
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        console.log('📋 Orders list request by:', req.user.email, '| Role:', req.user.role);
        
        const { 
            page = 1, 
            limit = 20, 
            status, 
            dateFrom, 
            dateTo, 
            search 
        } = req.query;
        
        // Build filter based on user role
        let filter = {};
        
        if (req.user.role === 'admin') {
            // Admin can see all orders
            if (status) filter.statut = status;
            if (search) {
                const searchRegex = new RegExp(search, 'i');
                filter.$or = [
                    { numeroCommande: searchRegex },
                    { 'client.nom': searchRegex },
                    { 'client.prenom': searchRegex },
                    { 'client.email': searchRegex },
                    { 'client.telephone': searchRegex }
                ];
            }
        } else {
            // Regular users can only see their own orders
            filter = {
                $or: [
                    { 'client.userId': req.user._id },
                    { 'client.email': req.user.email }
                ]
            };
            if (status) filter.statut = status;
        }
        
        // Date range filter
        if (dateFrom || dateTo) {
            filter.dateCommande = {};
            if (dateFrom) filter.dateCommande.$gte = new Date(dateFrom);
            if (dateTo) {
                const endDate = new Date(dateTo);
                endDate.setHours(23, 59, 59, 999);
                filter.dateCommande.$lte = endDate;
            }
        }
        
        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = Math.min(parseInt(limit), req.user.role === 'admin' ? 100 : 50);
        
        // Execute query
        const [orders, totalOrders] = await Promise.all([
            Order.find(filter)
                .sort({ dateCommande: -1 })
                .skip(skip)
                .limit(limitNum),
            Order.countDocuments(filter)
        ]);
        
        const totalPages = Math.ceil(totalOrders / limitNum);
        
        console.log(`✅ Found ${orders.length} orders (${totalOrders} total)`);
        
        res.json({
            success: true,
            orders,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalOrders,
                hasNextPage: parseInt(page) < totalPages,
                hasPrevPage: parseInt(page) > 1
            },
            isAdmin: req.user.role === 'admin'
        });
        
    } catch (error) {
        console.error('❌ Orders list error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement des commandes'
        });
    }
});

// @route   PATCH /api/orders/:id/status
// @desc    Update order status (Admin only)
// @access  Private/Admin
router.patch('/:id/status', adminAuth, async (req, res) => {
    try {
        const { status, commentaire = '' } = req.body;
        
        console.log('📝 Order status update:', req.params.id, 'to:', status, 'by:', req.user.email);
        
        const validStatuses = ['en-attente', 'confirmée', 'préparée', 'expédiée', 'livrée', 'annulée'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Statut invalide',
                validStatuses
            });
        }
        
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Commande non trouvée'
            });
        }
        
        const oldStatus = order.statut;
        
        // Update status with history tracking
        order.statut = status;
        
        // Add to status history
        order.historiqueStatut.push({
            statut: status,
            date: new Date(),
            modifiePar: req.user._id,
            commentaire: commentaire || `Statut changé de "${oldStatus}" vers "${status}"`
        });
        
        // Update relevant dates
        switch (status) {
            case 'confirmée':
                order.dateConfirmation = new Date();
                break;
            case 'expédiée':
                order.dateExpedition = new Date();
                break;
            case 'livrée':
                order.dateLivraison = new Date();
                if (order.modePaiement === 'Paiement à la livraison') {
                    order.statutPaiement = 'payé';
                }
                break;
            case 'annulée':
                // Restore product stock if order is cancelled
                for (const item of order.articles) {
                    await Product.findByIdAndUpdate(
                        item.productId,
                        { $inc: { stock: item.quantite } }
                    );
                }
                break;
        }
        
        await order.save();
        
        console.log(`✅ Order status updated: ${order.numeroCommande} -> ${status}`);
        
        res.json({
            success: true,
            message: 'Statut de la commande mis à jour',
            order: {
                id: order._id,
                numeroCommande: order.numeroCommande,
                statut: order.statut,
                dateCommande: order.dateCommande,
                dateConfirmation: order.dateConfirmation,
                dateExpedition: order.dateExpedition,
                dateLivraison: order.dateLivraison
            }
        });
        
    } catch (error) {
        console.error('❌ Order status update error:', error);
        
        if (error.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: 'Commande non trouvée'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour du statut'
        });
    }
});

// @route   DELETE /api/orders/:id
// @desc    Cancel/Delete order (Admin only or user's own pending orders)
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        console.log('🗑️ Order cancellation request:', req.params.id, 'by:', req.user.email);
        
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Commande non trouvée'
            });
        }
        
        // Check permissions
        const canCancel = req.user.role === 'admin' || 
                         (order.client.userId && order.client.userId.toString() === req.user._id.toString()) ||
                         (order.client.email === req.user.email);
        
        if (!canCancel) {
            return res.status(403).json({
                success: false,
                message: 'Vous ne pouvez pas annuler cette commande'
            });
        }
        
        // Users can only cancel pending orders, admins can cancel any
        if (req.user.role !== 'admin' && order.statut !== 'en-attente') {
            return res.status(400).json({
                success: false,
                message: 'Seules les commandes en attente peuvent être annulées'
            });
        }
        
        // Restore product stock
        for (const item of order.articles) {
            await Product.findByIdAndUpdate(
                item.productId,
                { $inc: { stock: item.quantite } }
            );
        }
        
        // Update order status to cancelled
        order.statut = 'annulée';
        order.historiqueStatut.push({
            statut: 'annulée',
            date: new Date(),
            modifiePar: req.user._id,
            commentaire: `Commande annulée par ${req.user.role === 'admin' ? 'l\'administrateur' : 'le client'}`
        });
        
        await order.save();
        
        console.log(`✅ Order cancelled: ${order.numeroCommande}`);
        
        res.json({
            success: true,
            message: 'Commande annulée avec succès'
        });
        
    } catch (error) {
        console.error('❌ Order cancellation error:', error);
        
        if (error.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: 'Commande non trouvée'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'annulation de la commande'
        });
    }
});

// @route   GET /api/orders/stats/summary
// @desc    Get orders statistics (Admin only)
// @access  Private/Admin
router.get('/stats/summary', adminAuth, async (req, res) => {
    try {
        console.log('📊 Order statistics request by:', req.user.email);
        
        const { period = '30' } = req.query; // days
        const periodDays = parseInt(period);
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - periodDays);
        
        // Get order statistics
        const [
            totalOrders,
            pendingOrders,
            completedOrders,
            cancelledOrders,
            revenueStats,
            recentOrders
        ] = await Promise.all([
            Order.countDocuments(),
            Order.countDocuments({ statut: 'en-attente' }),
            Order.countDocuments({ statut: 'livrée' }),
            Order.countDocuments({ statut: 'annulée' }),
            Order.aggregate([
                { $match: { dateCommande: { $gte: dateFrom } } },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$total' },
                        avgOrderValue: { $avg: '$total' },
                        totalOrdersInPeriod: { $sum: 1 }
                    }
                }
            ]),
            Order.find()
                .sort({ dateCommande: -1 })
                .limit(5)
                .select('numeroCommande client.nom client.prenom total statut dateCommande')
        ]);
        
        const revenue = revenueStats[0] || {
            totalRevenue: 0,
            avgOrderValue: 0,
            totalOrdersInPeriod: 0
        };
        
        console.log('✅ Order statistics generated');
        
        res.json({
            success: true,
            stats: {
                totalOrders,
                pendingOrders,
                completedOrders,
                cancelledOrders,
                revenue: {
                    period: `${periodDays} jours`,
                    total: Math.round(revenue.totalRevenue),
                    average: Math.round(revenue.avgOrderValue),
                    ordersCount: revenue.totalOrdersInPeriod
                }
            },
            recentOrders,
            period: periodDays
        });
        
    } catch (error) {
        console.error('❌ Order statistics error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du calcul des statistiques'
        });
    }
});

module.exports = router;
