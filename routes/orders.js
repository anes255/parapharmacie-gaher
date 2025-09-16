const express = require('express');
const router = express.Router();

// Immediately log that this file is being loaded
console.log('🔥 ORDERS ROUTE FILE IS LOADING...');

// Test route - MUST work
router.get('/test', (req, res) => {
    console.log('🧪 Orders test route accessed successfully!');
    res.json({
        success: true,
        message: 'Orders route is working perfectly!',
        timestamp: new Date().toISOString(),
        routes: [
            'GET /api/orders/test - This endpoint',
            'POST /api/orders - Create order',
            'GET /api/orders/user/all - Get user orders',
            'GET /api/orders/:id - Get specific order'
        ]
    });
});

// Simple auth middleware fallback
const simpleAuth = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (token) {
        // In a real app, verify the token here
        req.user = { id: 'user123', role: 'user' };
    } else {
        req.user = { id: 'guest', role: 'guest' };
    }
    next();
};

// Load auth middleware with fallback
let auth;
try {
    auth = require('../middleware/auth');
    console.log('✅ Auth middleware loaded successfully');
} catch (error) {
    console.log('⚠️ Using simple auth fallback');
    auth = simpleAuth;
}

// Load Order model with fallback
let Order;
try {
    Order = require('../models/Order');
    console.log('✅ Order model loaded successfully');
} catch (error) {
    console.log('⚠️ Order model not available, using memory storage');
    Order = null;
}

// In-memory storage as fallback
let memoryOrders = [];

