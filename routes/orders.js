const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/orders
// @desc    Create a new order
// @access  Public
router.post('/', async (req, res) => {
    try {
        console.log('📝 Creating new order...');
        
        const {
            client,
            articles,
            fraisLivraison,
            remise,
            codePromo,
            modePaiement,
            commentaires,
            livraison,
            newsletter
        } = req.body;
        
        // Validation
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
        
        // Validate articles and calculate totals
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
            
            // Try to find product in database to verify stock
            try {
                const product = await Product.findById(article.id);
                if (product) {
                    if (product.stock < article.quantite) {
                        return res.status(400).json({
                            message: `Stock insuffisant pour ${product.nom}. Stock disponible: ${product.stock}`
                        });
                    }
                    
                    // Verify price matches
                    if (Math.abs(product.prix - article.prix) > 0.01) {
                        console.log(`Price mismatch for ${product.nom}: expected ${product.prix}, got ${article.prix}`);
                    }
                }
            } catch (error) {
                console.log('Product verification skipped:', error.message);
            }
            
            const articleSousTotal = article.prix * article.quantite;
            sousTotal += articleSousTotal;
            
            validatedArticles.push({
                id: article.id,
                nom: article.nom,
                prix: article.prix,
                quantite: article.quantite,
                sousTotal: articleSousTotal,
                image: article.image || undefined,
                categorie: article.categorie || undefined,
                marque: article.marque || undefined
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
        
        // Create order
        const order = new Order({
            client: {
                nom: client.nom.trim(),
                prenom: client.prenom.trim(),
                email: client.email.toLowerCase().trim(),
                telephone: client.telephone.trim(),
                adresse: client.adresse.trim(),
                ville: client.ville ? client.ville.trim() : undefined,
                wilaya: client.wilaya,
                codePostal: client.codePostal ? client.codePostal.trim() : undefined
            },
            articles: validatedArticles,
            sousTotal,
            fraisLivraison: calculatedFraisLivraison,
            remise: remise || 0,
            codePromo: codePromo ? codePromo.trim().toUpperCase() : undefined,
            total,
            modePaiement: modePaiement || 'Paiement à la livraison',
            commentaires: commentaires ? commentaires.trim() : undefined,
            livraison: livraison || undefined,
            newsletter: Boolean(newsletter),
            dateCommande: new Date()
        });
        
        // Add initial history entry
        order.addToHistory('Commande créée', null, 'Nouvelle commande reçue');
        
        await order.save();
        
        // Update product stock
        for (const article of validatedArticles) {
            try {
                await Product.findByIdAndUpdate(
                    article.id,
                    { $inc: { stock: -article.quantite } },
                    { new: true }
                );
            } catch (error) {
                console.log(`Stock update skipped for ${article.nom}:`, error.message);
            }
        }
        
        console.log('✅ Order created:', order.numeroCommande);
        
        res.status(201).json({
            message: 'Commande créée avec succès',
            order: {
                _id: order._id,
                numeroCommande: order.numeroCommande,
                total: order.total,
                statut: order.statut,
                dateCommande: order.dateCommande
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
            message: 'Erreur lors de la création de la commande'
        });
    }
});

// @route   GET /api/orders/:id
// @desc    Get order by ID
// @access  Public (for order confirmation)
router.get('/:id', async (req, res) => {
    try {
        console.log('👁️ Getting order:', req.params.id);
        
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
            message: 'Erreur lors de la récupération de la commande'
        });
    }
});

// @route   GET /api/orders/track/:numeroCommande
// @desc    Track order by order number
// @access  Public
router.get('/track/:numeroCommande', async (req, res) => {
    try {
        console.log('📦 Tracking order:', req.params.numeroCommande);
        
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
            datePreparation: order.datePreparation,
            dateExpedition: order.dateExpedition,
            dateLivraison: order.dateLivraison,
            transporteur: order.transporteur,
            historique: order.historique.map(h => ({
                action: h.action,
                date: h.date
            }))
        });
        
    } catch (error) {
        console.error('❌ Track order error:', error);
        res.status(500).json({
            message: 'Erreur lors du suivi de la commande'
        });
    }
});

