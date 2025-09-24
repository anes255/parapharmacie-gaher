// FIXED routes/products.js - Enhanced with better error handling

const express = require('express');
const Product = require('../models/Product');

const router = express.Router();

// GET all products with filters and pagination - FIXED
router.get('/', async (req, res) => {
    try {
        console.log('📦 Getting products with query:', req.query);
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;
        
        let query = { actif: true };
        
        // Filters
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
        
        // Sort
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
        
        console.log(`✅ Found ${products.length} products out of ${total} total`);
        
        res.json({
            success: true,
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
        console.error('❌ Error getting products:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erreur serveur lors de la récupération des produits',
            error: error.message 
        });
    }
});

// GET product by ID - FIXED  
router.get('/:id', async (req, res) => {
    try {
        console.log('📦 Getting product by ID:', req.params.id);
        
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            console.log('❌ Product not found:', req.params.id);
            return res.status(404).json({ 
                success: false,
                message: 'Produit non trouvé' 
            });
        }
        
        console.log('✅ Product found:', product.nom);
        
        res.json({
            success: true,
            product
        });
        
    } catch (error) {
        console.error('❌ Error getting product:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erreur serveur lors de la récupération du produit',
            error: error.message 
        });
    }
});

// GET categories - ENHANCED
router.get('/categories/all', async (req, res) => {
    try {
        console.log('📦 Getting all categories');
        
        const categories = await Product.distinct('categorie');
        
        const categoriesInfo = [
            { nom: 'Vitalité', description: 'Vitamines & Énergie', icon: 'fa-seedling' },
            { nom: 'Cheveux', description: 'Soins capillaires', icon: 'fa-cut' },
            { nom: 'Visage', description: 'Soins du visage', icon: 'fa-smile' },
            { nom: 'Intime', description: 'Hygiène intime', icon: 'fa-heart' },
            { nom: 'Solaire', description: 'Protection solaire', icon: 'fa-sun' },
            { nom: 'Bébé', description: 'Soins pour bébés', icon: 'fa-baby-carriage' },
            { nom: 'Maman', description: 'Soins pour mamans', icon: 'fa-female' },
            { nom: 'Minceur', description: 'Produits minceur', icon: 'fa-weight' },
            { nom: 'Homme', description: 'Soins pour hommes', icon: 'fa-user-tie' },
            { nom: 'Soins', description: 'Soins généraux', icon: 'fa-spa' },
            { nom: 'Dentaire', description: 'Hygiène dentaire', icon: 'fa-tooth' },
            { nom: 'Sport', description: 'Nutrition sportive', icon: 'fa-dumbbell' }
        ];
        
        console.log(`✅ Found categories:`, categories);
        
        res.json({
            success: true,
            categories: categoriesInfo,
            availableCategories: categories
        });
        
    } catch (error) {
        console.error('❌ Error getting categories:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erreur serveur lors de la récupération des catégories',
            error: error.message 
        });
    }
});

// GET featured products - FIXED
router.get('/featured/all', async (req, res) => {
    try {
        console.log('📦 Getting featured products');
        
        const products = await Product.find({ 
            enVedette: true, 
            actif: true 
        })
        .limit(8)
        .sort({ dateAjout: -1 });
        
        console.log(`✅ Found ${products.length} featured products`);
        
        res.json({
            success: true,
            products
        });
        
    } catch (error) {
        console.error('❌ Error getting featured products:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erreur serveur lors de la récupération des produits en vedette',
            error: error.message 
        });
    }
});

// GET promotion products - FIXED
router.get('/promotions/all', async (req, res) => {
    try {
        console.log('📦 Getting promotion products');
        
        const products = await Product.find({ 
            enPromotion: true, 
            actif: true 
        })
        .limit(8)
        .sort({ dateAjout: -1 });
        
        console.log(`✅ Found ${products.length} promotion products`);
        
        res.json({
            success: true,
            products
        });
        
    } catch (error) {
        console.error('❌ Error getting promotion products:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erreur serveur lors de la récupération des produits en promotion',
            error: error.message 
        });
    }
});

module.exports = router;
