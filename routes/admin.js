const express = require('express');
const Product = require('../models/Product');
const Order = require('../models/Order'); 
const User = require('../models/User');

const router = express.Router();

// Simple auth middleware - no token required for now
const simpleAuth = (req, res, next) => {
    // For now, just pass through - you can add proper auth later
    req.user = { role: 'admin', email: 'admin@test.com' };
    next();
};

// Admin role check
const adminAuth = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Accès administrateur requis' });
    }
};

// Dashboard statistics - THIS WAS MISSING!
router.get('/dashboard', simpleAuth, adminAuth, async (req, res) => {
    try {
        console.log('Admin dashboard request');
        
        // Get basic stats - with fallbacks if models don't exist
        let totalProducts = 0;
        let totalOrders = 0;
        let pendingOrders = 0;
        let totalUsers = 1;
        let monthlyRevenue = 0;
        
        try {
            totalProducts = await Product.countDocuments({ actif: true });
        } catch (e) {
            console.log('Product model not available');
        }
        
        try {
            totalOrders = await Order.countDocuments();
            pendingOrders = await Order.countDocuments({ statut: 'en-attente' });
            
            // Calculate monthly revenue
            const currentMonth = new Date();
            currentMonth.setDate(1);
            currentMonth.setHours(0, 0, 0, 0);
            
            const monthlyOrders = await Order.find({
                dateCommande: { $gte: currentMonth },
                statut: { $ne: 'annulée' }
            });
            
            monthlyRevenue = monthlyOrders.reduce((sum, order) => sum + (order.total || 0), 0);
        } catch (e) {
            console.log('Order model not available');
        }
        
        try {
            totalUsers = await User.countDocuments();
        } catch (e) {
            console.log('User model not available');
        }
        
        const stats = {
            totalProducts,
            totalOrders,
            pendingOrders,
            totalUsers,
            monthlyRevenue
        };
        
        console.log('Dashboard stats:', stats);
        
        res.json({
            success: true,
            stats
        });
        
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Get all products for admin
router.get('/products', simpleAuth, adminAuth, async (req, res) => {
    try {
        console.log('Admin products request');
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        
        const products = await Product.find()
            .sort({ dateAjout: -1 })
            .skip(skip)
            .limit(limit);
            
        const total = await Product.countDocuments();
        
        console.log(`Returning ${products.length} products for admin`);
        
        res.json({
            success: true,
            products,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalProducts: total,
                hasNextPage: page < Math.ceil(total / limit),
                hasPrevPage: page > 1
            }
        });
        
    } catch (error) {
        console.error('Admin products error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Create new product
router.post('/products', simpleAuth, adminAuth, async (req, res) => {
    try {
        console.log('Creating new product:', req.body.nom);
        
        const {
            nom,
            description,
            prix,
            prixOriginal,
            categorie,
            sousCategorie,
            image,
            stock,
            enPromotion,
            pourcentagePromotion,
            marque,
            ingredients,
            modeEmploi,
            precautions,
            enVedette,
            actif
        } = req.body;
        
        // Validation
        if (!nom || !description || !prix || !categorie || stock === undefined) {
            return res.status(400).json({ 
                message: 'Champs obligatoires manquants' 
            });
        }
        
        // Create product
        const product = new Product({
            nom: nom.trim(),
            description: description.trim(),
            prix: Number(prix),
            prixOriginal: prixOriginal ? Number(prixOriginal) : null,
            categorie,
            sousCategorie: sousCategorie || '',
            image: image || '',
            stock: Number(stock),
            enPromotion: Boolean(enPromotion),
            pourcentagePromotion: pourcentagePromotion ? Number(pourcentagePromotion) : 0,
            marque: marque || '',
            ingredients: ingredients || '',
            modeEmploi: modeEmploi || '',
            precautions: precautions || '',
            enVedette: Boolean(enVedette),
            actif: actif !== false // Default to true
        });
        
        const savedProduct = await product.save();
        
        console.log('Product created successfully:', savedProduct._id);
        
        res.status(201).json({
            success: true,
            product: savedProduct,
            message: 'Produit créé avec succès'
        });
        
    } catch (error) {
        console.error('Create product error:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Ce produit existe déjà' });
        }
        
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: errors.join(', ') });
        }
        
        res.status(500).json({ message: 'Erreur lors de la création du produit' });
    }
});

// Update product
router.put('/products/:id', simpleAuth, adminAuth, async (req, res) => {
    try {
        console.log('Updating product:', req.params.id);
        
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Produit non trouvé' });
        }
        
        // Update fields
        const allowedUpdates = [
            'nom', 'description', 'prix', 'prixOriginal', 'categorie', 'sousCategorie',
            'image', 'stock', 'enPromotion', 'pourcentagePromotion', 'marque',
            'ingredients', 'modeEmploi', 'precautions', 'enVedette', 'actif'
        ];
        
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                product[field] = req.body[field];
            }
        });
        
        const updatedProduct = await product.save();
        
        console.log('Product updated successfully:', updatedProduct._id);
        
        res.json({
            success: true,
            product: updatedProduct,
            message: 'Produit mis à jour avec succès'
        });
        
    } catch (error) {
        console.error('Update product error:', error);
        
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: errors.join(', ') });
        }
        
        res.status(500).json({ message: 'Erreur lors de la mise à jour du produit' });
    }
});

