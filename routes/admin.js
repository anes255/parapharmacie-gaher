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

// Replace the POST /products route in your routes/admin.js with this enhanced version:

// Ajouter un produit - ENHANCED DEBUG VERSION
router.post('/products', adminAuth, async (req, res) => {
    try {
        console.log('🔥 === PRODUCT CREATION DEBUG ===');
        console.log('📥 Raw request body:', JSON.stringify(req.body, null, 2));
        console.log('📝 Request headers:', req.headers);
        console.log('👤 User from token:', req.user);
        
        // Log each field individually
        console.log('📋 Field Analysis:');
        console.log('  - nom:', req.body.nom, '(type:', typeof req.body.nom, ')');
        console.log('  - description:', req.body.description, '(type:', typeof req.body.description, ')');
        console.log('  - prix:', req.body.prix, '(type:', typeof req.body.prix, ')');
        console.log('  - stock:', req.body.stock, '(type:', typeof req.body.stock, ')');
        console.log('  - categorie:', req.body.categorie, '(type:', typeof req.body.categorie, ')');
        console.log('  - _id field present:', !!req.body._id);
        
        // Validation of required fields
        const requiredFields = ['nom', 'description', 'prix', 'stock', 'categorie'];
        const missingFields = [];
        
        for (const field of requiredFields) {
            if (!req.body[field] && req.body[field] !== 0) {
                missingFields.push(field);
                console.error(`❌ Missing required field: ${field}`);
            }
        }
        
        if (missingFields.length > 0) {
            return res.status(400).json({ 
                message: `Champs requis manquants: ${missingFields.join(', ')}`,
                missingFields: missingFields,
                receivedData: req.body
            });
        }
        
        // Validate category
        const validCategories = ['Vitalité', 'Sport', 'Visage', 'Cheveux', 'Solaire', 'Intime', 'Soins', 'Bébé', 'Homme', 'Dentaire'];
        if (!validCategories.includes(req.body.categorie)) {
            console.error(`❌ Invalid category: ${req.body.categorie}`);
            return res.status(400).json({ 
                message: `Catégorie invalide: "${req.body.categorie}". Catégories valides: ${validCategories.join(', ')}`,
                receivedCategory: req.body.categorie,
                validCategories: validCategories
            });
        }
        
        // Remove _id if present (let MongoDB generate it)
        const productData = { ...req.body };
        if (productData._id) {
            console.log('⚠️ Removing _id field from request data');
            delete productData._id;
        }
        
        // Ensure numeric fields are properly typed
        productData.prix = Number(req.body.prix);
        productData.stock = Number(req.body.stock);
        
        if (req.body.prixOriginal) {
            productData.prixOriginal = Number(req.body.prixOriginal);
        }
        
        if (req.body.pourcentagePromotion) {
            productData.pourcentagePromotion = Number(req.body.pourcentagePromotion);
        }
        
        // Ensure boolean fields are properly typed
        productData.actif = Boolean(req.body.actif);
        productData.enVedette = Boolean(req.body.enVedette);
        productData.enPromotion = Boolean(req.body.enPromotion);
        
        console.log('🔧 Processed product data:', JSON.stringify(productData, null, 2));
        
        // Validate processed data
        if (isNaN(productData.prix) || productData.prix < 0) {
            return res.status(400).json({ 
                message: 'Prix invalide',
                receivedPrix: req.body.prix,
                processedPrix: productData.prix
            });
        }
        
        if (isNaN(productData.stock) || productData.stock < 0) {
            return res.status(400).json({ 
                message: 'Stock invalide',
                receivedStock: req.body.stock,
                processedStock: productData.stock
            });
        }
        
        console.log('✅ Data validation passed, creating product...');
        
        const product = new Product(productData);
        
        console.log('📦 Product object created, attempting to save...');
        
        await product.save();
        
        console.log('🎉 Product saved successfully!');
        console.log('📄 Saved product:', JSON.stringify(product.toObject(), null, 2));
        
        res.status(201).json({ 
            message: 'Produit ajouté avec succès', 
            product: product.toObject()
        });
        
    } catch (error) {
        console.error('💥 === PRODUCT CREATION ERROR ===');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        if (error.name === 'ValidationError') {
            console.error('📋 Validation errors:');
            const errors = Object.keys(error.errors).map(key => {
                const err = error.errors[key];
                console.error(`  - ${key}: ${err.message} (kind: ${err.kind}, value: ${err.value})`);
                return {
                    field: key,
                    message: err.message,
                    kind: err.kind,
                    value: err.value
                };
            });
            
            return res.status(400).json({ 
                message: 'Erreur de validation détaillée',
                validationErrors: errors,
                receivedData: req.body
            });
        }
        
        if (error.name === 'MongoError' || error.name === 'MongoServerError') {
            console.error('🗄️ MongoDB Error:', error.code, error.codeName);
            return res.status(400).json({
                message: 'Erreur base de données',
                mongoError: error.message,
                code: error.code
            });
        }
        
        res.status(500).json({ 
            message: 'Erreur serveur lors de l\'ajout du produit',
            errorType: error.name,
            error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne'
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

