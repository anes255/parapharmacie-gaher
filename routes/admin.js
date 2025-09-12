const express = require('express');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Middleware to check admin role
const adminAuth = async (req, res, next) => {
    try {
        // First check if user is authenticated
        const token = req.header('x-auth-token');
        if (!token) {
            return res.status(401).json({ message: 'Token manquant' });
        }
        
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ message: 'Utilisateur non trouvé' });
        }
        
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Accès administrateur requis' });
        }
        
        req.user = user;
        next();
    } catch (error) {
        console.error('Admin auth error:', error);
        return res.status(401).json({ message: 'Token invalide' });
    }
};

// GET /api/admin/dashboard - Dashboard statistics
router.get('/dashboard', adminAuth, async (req, res) => {
    try {
        const totalProducts = await Product.countDocuments();
        const activeProducts = await Product.countDocuments({ actif: true });
        const totalOrders = await Order.countDocuments();
        const pendingOrders = await Order.countDocuments({ statut: 'en-attente' });
        const totalUsers = await User.countDocuments();
        
        // Calculate monthly revenue
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthlyOrders = await Order.find({
            dateCommande: { $gte: startOfMonth },
            statut: { $nin: ['annulée'] }
        });
        const monthlyRevenue = monthlyOrders.reduce((sum, order) => sum + (order.total || 0), 0);
        
        const stats = {
            totalProducts,
            activeProducts,
            totalOrders,
            pendingOrders,
            totalUsers,
            monthlyRevenue
        };
        
        res.json({ stats });
        
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// GET /api/admin/products - Get all products for admin
router.get('/products', adminAuth, async (req, res) => {
    try {
        const products = await Product.find({})
            .sort({ dateAjout: -1 });
        
        res.json({ products });
        
    } catch (error) {
        console.error('Admin products error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// POST /api/admin/products - Create new product
router.post('/products', adminAuth, async (req, res) => {
    try {
        console.log('Creating new product:', req.body);
        
        const {
            nom,
            description,
            prix,
            prixOriginal,
            categorie,
            stock,
            marque,
            image,
            ingredients,
            modeEmploi,
            precautions,
            enVedette,
            enPromotion,
            actif
        } = req.body;
        
        // Validation
        if (!nom || !description || !prix || !categorie || stock === undefined) {
            return res.status(400).json({ 
                message: 'Champs obligatoires manquants: nom, description, prix, categorie, stock' 
            });
        }
        
        const product = new Product({
            nom: nom.trim(),
            description: description.trim(),
            prix: parseInt(prix),
            prixOriginal: prixOriginal ? parseInt(prixOriginal) : null,
            categorie,
            stock: parseInt(stock),
            marque: marque ? marque.trim() : '',
            image: image || '',
            ingredients: ingredients || '',
            modeEmploi: modeEmploi || '',
            precautions: precautions || '',
            enVedette: Boolean(enVedette),
            enPromotion: Boolean(enPromotion),
            actif: actif !== false, // Default to true
            dateAjout: new Date()
        });
        
        // Calculate promotion percentage if applicable
        if (product.enPromotion && product.prixOriginal && product.prixOriginal > product.prix) {
            product.pourcentagePromotion = Math.round(
                ((product.prixOriginal - product.prix) / product.prixOriginal) * 100
            );
        }
        
        await product.save();
        console.log('Product created successfully:', product._id);
        
        res.status(201).json({ 
            message: 'Produit créé avec succès',
            product 
        });
        
    } catch (error) {
        console.error('Create product error:', error);
        
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: 'Erreur de validation: ' + errors.join(', ') });
        }
        
        res.status(500).json({ message: 'Erreur serveur lors de la création du produit' });
    }
});

// PUT /api/admin/products/:id - Update product
router.put('/products/:id', adminAuth, async (req, res) => {
    try {
        console.log('Updating product:', req.params.id, req.body);
        
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Produit non trouvé' });
        }
        
        // Update fields
        const updateFields = [
            'nom', 'description', 'prix', 'prixOriginal', 'categorie', 'stock',
            'marque', 'image', 'ingredients', 'modeEmploi', 'precautions',
            'enVedette', 'enPromotion', 'actif'
        ];
        
        updateFields.forEach(field => {
            if (req.body[field] !== undefined) {
                if (field === 'prix' || field === 'prixOriginal' || field === 'stock') {
                    product[field] = parseInt(req.body[field]) || 0;
                } else if (field === 'enVedette' || field === 'enPromotion' || field === 'actif') {
                    product[field] = Boolean(req.body[field]);
                } else if (typeof req.body[field] === 'string') {
                    product[field] = req.body[field].trim();
                } else {
                    product[field] = req.body[field];
                }
            }
        });
        
        // Recalculate promotion percentage
        if (product.enPromotion && product.prixOriginal && product.prixOriginal > product.prix) {
            product.pourcentagePromotion = Math.round(
                ((product.prixOriginal - product.prix) / product.prixOriginal) * 100
            );
        } else {
            product.pourcentagePromotion = 0;
        }
        
        await product.save();
        console.log('Product updated successfully:', product._id);
        
        res.json({ 
            message: 'Produit mis à jour avec succès',
            product 
        });
        
    } catch (error) {
        console.error('Update product error:', error);
        
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: 'Erreur de validation: ' + errors.join(', ') });
        }
        
        res.status(500).json({ message: 'Erreur serveur lors de la mise à jour' });
    }
});

