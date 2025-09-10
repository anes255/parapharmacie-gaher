const express = require('express');
const jwt = require('jsonwebtoken');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Settings = require('../models/Settings');

const router = express.Router();

// Middleware admin
const adminAuth = async (req, res, next) => {
    const token = req.header('x-auth-token');
    
    if (!token) {
        console.log('No token provided');
        return res.status(401).json({ message: 'Accès refusé' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.user.id);
        
        if (!user || user.role !== 'admin') {
            console.log('User not admin:', user ? user.role : 'user not found');
            return res.status(403).json({ message: 'Accès administrateur requis' });
        }
        
        req.user = decoded.user;
        next();
    } catch (error) {
        console.error('Token verification failed:', error);
        res.status(401).json({ message: 'Token invalide' });
    }
};

// Dashboard stats
router.get('/dashboard', adminAuth, async (req, res) => {
    try {
        const totalProducts = await Product.countDocuments({ actif: true });
        const totalOrders = await Order.countDocuments();
        const pendingOrders = await Order.countDocuments({ statut: 'en-attente' });
        const totalUsers = await User.countDocuments({ role: 'user' });
        
        // Commandes récentes
        const recentOrders = await Order.find()
            .sort({ dateCommande: -1 })
            .limit(5)
            .populate('articles.produit');
            
        // Revenus du mois
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const monthlyRevenue = await Order.aggregate([
            {
                $match: {
                    dateCommande: { $gte: startOfMonth },
                    statut: { $in: ['confirmée', 'préparée', 'expédiée', 'livrée'] }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$total' }
                }
            }
        ]);
        
        res.json({
            stats: {
                totalProducts,
                totalOrders,
                pendingOrders,
                totalUsers,
                monthlyRevenue: monthlyRevenue[0]?.total || 0
            },
            recentOrders
        });
        
    } catch (error) {
        console.error('Erreur dashboard:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Gestion des produits
router.get('/products', adminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50; // Increased limit
        const skip = (page - 1) * limit;
        
        let query = {};
        if (req.query.search) {
            query.$or = [
                { nom: { $regex: req.query.search, $options: 'i' } },
                { description: { $regex: req.query.search, $options: 'i' } }
            ];
        }
        
        if (req.query.categorie) {
            query.categorie = req.query.categorie;
        }
        
        const products = await Product.find(query)
            .sort({ dateAjout: -1 })
            .skip(skip)
            .limit(limit);
            
        const total = await Product.countDocuments(query);
        
        console.log(`Found ${products.length} products out of ${total} total`);
        
        res.json({
            products,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                total
            }
        });
        
    } catch (error) {
        console.error('Erreur récupération produits admin:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Ajouter un produit - ENHANCED ERROR HANDLING
router.post('/products', adminAuth, async (req, res) => {
    try {
        console.log('Creating product with data:', JSON.stringify(req.body, null, 2));
        
        // Validation of required fields
        const requiredFields = ['nom', 'description', 'prix', 'stock', 'categorie'];
        for (const field of requiredFields) {
            if (!req.body[field] && req.body[field] !== 0) {
                console.error(`Missing required field: ${field}`);
                return res.status(400).json({ 
                    message: `Le champ ${field} est requis`,
                    field: field
                });
            }
        }
        
        // Validate category
        const validCategories = ['Vitalité', 'Sport', 'Visage', 'Cheveux', 'Solaire', 'Intime', 'Soins', 'Bébé', 'Homme', 'Dentaire'];
        if (!validCategories.includes(req.body.categorie)) {
            console.error(`Invalid category: ${req.body.categorie}`);
            return res.status(400).json({ 
                message: `Catégorie invalide. Catégories valides: ${validCategories.join(', ')}`,
                receivedCategory: req.body.categorie,
                validCategories: validCategories
            });
        }
        
        // Ensure numeric fields are properly typed
        const productData = {
            ...req.body,
            prix: Number(req.body.prix),
            stock: Number(req.body.stock),
            prixOriginal: req.body.prixOriginal ? Number(req.body.prixOriginal) : null,
            pourcentagePromotion: req.body.pourcentagePromotion ? Number(req.body.pourcentagePromotion) : 0
        };
        
        console.log('Processed product data:', JSON.stringify(productData, null, 2));
        
        const product = new Product(productData);
        await product.save();
        
        console.log('Product saved successfully:', product._id);
        
        res.status(201).json({ 
            message: 'Produit ajouté avec succès', 
            product: product
        });
        
    } catch (error) {
        console.error('Erreur ajout produit détaillée:', error);
        
        if (error.name === 'ValidationError') {
            const errors = Object.keys(error.errors).map(key => ({
                field: key,
                message: error.errors[key].message
            }));
            return res.status(400).json({ 
                message: 'Erreur de validation',
                errors: errors
            });
        }
        
        res.status(500).json({ 
            message: 'Erreur serveur lors de l\'ajout du produit',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Modifier un produit - ENHANCED ERROR HANDLING
router.put('/products/:id', adminAuth, async (req, res) => {
    try {
        console.log(`Updating product ${req.params.id} with data:`, JSON.stringify(req.body, null, 2));
        
        // Validate category if provided
        if (req.body.categorie) {
            const validCategories = ['Vitalité', 'Sport', 'Visage', 'Cheveux', 'Solaire', 'Intime', 'Soins', 'Bébé', 'Homme', 'Dentaire'];
            if (!validCategories.includes(req.body.categorie)) {
                return res.status(400).json({ 
                    message: `Catégorie invalide. Catégories valides: ${validCategories.join(', ')}`,
                    receivedCategory: req.body.categorie,
                    validCategories: validCategories
                });
            }
        }
        
        // Ensure numeric fields are properly typed
        const updateData = { ...req.body };
        if (updateData.prix) updateData.prix = Number(updateData.prix);
        if (updateData.stock) updateData.stock = Number(updateData.stock);
        if (updateData.prixOriginal) updateData.prixOriginal = Number(updateData.prixOriginal);
        if (updateData.pourcentagePromotion) updateData.pourcentagePromotion = Number(updateData.pourcentagePromotion);
        
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );
        
        if (!product) {
            return res.status(404).json({ message: 'Produit non trouvé' });
        }
        
        console.log('Product updated successfully:', product._id);
        
        res.json({ message: 'Produit modifié avec succès', product });
    } catch (error) {
        console.error('Erreur modification produit:', error);
        
        if (error.name === 'ValidationError') {
            const errors = Object.keys(error.errors).map(key => ({
                field: key,
                message: error.errors[key].message
            }));
            return res.status(400).json({ 
                message: 'Erreur de validation',
                errors: errors
            });
        }
        
        res.status(500).json({ 
            message: 'Erreur serveur lors de la modification',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Supprimer un produit
router.delete('/products/:id', adminAuth, async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        
        if (!product) {
            return res.status(404).json({ message: 'Produit non trouvé' });
        }
        
        console.log('Product deleted successfully:', req.params.id);
        
        res.json({ message: 'Produit supprimé avec succès' });
    } catch (error) {
        console.error('Erreur suppression produit:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Clear all products - for cleanup
router.delete('/products/clear', adminAuth, async (req, res) => {
    try {
        const result = await Product.deleteMany({});
        console.log(`Cleared ${result.deletedCount} products`);
        res.json({ message: `${result.deletedCount} produits supprimés` });
    } catch (error) {
        console.error('Erreur nettoyage produits:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Gestion des commandes
router.get('/orders', adminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        let query = {};
        if (req.query.statut) {
            query.statut = req.query.statut;
        }
        
        if (req.query.search) {
            query.$or = [
                { numeroCommande: { $regex: req.query.search, $options: 'i' } },
                { 'client.nom': { $regex: req.query.search, $options: 'i' } },
                { 'client.email': { $regex: req.query.search, $options: 'i' } }
            ];
        }
        
        const orders = await Order.find(query)
            .sort({ dateCommande: -1 })
            .skip(skip)
            .limit(limit)
            .populate('articles.produit');
            
        const total = await Order.countDocuments(query);
        
        res.json({
            orders,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                total
            }
        });
        
    } catch (error) {
        console.error('Erreur récupération commandes admin:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Modifier le statut d'une commande
router.put('/orders/:id/status', adminAuth, async (req, res) => {
    try {
        const { statut, notesAdmin } = req.body;
        
        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { 
                statut,
                notesAdmin: notesAdmin || '',
                dateLivraison: statut === 'livrée' ? new Date() : null
            },
            { new: true }
        ).populate('articles.produit');
        
        if (!order) {
            return res.status(404).json({ message: 'Commande non trouvée' });
        }
        
        res.json({ message: 'Statut mis à jour avec succès', order });
    } catch (error) {
        console.error('Erreur mise à jour statut:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

module.exports = router;
