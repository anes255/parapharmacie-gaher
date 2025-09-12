const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { auth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/orders - Create new order (Fixed for cross-device visibility)
router.post('/', optionalAuth, async (req, res) => {
    try {
        console.log('📦 Creating new order:', JSON.stringify(req.body, null, 2));
        
        const {
            client,
            articles,
            sousTotal,
            fraisLivraison,
            total,
            modePaiement,
            commentaires
        } = req.body;
        
        // Enhanced validation
        if (!client || !articles || !Array.isArray(articles) || articles.length === 0) {
            console.error('❌ Missing client or articles');
            return res.status(400).json({ 
                message: 'Informations client et articles requis',
                details: { client: !!client, articles: articles?.length || 0 }
            });
        }
        
        // Validate client information
        const requiredClientFields = ['nom', 'prenom', 'email', 'telephone', 'adresse', 'wilaya'];
        for (const field of requiredClientFields) {
            if (!client[field] || client[field].trim() === '') {
                console.error(`❌ Missing client field: ${field}`);
                return res.status(400).json({ 
                    message: `Champ client requis: ${field}` 
                });
            }
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(client.email)) {
            return res.status(400).json({ message: 'Format email invalide' });
        }
        
        // Validate phone format (Algerian numbers)
        const phoneRegex = /^(\+213|0)[0-9]{9}$/;
        if (!phoneRegex.test(client.telephone.replace(/\s/g, ''))) {
            return res.status(400).json({ message: 'Format téléphone invalide' });
        }
        
        // Validate totals
        if (typeof sousTotal !== 'number' || typeof fraisLivraison !== 'number' || typeof total !== 'number') {
            console.error('❌ Invalid pricing data');
            return res.status(400).json({ message: 'Données de prix invalides' });
        }
        
        // Validate and process articles
        const validatedArticles = [];
        let calculatedSubtotal = 0;
        
        for (let i = 0; i < articles.length; i++) {
            const article = articles[i];
            console.log(`🔍 Validating article ${i + 1}:`, article);
            
            if (!article.id || !article.nom || typeof article.prix !== 'number' || typeof article.quantite !== 'number') {
                console.error(`❌ Invalid article at index ${i}:`, article);
                return res.status(400).json({ 
                    message: `Article invalide à la position ${i + 1}`,
                    article: article
                });
            }
            
            if (article.quantite <= 0) {
                return res.status(400).json({ 
                    message: `Quantité invalide pour ${article.nom}` 
                });
            }
            
            // Try to find and validate product (optional - don't fail if product not found)
            let product = null;
            try {
                product = await Product.findById(article.id);
                if (product) {
                    console.log(`✅ Found product: ${product.nom}`);
                    
                    if (!product.actif) {
                        return res.status(400).json({ 
                            message: `Produit non disponible: ${article.nom}` 
                        });
                    }
                    
                    if (product.stock < article.quantite) {
                        return res.status(400).json({ 
                            message: `Stock insuffisant pour ${article.nom}. Stock disponible: ${product.stock}` 
                        });
                    }
                }
            } catch (error) {
                console.warn(`⚠️ Could not find product ${article.id}, continuing anyway`);
            }
            
            // Create validated article
            const validatedArticle = {
                productId: article.id,
                nom: article.nom,
                prix: article.prix,
                quantite: article.quantite,
                image: article.image || '',
                categorie: article.categorie || (product ? product.categorie : '')
            };
            
            validatedArticles.push(validatedArticle);
            calculatedSubtotal += article.prix * article.quantite;
        }
        
        // Validate calculated totals (allow small rounding differences)
        if (Math.abs(calculatedSubtotal - sousTotal) > 5) {
            console.error(`❌ Subtotal mismatch: calculated=${calculatedSubtotal}, provided=${sousTotal}`);
            return res.status(400).json({ 
                message: 'Erreur de calcul du sous-total',
                calculated: calculatedSubtotal,
                provided: sousTotal
            });
        }
        
        const expectedTotal = calculatedSubtotal + fraisLivraison;
        if (Math.abs(expectedTotal - total) > 5) {
            console.error(`❌ Total mismatch: expected=${expectedTotal}, provided=${total}`);
            return res.status(400).json({ 
                message: 'Erreur de calcul du total',
                expected: expectedTotal,
                provided: total
            });
        }
        
        // Generate unique order number
        const numeroCommande = await Order.generateOrderNumber();
        console.log(`🏷️ Generated order number: ${numeroCommande}`);
        
        // Create order
        const orderData = {
            numeroCommande,
            utilisateur: req.user ? req.user._id : null,
            client: {
                nom: client.nom.trim(),
                prenom: client.prenom.trim(),
                email: client.email.toLowerCase().trim(),
                telephone: client.telephone.replace(/\s/g, '').trim(),
                adresse: client.adresse.trim(),
                wilaya: client.wilaya,
                codePostal: client.codePostal ? client.codePostal.trim() : ''
            },
            articles: validatedArticles,
            sousTotal: Math.round(calculatedSubtotal),
            fraisLivraison: Math.round(fraisLivraison),
            total: Math.round(calculatedSubtotal + fraisLivraison),
            modePaiement: modePaiement || 'paiement-livraison',
            commentaires: commentaires ? commentaires.trim() : '',
            statut: 'en-attente',
            dateCommande: new Date(),
            createdBy: req.user ? 'user' : 'guest'
        };
        
        console.log('💾 Creating order in database:', {
            numeroCommande: orderData.numeroCommande,
            client: orderData.client.email,
            articles: orderData.articles.length,
            total: orderData.total
        });
        
        const order = new Order(orderData);
        await order.save();
        
        console.log(`✅ Order saved to database with ID: ${order._id}`);
        
        // Update product stock if products were found
        const stockUpdates = [];
        for (const article of validatedArticles) {
            try {
                const updateResult = await Product.findByIdAndUpdate(
                    article.productId,
                    { $inc: { stock: -article.quantite } },
                    { new: true }
                );
                
                if (updateResult) {
                    stockUpdates.push({
                        productId: article.productId,
                        nom: article.nom,
                        newStock: updateResult.stock
                    });
                    console.log(`📦 Updated stock for ${article.nom}: ${updateResult.stock}`);
                }
            } catch (error) {
                console.warn(`⚠️ Could not update stock for product ${article.productId}:`, error.message);
            }
        }
        
        // Return success response
        const response = {
            success: true,
            message: 'Commande créée avec succès',
            order: {
                _id: order._id,
                numeroCommande: order.numeroCommande,
                total: order.total,
                statut: order.statut,
                dateCommande: order.dateCommande,
                client: {
                    nom: order.client.nom,
                    prenom: order.client.prenom,
                    email: order.client.email
                },
                articles: order.articles.length
            },
            stockUpdates: stockUpdates
        };
        
        console.log(`🎉 Order creation successful:`, response.order);
        
        res.status(201).json(response);
        
    } catch (error) {
        console.error('💥 Order creation error:', error);
        
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ 
                message: 'Erreur de validation: ' + errors.join(', '),
                details: error.errors
            });
        }
        
        if (error.code === 11000) {
            return res.status(400).json({ 
                message: 'Numéro de commande déjà existant, veuillez réessayer'
            });
        }
        
        res.status(500).json({ 
            message: 'Erreur serveur lors de la création de la commande',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne'
        });
    }
});