// DELETE /api/admin/products/:id - Delete product
router.delete('/products/:id', adminAuth, async (req, res) => {
    try {
        console.log('Deleting product:', req.params.id);
        
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Produit non trouvé' });
        }
        
        await Product.findByIdAndDelete(req.params.id);
        console.log('Product deleted successfully:', req.params.id);
        
        res.json({ message: 'Produit supprimé avec succès' });
        
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la suppression' });
    }
});

// GET /api/admin/orders - Get all orders for admin
router.get('/orders', adminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        
        let query = {};
        
        // Filter by status
        if (req.query.statut) {
            query.statut = req.query.statut;
        }
        
        // Filter by date range
        if (req.query.dateStart || req.query.dateEnd) {
            query.dateCommande = {};
            if (req.query.dateStart) {
                query.dateCommande.$gte = new Date(req.query.dateStart);
            }
            if (req.query.dateEnd) {
                query.dateCommande.$lte = new Date(req.query.dateEnd);
            }
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
        console.error('Admin orders error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// GET /api/admin/orders/:id - Get specific order
router.get('/orders/:id', adminAuth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('utilisateur', 'nom prenom email telephone');
        
        if (!order) {
            return res.status(404).json({ message: 'Commande non trouvée' });
        }
        
        res.json(order);
        
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// PUT /api/admin/orders/:id - Update order status
router.put('/orders/:id', adminAuth, async (req, res) => {
    try {
        console.log('Updating order:', req.params.id, req.body);
        
        const { statut, commentaires } = req.body;
        
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Commande non trouvée' });
        }
        
        // Validate status
        const validStatuses = ['en-attente', 'confirmée', 'préparée', 'expédiée', 'livrée', 'annulée'];
        if (statut && !validStatuses.includes(statut)) {
            return res.status(400).json({ message: 'Statut invalide' });
        }
        
        if (statut) order.statut = statut;
        if (commentaires !== undefined) order.commentaires = commentaires;
        
        // Set delivery date if status is "livrée"
        if (statut === 'livrée' && !order.dateLivraison) {
            order.dateLivraison = new Date();
        }
        
        await order.save();
        console.log('Order updated successfully:', order._id);
        
        res.json({ 
            message: 'Commande mise à jour avec succès',
            order 
        });
        
    } catch (error) {
        console.error('Update order error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// DELETE /api/admin/orders/:id - Delete order (soft delete)
router.delete('/orders/:id', adminAuth, async (req, res) => {
    try {
        console.log('Deleting order:', req.params.id);
        
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Commande non trouvée' });
        }
        
        // Soft delete by setting status to cancelled
        order.statut = 'annulée';
        await order.save();
        
        console.log('Order cancelled successfully:', req.params.id);
        
        res.json({ message: 'Commande annulée avec succès' });
        
    } catch (error) {
        console.error('Delete order error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// POST /api/admin/bulk-actions - Bulk actions for products/orders
router.post('/bulk-actions', adminAuth, async (req, res) => {
    try {
        const { action, type, ids } = req.body;
        
        if (!action || !type || !ids || !Array.isArray(ids)) {
            return res.status(400).json({ message: 'Paramètres invalides' });
        }
        
        let result = { success: 0, failed: 0 };
        
        if (type === 'products') {
            if (action === 'delete') {
                const deleteResult = await Product.deleteMany({ _id: { $in: ids } });
                result.success = deleteResult.deletedCount;
            } else if (action === 'activate') {
                const updateResult = await Product.updateMany(
                    { _id: { $in: ids } },
                    { actif: true }
                );
                result.success = updateResult.modifiedCount;
            } else if (action === 'deactivate') {
                const updateResult = await Product.updateMany(
                    { _id: { $in: ids } },
                    { actif: false }
                );
                result.success = updateResult.modifiedCount;
            }
        } else if (type === 'orders') {
            if (action === 'confirm') {
                const updateResult = await Order.updateMany(
                    { _id: { $in: ids } },
                    { statut: 'confirmée' }
                );
                result.success = updateResult.modifiedCount;
            } else if (action === 'cancel') {
                const updateResult = await Order.updateMany(
                    { _id: { $in: ids } },
                    { statut: 'annulée' }
                );
                result.success = updateResult.modifiedCount;
            }
        }
        
        res.json({ 
            message: `Action ${action} appliquée avec succès`,
            result 
        });
        
    } catch (error) {
        console.error('Bulk action error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

module.exports = router;
