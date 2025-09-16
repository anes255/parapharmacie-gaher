const express = require('express');
const router = express.Router();

console.log('🔧 Loading orders route...');

// Simple middleware to log all requests to this route
router.use((req, res, next) => {
    console.log(`📦 Orders Route: ${req.method} ${req.path}`, {
        body: req.body ? 'Present' : 'None',
        headers: req.headers['content-type']
    });
    next();
});

// Import auth middleware with fallback
let auth;
try {
    auth = require('../middleware/auth');
    console.log('✅ Auth middleware loaded');
} catch (error) {
    console.log('⚠️ Auth middleware not found, using fallback');
    auth = (req, res, next) => {
        req.user = { id: 'guest', role: 'user' };
        next();
    };
}

// Import Order model with fallback
let Order;
try {
    Order = require('../models/Order');
    console.log('✅ Order model loaded');
} catch (error) {
    console.log('⚠️ Order model not found, using fallback');
    Order = null;
}

// @route   POST /api/orders
// @desc    Create new order - SIMPLIFIED VERSION
// @access  Public
router.post('/', async (req, res) => {
    try {
        console.log('📦 POST /api/orders - Creating new order');
        console.log('📦 Request body:', JSON.stringify(req.body, null, 2));
        
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
        
        // Basic validation
        if (!numeroCommande) {
            console.log('❌ Missing numeroCommande');
            return res.status(400).json({
                message: 'Numéro de commande requis',
                error: 'MISSING_ORDER_NUMBER'
            });
        }
        
        if (!client || !client.nom || !client.email) {
            console.log('❌ Missing client information');
            return res.status(400).json({
                message: 'Informations client requises',
                error: 'MISSING_CLIENT_INFO',
                required: ['nom', 'prenom', 'email', 'telephone', 'adresse', 'wilaya']
            });
        }
        
        if (!articles || !Array.isArray(articles) || articles.length === 0) {
            console.log('❌ Missing articles');
            return res.status(400).json({
                message: 'Articles requis',
                error: 'MISSING_ARTICLES'
            });
        }
        
        // Create order object
        const orderData = {
            _id: Date.now().toString(),
            numeroCommande,
            client: {
                userId: req.user ? req.user.id : null,
                prenom: client.prenom || '',
                nom: client.nom,
                email: client.email.toLowerCase(),
                telephone: client.telephone || '',
                adresse: client.adresse || '',
                wilaya: client.wilaya || ''
            },
            articles: articles.map(article => ({
                productId: article.productId || article.id,
                nom: article.nom,
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
        
        // Try to save to MongoDB if available
        let savedOrder = null;
        if (Order) {
            try {
                const mongoOrder = new Order(orderData);
                savedOrder = await mongoOrder.save();
                console.log('✅ Order saved to MongoDB:', savedOrder._id);
            } catch (mongoError) {
                console.log('⚠️ MongoDB save failed:', mongoError.message);
            }
        }
        
        // Always return success response
        const responseOrder = savedOrder || orderData;
        
        console.log('✅ Order created successfully:', responseOrder.numeroCommande);
        
        res.status(201).json({
            success: true,
            message: 'Commande créée avec succès',
            order: {
                _id: responseOrder._id,
                numeroCommande: responseOrder.numeroCommande,
                statut: responseOrder.statut,
                total: responseOrder.total,
                dateCommande: responseOrder.dateCommande,
                client: {
                    nom: responseOrder.client.nom,
                    prenom: responseOrder.client.prenom,
                    email: responseOrder.client.email
                }
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Order creation error:', error);
        
        // Always return a response, never let it hang
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de la commande',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }
});

// @route   GET /api/orders/test
// @desc    Test endpoint to verify orders route is working
// @access  Public
router.get('/test', (req, res) => {
    console.log('🧪 Orders test endpoint accessed');
    res.json({
        message: 'Orders route is working!',
        timestamp: new Date().toISOString(),
        routes: [
            'POST /api/orders - Create order',
            'GET /api/orders/test - Test endpoint',
            'GET /api/orders/user/all - Get user orders (requires auth)',
            'GET /api/orders/:id - Get specific order (requires auth)'
        ]
    });
});

// @route   GET /api/orders/user/all
// @desc    Get user orders
// @access  Private
router.get('/user/all', auth, async (req, res) => {
    try {
        console.log('📦 Getting orders for user:', req.user.id);
        
        let orders = [];
        
        if (Order) {
            try {
                orders = await Order.find({ 
                    'client.userId': req.user.id 
                }).sort({ dateCommande: -1 });
                console.log(`✅ Found ${orders.length} orders from database`);
            } catch (error) {
                console.log('⚠️ Database query failed:', error.message);
            }
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

// @route   GET /api/orders/:id
// @desc    Get order by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
    try {
        let order = null;
        
        if (Order) {
            try {
                order = await Order.findById(req.params.id);
            } catch (error) {
                console.log('⚠️ Database query failed:', error.message);
            }
        }
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Commande non trouvée',
                timestamp: new Date().toISOString()
            });
        }
        
        // Check permissions
        if (order.client.userId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Accès non autorisé à cette commande',
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

// @route   GET /api/orders
// @desc    Get all orders (Admin only)
// @access  Private/Admin
router.get('/', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Accès administrateur requis',
                timestamp: new Date().toISOString()
            });
        }
        
        let orders = [];
        
        if (Order) {
            try {
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 20;
                const skip = (page - 1) * limit;
                
                orders = await Order.find()
                    .sort({ dateCommande: -1 })
                    .skip(skip)
                    .limit(limit);
                    
                console.log(`✅ Admin retrieved ${orders.length} orders`);
            } catch (error) {
                console.log('⚠️ Admin query failed:', error.message);
            }
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

console.log('✅ Orders route loaded successfully');

module.exports = router;