// GET /api/orders - Get orders for authenticated users
router.get('/', auth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        let query = {};
        
        // If not admin, only show user's orders
        if (req.user.role !== 'admin') {
            query = {
                $or: [
                    { utilisateur: req.user._id },
                    { 'client.email': req.user.email }
                ]
            };
        }
        
        // Filter by status
        if (req.query.statut) {
            query.statut = req.query.statut;
        }
        
        const orders = await Order.find(query)
            .sort({ dateCommande: -1 })
            .skip(skip)
            .limit(limit)
            .populate('utilisateur', 'nom prenom email');
        
        const total = await Order.countDocuments(query);
        
        res.json({
            orders,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalOrders: total
            }
        });
        
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// GET /api/orders/:id - Get specific order
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const order = await Order.findOne({
            $or: [
                { _id: req.params.id },
                { numeroCommande: req.params.id }
            ]
        }).populate('utilisateur', 'nom prenom email');
        
        if (!order) {
            return res.status(404).json({ message: 'Commande non trouvée' });
        }
        
        // Check permissions
        if (req.user) {
            const canView = req.user.role === 'admin' || 
                          order.utilisateur?._id.toString() === req.user._id.toString() ||
                          order.client.email === req.user.email;
            
            if (!canView) {
                return res.status(403).json({ message: 'Accès refusé à cette commande' });
            }
        } else {
            // For guest users, don't return order details for security
            return res.status(401).json({ message: 'Authentification requise' });
        }
        
        res.json(order);
        
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// PUT /api/orders/:id - Update order (admin only or limited user updates)
router.put('/:id', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({ message: 'Commande non trouvée' });
        }
        
        // Check permissions
        const isAdmin = req.user.role === 'admin';
        const isOwner = order.utilisateur?.toString() === req.user._id.toString() || 
                       order.client.email === req.user.email;
        
        if (!isAdmin && !isOwner) {
            return res.status(403).json({ message: 'Accès refusé' });
        }
        
        const { statut, commentaires, adresseLivraison } = req.body;
        
        // Admin can update anything
        if (isAdmin) {
            if (statut) {
                const validStatuses = ['en-attente', 'confirmée', 'préparée', 'expédiée', 'livrée', 'annulée'];
                if (validStatuses.includes(statut)) {
                    const oldStatus = order.statut;
                    order.statut = statut;
                    
                    // Log modification
                    order.addModification('status_change', oldStatus, statut, req.user._id);
                    
                    // Set dates based on status
                    const now = new Date();
                    switch (statut) {
                        case 'confirmée':
                            if (!order.dateConfirmation) order.dateConfirmation = now;
                            break;
                        case 'expédiée':
                            if (!order.dateExpedition) order.dateExpedition = now;
                            break;
                        case 'livrée':
                            if (!order.dateLivraison) order.dateLivraison = now;
                            break;
                    }
                }
            }
            
            if (commentaires !== undefined) {
                order.commentaires = commentaires;
            }
            
            order.lastModifiedBy = req.user._id;
        } else {
            // Users can only cancel their own orders if they're still pending
            if (statut === 'annulée' && order.statut === 'en-attente') {
                order.statut = 'annulée';
                order.addModification('cancel_by_user', 'en-attente', 'annulée', req.user._id);
                
                // Restore product stock
                for (const article of order.articles) {
                    await Product.findByIdAndUpdate(
                        article.productId,
                        { $inc: { stock: article.quantite } }
                    );
                }
            } else if (adresseLivraison && order.statut === 'en-attente') {
                // Allow address update if order is still pending
                order.client.adresse = adresseLivraison.trim();
                order.addModification('address_update', order.client.adresse, adresseLivraison, req.user._id);
            } else {
                return res.status(400).json({ message: 'Modification non autorisée' });
            }
        }
        
        await order.save();
        
        res.json({
            message: 'Commande mise à jour avec succès',
            order
        });
        
        console.log(`Order ${order.numeroCommande} updated by ${req.user.email}`);
        
    } catch (error) {
        console.error('Update order error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// GET /api/orders/user/all - Get all orders for current user
router.get('/user/all', auth, async (req, res) => {
    try {
        const orders = await Order.find({
            $or: [
                { utilisateur: req.user._id },
                { 'client.email': req.user.email }
            ]
        })
        .sort({ dateCommande: -1 })
        .select('numeroCommande statut total dateCommande articles')
        .lean();
        
        res.json({ orders });
        
    } catch (error) {
        console.error('Get user orders error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// GET /api/orders/track/:numeroCommande - Track order by order number (public)
router.get('/track/:numeroCommande', async (req, res) => {
    try {
        const order = await Order.findOne({ 
            numeroCommande: req.params.numeroCommande 
        }).select('numeroCommande statut dateCommande dateConfirmation dateExpedition dateLivraison total trackingNumber');
        
        if (!order) {
            return res.status(404).json({ message: 'Commande non trouvée' });
        }
        
        // Return limited tracking information
        const trackingInfo = {
            numeroCommande: order.numeroCommande,
            statut: order.statut,
            total: order.total,
            dateCommande: order.dateCommande,
            dateConfirmation: order.dateConfirmation,
            dateExpedition: order.dateExpedition,
            dateLivraison: order.dateLivraison,
            trackingNumber: order.trackingNumber,
            timeline: []
        };
        
        // Build timeline
        trackingInfo.timeline.push({
            statut: 'en-attente',
            date: order.dateCommande,
            description: 'Commande reçue et en cours de traitement'
        });
        
        if (order.dateConfirmation) {
            trackingInfo.timeline.push({
                statut: 'confirmée',
                date: order.dateConfirmation,
                description: 'Commande confirmée et en préparation'
            });
        }
        
        if (order.dateExpedition) {
            trackingInfo.timeline.push({
                statut: 'expédiée',
                date: order.dateExpedition,
                description: 'Commande expédiée'
            });
        }
        
        if (order.dateLivraison) {
            trackingInfo.timeline.push({
                statut: 'livrée',
                date: order.dateLivraison,
                description: 'Commande livrée'
            });
        }
        
        res.json(trackingInfo);
        
    } catch (error) {
        console.error('Track order error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// POST /api/orders/:id/cancel - Cancel order
router.post('/:id/cancel', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({ message: 'Commande non trouvée' });
        }
        
        // Check permissions
        const isOwner = order.utilisateur?.toString() === req.user._id.toString() || 
                       order.client.email === req.user.email;
        const isAdmin = req.user.role === 'admin';
        
        if (!isOwner && !isAdmin) {
            return res.status(403).json({ message: 'Accès refusé' });
        }
        
        // Can only cancel if order is not yet shipped
        if (['expédiée', 'livrée'].includes(order.statut)) {
            return res.status(400).json({ message: 'Impossible d\'annuler une commande déjà expédiée' });
        }
        
        if (order.statut === 'annulée') {
            return res.status(400).json({ message: 'Commande déjà annulée' });
        }
        
        // Cancel order
        order.statut = 'annulée';
        order.addModification('cancel', order.statut, 'annulée', req.user._id);
        
        // Restore product stock
        for (const article of order.articles) {
            await Product.findByIdAndUpdate(
                article.productId,
                { $inc: { stock: article.quantite } }
            );
        }
        
        await order.save();
        
        res.json({ message: 'Commande annulée avec succès' });
        
        console.log(`Order ${order.numeroCommande} cancelled by ${req.user.email}`);
        
    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Health check endpoint for orders
router.get('/health/check', (req, res) => {
    res.json({
        status: 'ok',
        service: 'orders',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