// CREATE ORDER - Main route
router.post('/', async (req, res) => {
    console.log('📦 POST /api/orders - Order creation started');
    console.log('📦 Request body received:', !!req.body);
    
    try {
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

        // Validate required fields
        if (!numeroCommande || !client || !articles) {
            console.log('❌ Validation failed - missing required fields');
            return res.status(400).json({
                success: false,
                message: 'Données manquantes',
                required: ['numeroCommande', 'client', 'articles'],
                received: {
                    numeroCommande: !!numeroCommande,
                    client: !!client,
                    articles: !!articles
                }
            });
        }

        if (!client.nom || !client.email) {
            console.log('❌ Client validation failed');
            return res.status(400).json({
                success: false,
                message: 'Informations client incomplètes',
                required: ['nom', 'email'],
                received: {
                    nom: !!client.nom,
                    email: !!client.email
                }
            });
        }

        if (!Array.isArray(articles) || articles.length === 0) {
            console.log('❌ Articles validation failed');
            return res.status(400).json({
                success: false,
                message: 'Articles requis',
                received: typeof articles,
                length: articles ? articles.length : 0
            });
        }

        // Create order object
        const orderData = {
            _id: `order_${Date.now()}`,
            numeroCommande: numeroCommande,
            client: {
                userId: req.user ? req.user.id : null,
                prenom: client.prenom || '',
                nom: client.nom,
                email: client.email.toLowerCase(),
                telephone: client.telephone || '',
                adresse: client.adresse || '',
                wilaya: client.wilaya || ''
            },
            articles: articles.map((article, index) => ({
                productId: article.productId || article.id || `item_${index}`,
                nom: article.nom || 'Article sans nom',
                prix: parseFloat(article.prix) || 0,
                quantite: parseInt(article.quantite) || 1,
                image: article.image || ''
            })),
            sousTotal: parseFloat(sousTotal) || 0,
            fraisLivraison: parseFloat(fraisLivraison) || 0,
            total: parseFloat(total) || 0,
            statut: 'en-attente',
            modePaiement: modePaiement || 'Paiement à la livraison',
            commentaires: commentaires || '',
            dateCommande: new Date().toISOString()
        };

        console.log('📦 Order data prepared:', {
            id: orderData._id,
            numero: orderData.numeroCommande,
            total: orderData.total,
            articlesCount: orderData.articles.length
        });

        let savedToDatabase = false;

        // Try to save to MongoDB if available
        if (Order) {
            try {
                const mongoOrder = new Order(orderData);
                await mongoOrder.save();
                console.log('✅ Order saved to MongoDB');
                savedToDatabase = true;
            } catch (mongoError) {
                console.log('⚠️ MongoDB save failed:', mongoError.message);
            }
        }

        // Always save to memory as backup
        memoryOrders.unshift(orderData);
        if (memoryOrders.length > 100) {
            memoryOrders = memoryOrders.slice(0, 100); // Keep only last 100
        }
        console.log('✅ Order saved to memory');

        // Success response
        const response = {
            success: true,
            message: 'Commande créée avec succès',
            order: {
                _id: orderData._id,
                numeroCommande: orderData.numeroCommande,
                statut: orderData.statut,
                total: orderData.total,
                dateCommande: orderData.dateCommande
            },
            savedToDatabase,
            timestamp: new Date().toISOString()
        };

        console.log('✅ Order created successfully:', orderData.numeroCommande);
        res.status(201).json(response);

    } catch (error) {
        console.error('❌ Order creation error:', error);
        
        // Always respond, never hang
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de la commande',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// GET USER ORDERS
router.get('/user/all', auth, async (req, res) => {
    console.log('📦 GET user orders for:', req.user?.id);
    
    try {
        let orders = [];

        // Try database first
        if (Order && req.user?.id && req.user.id !== 'guest') {
            try {
                orders = await Order.find({ 
                    'client.userId': req.user.id 
                }).sort({ dateCommande: -1 });
                console.log(`✅ Found ${orders.length} orders in database`);
            } catch (error) {
                console.log('⚠️ Database query failed:', error.message);
            }
        }

        // Fallback to memory
        if (orders.length === 0) {
            orders = memoryOrders.filter(order => 
                order.client.userId === req.user?.id
            );
            console.log(`✅ Found ${orders.length} orders in memory`);
        }

        res.json({
            success: true,
            orders,
            count: orders.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Get user orders error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des commandes',
            orders: [],
            timestamp: new Date().toISOString()
        });
    }
});

// GET SPECIFIC ORDER
router.get('/:id', auth, async (req, res) => {
    console.log('📦 GET order:', req.params.id);
    
    try {
        let order = null;

        // Try database first
        if (Order) {
            try {
                order = await Order.findById(req.params.id);
            } catch (error) {
                console.log('⚠️ Database query failed:', error.message);
            }
        }

        // Fallback to memory
        if (!order) {
            order = memoryOrders.find(o => o._id === req.params.id);
        }

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Commande non trouvée',
                timestamp: new Date().toISOString()
            });
        }

        // Check permissions
        if (order.client.userId !== req.user?.id && req.user?.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Accès non autorisé',
                timestamp: new Date().toISOString()
            });
        }

        res.json({
            success: true,
            order,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Get order error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération de la commande',
            timestamp: new Date().toISOString()
        });
    }
});

// ADMIN - GET ALL ORDERS
router.get('/', auth, async (req, res) => {
    console.log('📦 Admin getting all orders');
    
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Accès administrateur requis',
                timestamp: new Date().toISOString()
            });
        }

        let orders = [];

        // Try database first
        if (Order) {
            try {
                orders = await Order.find().sort({ dateCommande: -1 }).limit(50);
                console.log(`✅ Found ${orders.length} orders in database`);
            } catch (error) {
                console.log('⚠️ Database query failed:', error.message);
            }
        }

        // Fallback to memory
        if (orders.length === 0) {
            orders = memoryOrders.slice(0, 50);
            console.log(`✅ Using ${orders.length} orders from memory`);
        }

        res.json({
            success: true,
            orders,
            count: orders.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Admin get orders error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des commandes',
            orders: [],
            timestamp: new Date().toISOString()
        });
    }
});

// HEALTH CHECK
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Orders route is healthy',
        timestamp: new Date().toISOString(),
        orderModelAvailable: !!Order,
        memoryOrdersCount: memoryOrders.length
    });
});

console.log('✅ ORDERS ROUTE LOADED COMPLETELY');

module.exports = router;
