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
        return res.status(401).json({ message: 'Accès refusé' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.user.id);
        
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: 'Accès administrateur requis' });
        }
        
        req.user = decoded.user;
        next();
    } catch (error) {
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
        const limit = parseInt(req.query.limit) || 20;
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

// Ajouter un produit
router.post('/products', adminAuth, async (req, res) => {
    try {
        const product = new Product(req.body);
        await product.save();
        res.status(201).json({ message: 'Produit ajouté avec succès', product });
    } catch (error) {
        console.error('Erreur ajout produit:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Modifier un produit
router.put('/products/:id', adminAuth, async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        
        if (!product) {
            return res.status(404).json({ message: 'Produit non trouvé' });
        }
        
        res.json({ message: 'Produit modifié avec succès', product });
    } catch (error) {
        console.error('Erreur modification produit:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Supprimer un produit
router.delete('/products/:id', adminAuth, async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        
        if (!product) {
            return res.status(404).json({ message: 'Produit non trouvé' });
        }
        
        res.json({ message: 'Produit supprimé avec succès' });
    } catch (error) {
        console.error('Erreur suppression produit:', error);
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