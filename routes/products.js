const express = require('express');
const Product = require('../models/Product');

const router = express.Router();

// Obtenir tous les produits avec filtres et pagination
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;
        
        let query = { actif: true };
        
        // Filtres
        if (req.query.categorie) {
            query.categorie = req.query.categorie;
        }
        
        if (req.query.search) {
            query.$or = [
                { nom: { $regex: req.query.search, $options: 'i' } },
                { description: { $regex: req.query.search, $options: 'i' } },
                { marque: { $regex: req.query.search, $options: 'i' } }
            ];
        }
        
        if (req.query.priceMin || req.query.priceMax) {
            query.prix = {};
            if (req.query.priceMin) query.prix.$gte = parseFloat(req.query.priceMin);
            if (req.query.priceMax) query.prix.$lte = parseFloat(req.query.priceMax);
        }
        
        if (req.query.enPromotion === 'true') {
            query.enPromotion = true;
        }
        
        if (req.query.enVedette === 'true') {
            query.enVedette = true;
        }
        
        // Tri
        let sort = {};
        switch (req.query.sort) {
            case 'price_asc':
                sort.prix = 1;
                break;
            case 'price_desc':
                sort.prix = -1;
                break;
            case 'name_asc':
                sort.nom = 1;
                break;
            case 'name_desc':
                sort.nom = -1;
                break;
            case 'newest':
                sort.dateAjout = -1;
                break;
            default:
                sort.dateAjout = -1;
        }
        
        const products = await Product.find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit);
            
        const total = await Product.countDocuments(query);
        const totalPages = Math.ceil(total / limit);
        
        res.json({
            products,
            pagination: {
                currentPage: page,
                totalPages,
                totalProducts: total,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
        
    } catch (error) {
        console.error('Erreur récupération produits:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Obtenir un produit par ID
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({ message: 'Produit non trouvé' });
        }
        
        res.json(product);
        
    } catch (error) {
        console.error('Erreur récupération produit:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Obtenir les catégories
router.get('/categories/all', async (req, res) => {
    try {
        const categories = await Product.distinct('categorie');
        
        const categoriesInfo = [
            { nom: 'Cheveux', description: 'Soins capillaires' },
            { nom: 'Intime', description: 'Hygiène intime' },
            { nom: 'Solaire', description: 'Protection solaire' },
            { nom: 'Maman', description: 'Soins pour mamans' },
            { nom: 'Bébé', description: 'Soins pour bébés' },
            { nom: 'Visage', description: 'Soins du visage' },
            { nom: 'Minceur', description: 'Produits minceur' },
            { nom: 'Homme', description: 'Soins pour hommes' },
            { nom: 'Soins', description: 'Soins généraux' },
            { nom: 'Dentaire', description: 'Hygiène dentaire' },
            { nom: 'Vitalité', description: 'Vitamines et suppléments alimentaires' }
        ];
        
        res.json(categoriesInfo);
        
    } catch (error) {
        console.error('Erreur récupération catégories:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Obtenir les produits en vedette
router.get('/featured/all', async (req, res) => {
    try {
        const products = await Product.find({ 
            enVedette: true, 
            actif: true 
        })
        .limit(8)
        .sort({ dateAjout: -1 });
        
        res.json(products);
        
    } catch (error) {
        console.error('Erreur produits vedette:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Obtenir les produits en promotion
router.get('/promotions/all', async (req, res) => {
    try {
        const products = await Product.find({ 
            enPromotion: true, 
            actif: true 
        })
        .limit(8)
        .sort({ dateAjout: -1 });
        
        res.json(products);
        
    } catch (error) {
        console.error('Erreur produits promotion:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

module.exports = router;