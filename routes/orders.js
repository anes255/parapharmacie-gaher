const express = require('express');
const Order = require('../models/Order');
const { auth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/orders
// @desc    Get all orders (admin only)
// @access  Private/Admin
router.get('/', auth, async (req, res) => {
    try {
        console.log('📋 Getting all orders for admin');
        
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                message: 'Accès refusé - Droits administrateur requis'
            });
        }
        
        // Get all orders
        const orders = await Order.find()
            .populate('client', 'nom prenom email telephone wilaya adresse')
            .sort({ dateCommande: -1 });
        
        console.log(`✅ Found ${orders.length} orders`);
        
        res.json({
            orders,
            count: orders.length
        });
        
    } catch (error) {
        console.error('❌ Error getting orders:', error);
        res.status(500).json({
            message: 'Erreur serveur lors de la récupération des commandes'
        });
    }
});

// @route   GET /api/orders/:id
// @desc    Get order by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
    try {
        console.log('📋 Getting order:', req.params.id);
        
        const order = await Order.findById(req.params.id)
            .populate('client', 'nom prenom email telephone wilaya adresse');
        
        if (!order) {
            return res.status(404).json({
                message: 'Commande non trouvée'
            });
        }
        
        // Check if user owns the order or is admin
        if (order.client._id.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                message: 'Accès refusé'
            });
        }
        
        res.json(order);
        
    } catch (error) {
        console.error('❌ Error getting order:', error);
        res.status(500).json({
            message: 'Erreur serveur'
        });
    }
});

// @route   POST /api/orders
// @desc    Create new order
// @access  Private
router.post('/', auth, async (req, res) => {
    try {
        console.log('📝 Creating new order for user:', req.user.id);
        
        const {
            articles,
            sousTotal,
            fraisLivraison,
            total,
            commentaires,
            adresseLivraison
        } = req.body;
        
        // Validation
        if (!articles || !Array.isArray(articles) || articles.length === 0) {
            return res.status(400).json({
                message: 'Articles requis'
            });
        }
        
        if (!sousTotal || !total) {
            return res.status(400).json({
                message: 'Montants requis'
            });
        }
        
        // Generate order number
        const numeroCommande = `CMD-${Date.now()}`;
        
        // Create order
        const order = new Order({
            numeroCommande,
            client: req.user.id,
            articles,
            sousTotal,
            fraisLivraison: fraisLivraison || 0,
            total,
            commentaires: commentaires || '',
            adresseLivraison,
            statut: 'en-attente',
            modePaiement: 'Paiement à la livraison',
            dateCommande: new Date()
        });
        
        await order.save();
        
        // Populate client data for response
        await order.populate('client', 'nom prenom email telephone wilaya adresse');
        
        console.log('✅ Order created:', order.numeroCommande);
        
        res.status(201).json({
            message: 'Commande créée avec succès',
            order
        });
        
    } catch (error) {
        console.error('❌ Error creating order:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: messages[0] || 'Données invalides'
            });
        }
        
        res.status(500).json({
            message: 'Erreur serveur lors de la création de la commande'
        });
    }
});

// @route   PUT /api/orders/:id
// @desc    Update order status
// @access  Private/Admin
router.put('/:id', auth, async (req, res) => {
    try {
        console.log('📝 Updating order:', req.params.id);
        
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                message: 'Accès refusé - Droits administrateur requis'
            });
        }
        
        const { statut, commentairesAdmin } = req.body;
        
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({
                message: 'Commande non trouvée'
            });
        }
        
        // Update order
        if (statut) order.statut = statut;
        if (commentairesAdmin) order.commentairesAdmin = commentairesAdmin;
        
        // Set delivery date if status is "livrée"
        if (statut === 'livrée') {
            order.dateLivraison = new Date();
        }
        
        await order.save();
        
        console.log('✅ Order updated:', order.numeroCommande);
        
        res.json({
            message: 'Commande mise à jour avec succès',
            order
        });
        
    } catch (error) {
        console.error('❌ Error updating order:', error);
        res.status(500).json({
            message: 'Erreur serveur lors de la mise à jour'
        });
    }
});

// @route   DELETE /api/orders/:id
// @desc    Delete order
// @access  Private/Admin
router.delete('/:id', auth, async (req, res) => {
    try {
        console.log('🗑️ Deleting order:', req.params.id);
        
        // Check if user is admin
        if (req.user.role !== 'admin') {
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
        
        await Order.findByIdAndDelete(req.params.id);
        
        console.log('✅ Order deleted:', order.numeroCommande);
        
        res.json({
            message: 'Commande supprimée avec succès'
        });
        
    } catch (error) {
        console.error('❌ Error deleting order:', error);
        res.status(500).json({
            message: 'Erreur serveur lors de la suppression'
        });
    }
});

// @route   GET /api/orders/user/:userId
// @desc    Get orders for specific user
// @access  Private
router.get('/user/:userId', auth, async (req, res) => {
    try {
        console.log('📋 Getting orders for user:', req.params.userId);
        
        // Check if user is requesting their own orders or is admin
        if (req.params.userId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                message: 'Accès refusé'
            });
        }
        
        const orders = await Order.find({ client: req.params.userId })
            .populate('client', 'nom prenom email')
            .sort({ dateCommande: -1 });
        
        res.json({
            orders,
            count: orders.length
        });
        
    } catch (error) {
        console.error('❌ Error getting user orders:', error);
        res.status(500).json({
            message: 'Erreur serveur'
        });
    }
});

