const express = require('express');
const auth = require('../middleware/auth');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');

const router = express.Router();

// Middleware to check admin role
const adminAuth = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Accès administrateur requis' });
    }
    next();
};

// Dashboard statistics
router.get('/dashboard', auth, adminAuth, async (req, res) => {
    try {
        console.log('Admin dashboard request from:', req.user.email);
        
        const [totalProducts, totalOrders, totalUsers] = await Promise.all([
            Product.countDocuments({ actif: true }),
            Order.countDocuments(),
            User.countDocuments()
        ]);
        
        // Get pending orders
        const pendingOrders = await Order.countDocuments({ statut: 'en-attente' });
        
        // Calculate monthly revenue
        const currentMonth = new Date();
        currentMonth.setDate(1);
        currentMonth.setHours(0, 0, 0, 0);
        
        const monthlyOrders = await Order.find({
            dateCommande: { $gte: currentMonth },
            statut: { $ne: 'annulée' }
        });
        
        const monthlyRevenue = monthlyOrders.reduce((sum, order) => sum + (order.total || 0), 0);
        
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
router.get('/products', auth, adminAuth, async (req, res) => {
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
router.post('/products', auth, adminAuth, async (req, res) => {
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
router.put('/products/:id', auth, adminAuth, async (req, res) => {
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
router.delete('/products/:id', auth, adminAuth, async (req, res) => {
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
router.get('/orders', auth, adminAuth, async (req, res) => {
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
        
        // Date range filter
        if (req.query.dateFrom || req.query.dateTo) {
            query.dateCommande = {};
            if (req.query.dateFrom) {
                query.dateCommande.$gte = new Date(req.query.dateFrom);
            }
            if (req.query.dateTo) {
                query.dateCommande.$lte = new Date(req.query.dateTo);
            }
        }
        
        const orders = await Order.find(query)
            .populate('client', 'nom prenom email telephone')
            .sort({ dateCommande: -1 })
            .skip(skip)
            .limit(limit);
            
        const total = await Order.countDocuments(query);
        
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
router.put('/orders/:id/status', auth, adminAuth, async (req, res) => {
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
        
        const order = await Order.findById(req.params.id);
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
router.get('/orders/:id', auth, adminAuth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('client', 'nom prenom email telephone adresse wilaya');
            
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
router.delete('/orders/:id', auth, adminAuth, async (req, res) => {
    try {
        console.log('Deleting order:', req.params.id);
        
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Commande non trouvée' });
        }
        
        await Order.findByIdAndDelete(req.params.id);
        
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

// Get all users (admin only)
router.get('/users', auth, adminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        const users = await User.find()
            .select('-password')
            .sort({ dateInscription: -1 })
            .skip(skip)
            .limit(limit);
            
        const total = await User.countDocuments();
        
        res.json({
            success: true,
            users,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalUsers: total,
                hasNextPage: page < Math.ceil(total / limit),
                hasPrevPage: page > 1
            }
        });
        
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Update user role (admin only)
router.put('/users/:id/role', auth, adminAuth, async (req, res) => {
    try {
        const { role } = req.body;
        
        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({ message: 'Rôle invalide' });
        }
        
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        
        user.role = role;
        await user.save();
        
        res.json({
            success: true,
            message: 'Rôle utilisateur mis à jour avec succès'
        });
        
    } catch (error) {
        console.error('Update user role error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Bulk operations
router.post('/products/bulk-update', auth, adminAuth, async (req, res) => {
    try {
        const { productIds, updates } = req.body;
        
        if (!productIds || !Array.isArray(productIds) || !updates) {
            return res.status(400).json({ message: 'Données invalides' });
        }
        
        const result = await Product.updateMany(
            { _id: { $in: productIds } },
            { $set: updates }
        );
        
        res.json({
            success: true,
            message: `${result.modifiedCount} produits mis à jour`,
            modifiedCount: result.modifiedCount
        });
        
    } catch (error) {
        console.error('Bulk update error:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour en lot' });
    }
});

router.delete('/products/bulk-delete', auth, adminAuth, async (req, res) => {
    try {
        const { productIds } = req.body;
        
        if (!productIds || !Array.isArray(productIds)) {
            return res.status(400).json({ message: 'IDs de produits requis' });
        }
        
        const result = await Product.deleteMany({ _id: { $in: productIds } });
        
        res.json({
            success: true,
            message: `${result.deletedCount} produits supprimés`,
            deletedCount: result.deletedCount
        });
        
    } catch (error) {
        console.error('Bulk delete error:', error);
        res.status(500).json({ message: 'Erreur lors de la suppression en lot' });
    }
});

// Export/Import functions
router.get('/export/products', auth, adminAuth, async (req, res) => {
    try {
        const products = await Product.find();
        
        res.json({
            success: true,
            products,
            exportDate: new Date().toISOString(),
            count: products.length
        });
        
    } catch (error) {
        console.error('Export products error:', error);
        res.status(500).json({ message: 'Erreur lors de l\'export' });
    }
});

router.post('/import/products', auth, adminAuth, async (req, res) => {
    try {
        const { products } = req.body;
        
        if (!products || !Array.isArray(products)) {
            return res.status(400).json({ message: 'Format de données invalide' });
        }
        
        let importedCount = 0;
        let errors = [];
        
        for (const productData of products) {
            try {
                const product = new Product(productData);
                await product.save();
                importedCount++;
            } catch (error) {
                errors.push(`Erreur pour ${productData.nom}: ${error.message}`);
            }
        }
        
        res.json({
            success: true,
            message: `${importedCount}/${products.length} produits importés`,
            importedCount,
            errors: errors.slice(0, 10) // Limit error messages
        });
        
    } catch (error) {
        console.error('Import products error:', error);
        res.status(500).json({ message: 'Erreur lors de l\'import' });
    }
});

module.exports = router;
