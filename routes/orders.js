const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Settings = require('../models/Settings');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// Middleware d'authentification
const auth = (req, res, next) => {
    const token = req.header('x-auth-token');

    if (!token) {
        return res.status(401).json({ message: 'Accès refusé' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token invalide' });
    }
};

// Créer une commande
router.post('/', async (req, res) => {
    try {
        const { client, articles, commentaires } = req.body;
        
        // Validation des données requises
        if (!client || !articles || articles.length === 0) {
            return res.status(400).json({ 
                message: 'Informations client et articles requis' 
            });
        }

        // Validation des champs client requis
        const requiredFields = ['nom', 'prenom', 'email', 'telephone', 'adresse', 'wilaya'];
        for (const field of requiredFields) {
            if (!client[field]) {
                return res.status(400).json({ 
                    message: `Le champ ${field} est requis` 
                });
            }
        }
        
        // Vérifier les produits et calculer les totaux
        let sousTotal = 0;
        let articlesVerifies = [];
        
        for (let article of articles) {
            const produit = await Product.findById(article.produitId);
            
            if (!produit) {
                return res.status(400).json({ 
                    message: `Produit non trouvé: ${article.nom}` 
                });
            }
            
            if (!produit.actif) {
                return res.status(400).json({ 
                    message: `Le produit ${produit.nom} n'est plus disponible` 
                });
            }
            
            if (produit.stock < article.quantite) {
                return res.status(400).json({ 
                    message: `Stock insuffisant pour ${produit.nom}. Stock disponible: ${produit.stock}` 
                });
            }
            
            const prixUnitaire = produit.enPromotion && produit.prixOriginal ? 
                produit.prix : produit.prix;
                
            articlesVerifies.push({
                produit: produit._id,
                nom: produit.nom,
                prix: prixUnitaire,
                quantite: article.quantite,
                image: produit.image
            });
            
            sousTotal += prixUnitaire * article.quantite;
        }
        
        // Récupérer les frais de livraison
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings();
            await settings.save();
        }
        
        const fraisLivraison = sousTotal >= settings.livraisonGratuite ? 0 : settings.fraisLivraison;
        const total = sousTotal + fraisLivraison;
        
        // Créer la commande
        const order = new Order({
            client,
            articles: articlesVerifies,
            sousTotal,
            fraisLivraison,
            total,
            commentaires: commentaires || ''
        });
        
        await order.save();
        
        // Mettre à jour le stock des produits
        for (let article of articlesVerifies) {
            await Product.findByIdAndUpdate(
                article.produit,
                { $inc: { stock: -article.quantite } }
            );
        }
        
        res.status(201).json({
            message: 'Commande créée avec succès',
            order: {
                id: order._id,
                numeroCommande: order.numeroCommande,
                total: order.total,
                statut: order.statut,
                dateCommande: order.dateCommande
            }
        });
        
    } catch (error) {
        console.error('Erreur création commande:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la création de la commande' });
    }
});

// Obtenir une commande par numéro
router.get('/:numeroCommande', async (req, res) => {
    try {
        const order = await Order.findOne({ 
            numeroCommande: req.params.numeroCommande 
        }).populate('articles.produit');
        
        if (!order) {
            return res.status(404).json({ message: 'Commande non trouvée' });
        }
        
        res.json(order);
        
    } catch (error) {
        console.error('Erreur récupération commande:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Obtenir les commandes d'un utilisateur (nécessite authentification)
router.get('/user/all', auth, async (req, res) => {
    try {
        // Récupérer l'utilisateur pour obtenir son email
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        const orders = await Order.find({ 
            'client.email': user.email 
        })
        .populate('articles.produit')
        .sort({ dateCommande: -1 });
        
        res.json(orders);
        
    } catch (error) {
        console.error('Erreur récupération commandes utilisateur:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Obtenir une commande spécifique d'un utilisateur
router.get('/user/:id', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        const order = await Order.findOne({ 
            _id: req.params.id,
            'client.email': user.email 
        }).populate('articles.produit');
        
        if (!order) {
            return res.status(404).json({ message: 'Commande non trouvée' });
        }
        
        res.json(order);
        
    } catch (error) {
        console.error('Erreur récupération commande utilisateur:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Annuler une commande (seulement si en-attente)
router.put('/:id/cancel', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        const order = await Order.findOne({ 
            _id: req.params.id,
            'client.email': user.email 
        });
        
        if (!order) {
            return res.status(404).json({ message: 'Commande non trouvée' });
        }
        
        if (order.statut !== 'en-attente') {
            return res.status(400).json({ 
                message: 'Seules les commandes en attente peuvent être annulées' 
            });
        }
        
        // Remettre le stock
        for (let article of order.articles) {
            await Product.findByIdAndUpdate(
                article.produit,
                { $inc: { stock: article.quantite } }
            );
        }
        
        order.statut = 'annulée';
        await order.save();
        
        res.json({ 
            message: 'Commande annulée avec succès',
            order 
        });
        
    } catch (error) {
        console.error('Erreur annulation commande:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Vérifier le statut d'une commande (public)
router.get('/status/:numeroCommande', async (req, res) => {
    try {
        const order = await Order.findOne({ 
            numeroCommande: req.params.numeroCommande 
        }).select('numeroCommande statut dateCommande dateLivraison');
        
        if (!order) {
            return res.status(404).json({ message: 'Commande non trouvée' });
        }
        
        res.json({
            numeroCommande: order.numeroCommande,
            statut: order.statut,
            dateCommande: order.dateCommande,
            dateLivraison: order.dateLivraison
        });
        
    } catch (error) {
        console.error('Erreur vérification statut:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Obtenir les statistiques de commandes (pour les graphiques)
router.get('/stats/monthly', async (req, res) => {
    try {
        const now = new Date();
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        
        const stats = await Order.aggregate([
            {
                $match: {
                    dateCommande: { $gte: sixMonthsAgo },
                    statut: { $ne: 'annulée' }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$dateCommande' },
                        month: { $month: '$dateCommande' }
                    },
                    count: { $sum: 1 },
                    revenue: { $sum: '$total' }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 }
            }
        ]);
        
        res.json(stats);
        
    } catch (error) {
        console.error('Erreur statistiques commandes:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

module.exports = router;