// @route   GET /api/orders/stats/dashboard
// @desc    Get order statistics for admin dashboard
// @access  Private/Admin
router.get('/stats/dashboard', auth, requireAdmin, async (req, res) => {
    try {
        console.log('📊 Getting order statistics');
        
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        
        // Get basic stats
        const totalOrders = await Order.countDocuments();
        const pendingOrders = await Order.countDocuments({ statut: 'en-attente' });
        const confirmedOrders = await Order.countDocuments({ statut: 'confirmée' });
        const deliveredOrders = await Order.countDocuments({ statut: 'livrée' });
        
        // Get monthly revenue
        const monthlyOrdersAgg = await Order.aggregate([
            {
                $match: {
                    dateCommande: { $gte: startOfMonth },
                    statut: { $nin: ['annulée'] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$total' },
                    orderCount: { $sum: 1 }
                }
            }
        ]);
        
        const monthlyRevenue = monthlyOrdersAgg.length > 0 ? monthlyOrdersAgg[0].totalRevenue : 0;
        const monthlyOrderCount = monthlyOrdersAgg.length > 0 ? monthlyOrdersAgg[0].orderCount : 0;
        
        // Get recent orders
        const recentOrders = await Order.find()
            .populate('client', 'nom prenom email')
            .sort({ dateCommande: -1 })
            .limit(5);
        
        res.json({
            stats: {
                totalOrders,
                pendingOrders,
                confirmedOrders,
                deliveredOrders,
                monthlyRevenue,
                monthlyOrderCount
            },
            recentOrders
        });
        
    } catch (error) {
        console.error('❌ Error getting order statistics:', error);
        res.status(500).json({
            message: 'Erreur serveur lors de la récupération des statistiques'
        });
    }
});

// @route   POST /api/orders/bulk-update
// @desc    Bulk update orders status
// @access  Private/Admin
router.post('/bulk-update', auth, requireAdmin, async (req, res) => {
    try {
        console.log('📝 Bulk updating orders');
        
        const { orderIds, newStatus } = req.body;
        
        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({
                message: 'IDs de commandes requis'
            });
        }
        
        if (!newStatus) {
            return res.status(400).json({
                message: 'Nouveau statut requis'
            });
        }
        
        const updateData = { statut: newStatus };
        if (newStatus === 'livrée') {
            updateData.dateLivraison = new Date();
        }
        
        const result = await Order.updateMany(
            { _id: { $in: orderIds } },
            updateData
        );
        
        console.log(`✅ Updated ${result.modifiedCount} orders`);
        
        res.json({
            message: `${result.modifiedCount} commandes mises à jour`,
            modifiedCount: result.modifiedCount
        });
        
    } catch (error) {
        console.error('❌ Error bulk updating orders:', error);
        res.status(500).json({
            message: 'Erreur serveur lors de la mise à jour en lot'
        });
    }
});

// @route   GET /api/orders/export/csv
// @desc    Export orders to CSV
// @access  Private/Admin
router.get('/export/csv', auth, requireAdmin, async (req, res) => {
    try {
        console.log('📤 Exporting orders to CSV');
        
        const { startDate, endDate, status } = req.query;
        
        let query = {};
        
        if (startDate && endDate) {
            query.dateCommande = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        if (status && status !== 'all') {
            query.statut = status;
        }
        
        const orders = await Order.find(query)
            .populate('client', 'nom prenom email telephone wilaya')
            .sort({ dateCommande: -1 });
        
        // Create CSV content
        const csvHeaders = [
            'Numéro Commande',
            'Date',
            'Client',
            'Email',
            'Téléphone',
            'Wilaya',
            'Statut',
            'Articles',
            'Sous-total',
            'Frais Livraison',
            'Total'
        ];
        
        const csvRows = orders.map(order => [
            order.numeroCommande,
            order.dateCommande.toISOString().split('T')[0],
            `${order.client.prenom} ${order.client.nom}`,
            order.client.email,
            order.client.telephone,
            order.client.wilaya,
            order.statut,
            order.articles.length,
            order.sousTotal,
            order.fraisLivraison,
            order.total
        ]);
        
        const csvContent = [
            csvHeaders.join(','),
            ...csvRows.map(row => row.join(','))
        ].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=commandes.csv');
        res.send(csvContent);
        
    } catch (error) {
        console.error('❌ Error exporting orders:', error);
        res.status(500).json({
            message: 'Erreur serveur lors de l\'export'
        });
    }
});

module.exports = router;
