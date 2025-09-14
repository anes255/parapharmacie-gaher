const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/orders
// @desc    Create new order
// @access  Public/Private
router.post('/', async (req, res) => {
    try {
        console.log('📦 Creating new order...');
        console.log('Order data:', req.body);
        
        const {
            client,
            articles,
            sousTotal,
            fraisLivraison,
            total,
            modePaiement,
            commentaires,
            adresseLivraison
        } = req.body;
        
        // Validation
        if (!client || !client.nom || !client.prenom || !client.email || !client.telephone) {
            return res.status(400).json({
                message: 'Informations client manquantes'
            });
        }
        
        if (!articles || articles.length === 0) {
            return res.status(400).json({
                message: 'Aucun article dans la commande'
            });
        }
        
        if (!sousTotal || !total) {
            return res.status(400).json({
                message: 'Montants manquants'
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(client.email)) {
            return res.status(400).json({
                message: 'Format d\'email invalide'
            });
        }
        
        // Validate articles and check stock
        for (let article of articles) {
            if (!article.productId || !article.nom || !article.prix || !article.quantite) {
                return res.status(400).json({
                    message: 'Informations article manquantes'
                });
            }
            
            // Check if product exists and has enough stock
            try {
                const product = await Product.findById(article.productId);
                if (!product) {
                    return res.status(400).json({
                        message: `Produit non trouvé: ${article.nom}`
                    });
                }
                
                if (product.stock < article.quantite) {
                    return res.status(400).json({
                        message: `Stock insuffisant pour ${product.nom}. Disponible: ${product.stock}, Demandé: ${article.quantite}`
                    });
                }
                
                if (!product.actif) {
                    return res.status(400).json({
                        message: `Produit non disponible: ${product.nom}`
                    });
                }
                
            } catch (error) {
                console.log('Product validation skipped (product not in DB)');
            }
        }
        
        // Generate order number
        const numeroCommande = 'CMD' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 100).toString().padStart(2, '0');
        
        // Find or create user
        let user = null;
        try {
            user = await User.findOne({ email: client.email.toLowerCase() });
            if (!user) {
                // Create guest user
                user = new User({
                    nom: client.nom,
                    prenom: client.prenom,
                    email: client.email.toLowerCase(),
                    telephone: client.telephone,
                    adresse: client.adresse || '',
                    ville: client.ville || '',
                    wilaya: client.wilaya || '',
                    role: 'client',
                    actif: true,
                    password: 'temporary_' + Date.now() // Temporary password for guest users
                });
                await user.save();
                console.log('Guest user created:', user.email);
            }
        } catch (error) {
            console.log('User creation/lookup failed, continuing without user link');
        }
        
        // Create order
        const orderData = {
            numeroCommande,
            client: {
                nom: client.nom.trim(),
                prenom: client.prenom.trim(),
                email: client.email.toLowerCase().trim(),
                telephone: client.telephone.replace(/\s+/g, ''),
                adresse: client.adresse ? client.adresse.trim() : '',
                ville: client.ville ? client.ville.trim() : '',
                wilaya: client.wilaya || '',
                codePostal: client.codePostal ? client.codePostal.trim() : ''
            },
            articles: articles.map(article => ({
                productId: article.productId,
                nom: article.nom,
                prix: parseFloat(article.prix),
                quantite: parseInt(article.quantite),
                image: article.image || '',
                categorie: article.categorie || ''
            })),
            sousTotal: parseFloat(sousTotal),
            fraisLivraison: parseFloat(fraisLivraison) || 0,
            total: parseFloat(total),
            statut: 'en-attente',
            modePaiement: modePaiement || 'Paiement à la livraison',
            commentaires: commentaires ? commentaires.trim() : '',
            adresseLivraison: adresseLivraison || client.adresse,
            dateCommande: new Date(),
            utilisateur: user ? user._id : null
        };
        
        const order = new Order(orderData);
        await order.save();
        
        // Update product stock
        for (let article of articles) {
            try {
                await Product.findByIdAndUpdate(
                    article.productId,
                    { $inc: { stock: -article.quantite } },
                    { new: true }
                );
                console.log(`Stock updated for product ${article.productId}: -${article.quantite}`);
            } catch (error) {
                console.log(`Stock update failed for product ${article.productId}:`, error.message);
            }
        }
        
        console.log('✅ Order created successfully:', numeroCommande);
        
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
// @access  Public (with order number) / Private
router.get('/:id', async (req, res) => {
    try {
        console.log('📋 Getting order:', req.params.id);
        
        let query;
        if (req.params.id.startsWith('CMD')) {
            // Search by order number
            query = { numeroCommande: req.params.id };
        } else {
            // Search by MongoDB ID
            query = { _id: req.params.id };
        }
        
        const order = await Order.findOne(query)
            .populate('utilisateur', 'nom prenom email telephone');
        
        if (!order) {
            return res.status(404).json({
                message: 'Commande non trouvée'
            });
        }
        
        // If user is authenticated, check if they own this order
        if (req.headers['x-auth-token']) {
            try {
                const auth = require('../middleware/auth');
                await auth(req, res, () => {});
                
                if (req.user) {
                    const user = await User.findById(req.user.id);
                    
                    // Only allow access if user owns the order or is admin
                    if (user.role !== 'admin' && 
                        order.utilisateur && 
                        order.utilisateur._id.toString() !== req.user.id &&
                        order.client.email !== user.email) {
                        return res.status(403).json({
                            message: 'Accès refusé'
                        });
                    }
                }
            } catch (authError) {
                // If auth fails, continue (public access by order number)
                console.log('Auth failed, allowing public access');
            }
        }
        
        res.json(order);
        
    } catch (error) {
        console.error('❌ Get order error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération de la commande'
        });
    }
});

// @route   GET /api/orders/user/all
// @desc    Get all orders for authenticated user
// @access  Private
router.get('/user/all', auth, async (req, res) => {
    try {
        console.log('📋 Getting user orders for:', req.user.id);
        
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                message: 'Utilisateur non trouvé'
            });
        }
        
        // Find orders by user ID or email
        const orders = await Order.find({
            $or: [
                { utilisateur: req.user.id },
                { 'client.email': user.email }
            ]
        }).sort({ dateCommande: -1 });
        
        console.log(`✅ Found ${orders.length} orders for user`);
        
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

// @route   PUT /api/orders/:id
// @desc    Update order (admin only)
// @access  Private (Admin)
router.put('/:id', auth, async (req, res) => {
    try {
        console.log('🔄 Updating order:', req.params.id);
        
        const user = await User.findById(req.user.id);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({
                message: 'Accès refusé - Droits administrateur requis'
            });
        }
        
        const { statut, commentaires, adresseLivraison } = req.body;
        
        const validStatuses = ['en-attente', 'confirmée', 'préparée', 'expédiée', 'livrée', 'annulée'];
        if (statut && !validStatuses.includes(statut)) {
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
        
        // Update fields
        if (statut) {
            order.statut = statut;
            
            // Set delivery date when status is set to delivered
            if (statut === 'livrée' && !order.dateLivraison) {
                order.dateLivraison = new Date();
            }
            
            // Clear delivery date if status is changed from delivered
            if (statut !== 'livrée') {
                order.dateLivraison = null;
            }
        }
        
        if (commentaires !== undefined) {
            order.commentaires = commentaires.trim();
        }
        
        if (adresseLivraison !== undefined) {
            order.adresseLivraison = adresseLivraison.trim();
        }
        
        await order.save();
        
        console.log('✅ Order updated:', order.numeroCommande);
        
        res.json({
            message: 'Commande mise à jour avec succès',
            order
        });
        
    } catch (error) {
        console.error('❌ Update order error:', error);
        res.status(500).json({
            message: 'Erreur lors de la mise à jour de la commande'
        });
    }
});

// @route   GET /api/orders
// @desc    Get all orders (admin only) or user orders
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        console.log('📋 Getting orders...');
        
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                message: 'Utilisateur non trouvé'
            });
        }
        
        let query = {};
        let isAdmin = user.role === 'admin';
        
        if (!isAdmin) {
            // Non-admin users only see their own orders
            query = {
                $or: [
                    { utilisateur: req.user.id },
                    { 'client.email': user.email }
                ]
            };
        }
        
        // Apply filters (admin only)
        if (isAdmin) {
            if (req.query.statut) {
                query.statut = req.query.statut;
            }
            
            if (req.query.dateDebut || req.query.dateFin) {
                query.dateCommande = {};
                if (req.query.dateDebut) {
                    query.dateCommande.$gte = new Date(req.query.dateDebut);
                }
                if (req.query.dateFin) {
                    query.dateCommande.$lte = new Date(req.query.dateFin);
                }
            }
        }
        
        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        const orders = await Order.find(query)
            .populate('utilisateur', 'nom prenom email telephone')
            .sort({ dateCommande: -1 })
            .skip(skip)
            .limit(limit);
            
        const total = await Order.countDocuments(query);
        
        console.log(`✅ Found ${orders.length} orders`);
        
        res.json({
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
        console.error('❌ Get orders error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des commandes'
        });
    }
});