// @route   GET /api/orders/user/:email
// @desc    Get orders by user email
// @access  Public (with email verification)
router.get('/user/:email', async (req, res) => {
    try {
        console.log('👤 Getting user orders:', req.params.email);
        
        const { email } = req.params;
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                message: 'Format d\'email invalide'
            });
        }
        
        const orders = await Order.find({ 'client.email': email.toLowerCase() })
            .sort({ dateCommande: -1 })
            .limit(50);
        
        res.json({
            orders,
            total: orders.length
        });
        
    } catch (error) {
        console.error('❌ Get user orders error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des commandes'
        });
    }
});

// @route   PUT /api/orders/:id/cancel
// @desc    Cancel an order
// @access  Public (with validation)
router.put('/:id/cancel', async (req, res) => {
    try {
        console.log('❌ Cancelling order:', req.params.id);
        
        const { email, reason } = req.body;
        
        if (!email) {
            return res.status(400).json({
                message: 'Email requis pour annuler la commande'
            });
        }
        
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({
                message: 'Commande non trouvée'
            });
        }
        
        // Verify email matches
        if (order.client.email.toLowerCase() !== email.toLowerCase()) {
            return res.status(403).json({
                message: 'Non autorisé à annuler cette commande'
            });
        }
        
        // Check if order can be cancelled
        if (!order.canBeCancelled()) {
            return res.status(400).json({
                message: 'Cette commande ne peut plus être annulée'
            });
        }
        
        // Cancel order
        order.statut = 'annulée';
        order.dateAnnulation = new Date();
        order.addToHistory(
            'Commande annulée par le client',
            email,
            reason ? `Raison: ${reason}` : 'Annulation sans raison spécifiée'
        );
        
        await order.save();
        
        // Restore product stock
        for (const article of order.articles) {
            try {
                await Product.findByIdAndUpdate(
                    article.id,
                    { $inc: { stock: article.quantite } },
                    { new: true }
                );
            } catch (error) {
                console.log(`Stock restoration skipped for ${article.nom}:`, error.message);
            }
        }
        
        console.log('✅ Order cancelled:', order.numeroCommande);
        
        res.json({
            message: 'Commande annulée avec succès',
            order: {
                numeroCommande: order.numeroCommande,
                statut: order.statut,
                dateAnnulation: order.dateAnnulation
            }
        });
        
    } catch (error) {
        console.error('❌ Cancel order error:', error);
        res.status(500).json({
            message: 'Erreur lors de l\'annulation de la commande'
        });
    }
});

// @route   GET /api/orders (with auth)
// @desc    Get user's orders (authenticated)
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        console.log('📋 Getting authenticated user orders:', req.user.email);
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        let query = { 'client.email': req.user.email };
        
        // Status filter
        if (req.query.statut) {
            query.statut = req.query.statut;
        }
        
        // Date range filter
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
        console.error('❌ Get authenticated orders error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des commandes'
        });
    }
});

// @route   GET /api/orders/stats/revenue
// @desc    Get revenue statistics
// @access  Public (for demo purposes)
router.get('/stats/revenue', async (req, res) => {
    try {
        console.log('📊 Getting revenue stats...');
        
        const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
        
        const stats = await Order.getRevenueStats(startDate, endDate);
        
        res.json({
            stats: stats[0] || {
                totalRevenue: 0,
                totalOrders: 0,
                averageOrderValue: 0
            },
            period: {
                startDate,
                endDate
            }
        });
        
    } catch (error) {
        console.error('❌ Revenue stats error:', error);
        res.status(500).json({
            message: 'Erreur lors du calcul des statistiques'
        });
    }
});

module.exports = router;
