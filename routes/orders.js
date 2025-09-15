const express = require('express');
const router = express.Router();

// Simple Order storage (in-memory for now - will work immediately)
let orders = [];

// Helper function to generate order ID
function generateOrderId() {
    return 'order_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Create new order (PUBLIC - no auth required for checkout)
router.post('/', async (req, res) => {
    try {
        console.log('📦 Creating new order:', req.body.numeroCommande);
        
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
                success: false,
                message: 'Données de commande incomplètes' 
            });
        }
        
        // Validate client data
        if (!client.prenom || !client.nom || !client.email || !client.telephone || !client.adresse || !client.wilaya) {
            return res.status(400).json({ 
                success: false,
                message: 'Informations client incomplètes' 
            });
        }
        
        // Check if order already exists
        const existingOrder = orders.find(o => o.numeroCommande === numeroCommande);
        if (existingOrder) {
            console.log('⚠️ Order already exists:', numeroCommande);
            return res.status(400).json({ 
                success: false,
                message: 'Cette commande existe déjà' 
            });
        }
        
        // Create order object
        const newOrder = {
            _id: generateOrderId(),
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
            commentaires: commentaires?.trim() || '',
            dateCreated: new Date()
        };
        
        // Save order to memory
        orders.unshift(newOrder); // Add to beginning for newest first
        
        console.log('✅ Order created successfully:', newOrder._id);
        console.log('📊 Total orders in memory:', orders.length);
        
        res.status(201).json({
            success: true,
            order: newOrder,
            message: 'Commande créée avec succès'
        });
        
    } catch (error) {
        console.error('❌ Create order error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erreur lors de la création de la commande' 
        });
    }
});

// Get all orders (for admin)
router.get('/', async (req, res) => {
    try {
        console.log('📋 Getting all orders - Total:', orders.length);
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        
        // Sort by date, newest first
        const sortedOrders = [...orders].sort((a, b) => new Date(b.dateCommande) - new Date(a.dateCommande));
        
        // Apply pagination
        const paginatedOrders = sortedOrders.slice(skip, skip + limit);
        
        console.log(`📄 Returning ${paginatedOrders.length} orders for page ${page}`);
        
        res.json({
            success: true,
            orders: paginatedOrders,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(orders.length / limit),
                totalOrders: orders.length,
                hasNextPage: skip + limit < orders.length,
                hasPrevPage: page > 1
            }
        });
        
    } catch (error) {
        console.error('❌ Get orders error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erreur serveur' 
        });
    }
});

// Get single order by ID or order number
router.get('/:id', async (req, res) => {
    try {
        console.log('🔍 Getting order:', req.params.id);
        
        let order;
        
        // Try to find by order number first, then by ID
        order = orders.find(o => o.numeroCommande === req.params.id || o._id === req.params.id);
        
        if (!order) {
            return res.status(404).json({ 
                success: false,
                message: 'Commande non trouvée' 
            });
        }
        
        console.log('✅ Order found:', order.numeroCommande);
        
        res.json({
            success: true,
            order
        });
        
    } catch (error) {
        console.error('❌ Get order error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erreur serveur' 
        });
    }
});

// Update order status
router.put('/:id', async (req, res) => {
    try {
        console.log('📝 Updating order:', req.params.id, 'with:', req.body);
        
        let order = orders.find(o => o.numeroCommande === req.params.id || o._id === req.params.id);
        
        if (!order) {
            return res.status(404).json({ 
                success: false,
                message: 'Commande non trouvée' 
            });
        }
        
        // Update allowed fields
        if (req.body.statut) {
            order.statut = req.body.statut;
            
            // Update status dates
            const now = new Date();
            if (req.body.statut === 'confirmée' && !order.dateConfirmation) {
                order.dateConfirmation = now;
            } else if (req.body.statut === 'expédiée' && !order.dateExpedition) {
                order.dateExpedition = now;
            } else if (req.body.statut === 'livrée') {
                order.dateLivraison = req.body.dateLivraison ? new Date(req.body.dateLivraison) : now;
            }
        }
        
        if (req.body.noteInterne !== undefined) {
            order.noteInterne = req.body.noteInterne;
        }
        
        console.log('✅ Order updated successfully');
        
        res.json({
            success: true,
            order,
            message: 'Commande mise à jour avec succès'
        });
        
    } catch (error) {
        console.error('❌ Update order error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erreur lors de la mise à jour de la commande' 
        });
    }
});

// Delete order (admin only)
router.delete('/:id', async (req, res) => {
    try {
        console.log('🗑️ Deleting order:', req.params.id);
        
        const orderIndex = orders.findIndex(o => o.numeroCommande === req.params.id || o._id === req.params.id);
        
        if (orderIndex === -1) {
            return res.status(404).json({ 
                success: false,
                message: 'Commande non trouvée' 
            });
        }
        
        const deletedOrder = orders[orderIndex];
        orders.splice(orderIndex, 1);
        
        console.log('✅ Order deleted successfully:', deletedOrder.numeroCommande);
        console.log('📊 Remaining orders:', orders.length);
        
        res.json({
            success: true,
            message: 'Commande supprimée avec succès'
        });
        
    } catch (error) {
        console.error('❌ Delete order error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erreur lors de la suppression de la commande' 
        });
    }
});

// Get order statistics
router.get('/stats/all', async (req, res) => {
    try {
        const totalOrders = orders.length;
        const pendingOrders = orders.filter(o => o.statut === 'en-attente').length;
        const confirmedOrders = orders.filter(o => o.statut === 'confirmée').length;
        const deliveredOrders = orders.filter(o => o.statut === 'livrée').length;
        const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
        
        res.json({
            success: true,
            stats: {
                totalOrders,
                pendingOrders,
                confirmedOrders,
                deliveredOrders,
                totalRevenue
            }
        });
        
    } catch (error) {
        console.error('❌ Get stats error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erreur serveur' 
        });
    }
});

// Debug endpoint to see all orders
router.get('/debug/all', (req, res) => {
    res.json({
        success: true,
        message: 'Debug endpoint',
        totalOrders: orders.length,
        orders: orders.map(o => ({
            id: o._id,
            numeroCommande: o.numeroCommande,
            client: o.client.email,
            total: o.total,
            statut: o.statut,
            dateCommande: o.dateCommande
        }))
    });
});

module.exports = router;