// @route   DELETE /api/orders/:id
// @desc    Delete order (admin only)
// @access  Private (Admin)
router.delete('/:id', auth, async (req, res) => {
    try {
        console.log('🗑️ Deleting order:', req.params.id);
        
        const user = await User.findById(req.user.id);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({
                message: 'Accès refusé - Droits administrateur requis'
            });
        }
        
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({
                message: 'Commande non trouvée'
            });
        }
        
        // Restore product stock if order is being deleted
        if (order.statut !== 'annulée') {
            for (let article of order.articles) {
                try {
                    await Product.findByIdAndUpdate(
                        article.productId,
                        { $inc: { stock: article.quantite } },
                        { new: true }
                    );
                    console.log(`Stock restored for product ${article.productId}: +${article.quantite}`);
                } catch (error) {
                    console.log(`Stock restoration failed for product ${article.productId}`);
                }
            }
        }
        
        await Order.findByIdAndDelete(req.params.id);
        
        console.log('✅ Order deleted:', order.numeroCommande);
        
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

// @route   POST /api/orders/:id/cancel
// @desc    Cancel order
// @access  Private (Owner or Admin)
router.post('/:id/cancel', auth, async (req, res) => {
    try {
        console.log('❌ Canceling order:', req.params.id);
        
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                message: 'Utilisateur non trouvé'
            });
        }
        
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({
                message: 'Commande non trouvée'
            });
        }
        
        // Check if user can cancel this order
        const canCancel = user.role === 'admin' || 
                         (order.utilisateur && order.utilisateur.toString() === req.user.id) ||
                         order.client.email === user.email;
        
        if (!canCancel) {
            return res.status(403).json({
                message: 'Vous ne pouvez pas annuler cette commande'
            });
        }
        
        // Check if order can be cancelled
        if (order.statut === 'livrée') {
            return res.status(400).json({
                message: 'Impossible d\'annuler une commande déjà livrée'
            });
        }
        
        if (order.statut === 'annulée') {
            return res.status(400).json({
                message: 'Cette commande est déjà annulée'
            });
        }
        
        // Cancel the order
        order.statut = 'annulée';
        order.dateAnnulation = new Date();
        await order.save();
        
        // Restore product stock
        for (let article of order.articles) {
            try {
                await Product.findByIdAndUpdate(
                    article.productId,
                    { $inc: { stock: article.quantite } },
                    { new: true }
                );
                console.log(`Stock restored for product ${article.productId}: +${article.quantite}`);
            } catch (error) {
                console.log(`Stock restoration failed for product ${article.productId}`);
            }
        }
        
        console.log('✅ Order cancelled:', order.numeroCommande);
        
        res.json({
            message: 'Commande annulée avec succès',
            order
        });
        
    } catch (error) {
        console.error('❌ Cancel order error:', error);
        res.status(500).json({
            message: 'Erreur lors de l\'annulation de la commande'
        });
    }
});

module.exports = router;