// Delete product
router.delete('/products/:id', simpleAuth, adminAuth, async (req, res) => {
    try {
        console.log('Deleting product:', req.params.id);
        
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Produit non trouvé' });
        }
        
        await Product.findByIdAndDelete(req.params.id);
        
        console.log('Product deleted successfully:', req.params.id);
        
        res.json({
            success: true,
            message: 'Produit supprimé avec succès'
        });
        
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ message: 'Erreur lors de la suppression du produit' });
    }
});

// Get all orders for admin
router.get('/orders', simpleAuth, adminAuth, async (req, res) => {
    try {
        console.log('Admin orders request');
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        
        let query = {};
        
        // Status filter
        if (req.query.statut) {
            query.statut = req.query.statut;
        }
        
        // Try to get orders, with fallback if Order model doesn't exist
        let orders = [];
        let total = 0;
        
        try {
            orders = await Order.find(query)
                .sort({ dateCommande: -1 })
                .skip(skip)
                .limit(limit);
                
            total = await Order.countDocuments(query);
        } catch (e) {
            console.log('Order model not available, returning empty array');
        }
        
        console.log(`Returning ${orders.length} orders for admin`);
        
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
        console.error('Admin orders error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Update order status
router.put('/orders/:id', simpleAuth, adminAuth, async (req, res) => {
    try {
        console.log('Updating order status:', req.params.id, 'to', req.body.statut);
        
        const { statut } = req.body;
        
        if (!statut) {
            return res.status(400).json({ message: 'Statut requis' });
        }
        
        const validStatuses = ['en-attente', 'confirmée', 'préparée', 'expédiée', 'livrée', 'annulée'];
        if (!validStatuses.includes(statut)) {
            return res.status(400).json({ message: 'Statut invalide' });
        }
        
        let order;
        
        try {
            // Try to find by MongoDB ID first, then by order number
            if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
                order = await Order.findById(req.params.id);
            } else {
                order = await Order.findOne({ numeroCommande: req.params.id });
            }
        } catch (e) {
            return res.status(404).json({ message: 'Order model not available' });
        }
        
        if (!order) {
            return res.status(404).json({ message: 'Commande non trouvée' });
        }
        
        order.statut = statut;
        
        // Set delivery date if status is 'livrée'
        if (statut === 'livrée') {
            order.dateLivraison = new Date();
        }
        
        const updatedOrder = await order.save();
        
        console.log('Order status updated successfully');
        
        res.json({
            success: true,
            order: updatedOrder,
            message: 'Statut de commande mis à jour avec succès'
        });
        
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour du statut' });
    }
});

// Get single order details
router.get('/orders/:id', simpleAuth, adminAuth, async (req, res) => {
    try {
        let order;
        
        try {
            // Try to find by MongoDB ID first, then by order number
            if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
                order = await Order.findById(req.params.id);
            } else {
                order = await Order.findOne({ numeroCommande: req.params.id });
            }
        } catch (e) {
            return res.status(404).json({ message: 'Order model not available' });
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

// Delete order (admin only)
router.delete('/orders/:id', simpleAuth, adminAuth, async (req, res) => {
    try {
        console.log('Deleting order:', req.params.id);
        
        let order;
        
        try {
            // Try to find by MongoDB ID first, then by order number
            if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
                order = await Order.findById(req.params.id);
            } else {
                order = await Order.findOne({ numeroCommande: req.params.id });
            }
        } catch (e) {
            return res.status(404).json({ message: 'Order model not available' });
        }
        
        if (!order) {
            return res.status(404).json({ message: 'Commande non trouvée' });
        }
        
        // Delete the order
        if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
            await Order.findByIdAndDelete(req.params.id);
        } else {
            await Order.findOneAndDelete({ numeroCommande: req.params.id });
        }
        
        console.log('Order deleted successfully');
        
        res.json({
            success: true,
            message: 'Commande supprimée avec succès'
        });
        
    } catch (error) {
        console.error('Delete order error:', error);
        res.status(500).json({ message: 'Erreur lors de la suppression de la commande' });
    }
});

// Test route to see if admin routes are working
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Admin routes are working!',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
