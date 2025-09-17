const express = require('express');
const Product = require('../models/Product');
const auth = require('../middleware/auth');

const router = express.Router();

// Check if user is admin
const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            message: 'Accès administrateur requis'
        });
    }
    next();
};

// @route   GET /api/products
// @desc    Get all active products with filters and pagination
// @access  Public
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

// @route   GET /api/products/:id
// @desc    Get product by ID
// @access  Public
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

// @route   POST /api/products
// @desc    Create new product (Admin only)
// @access  Private/Admin
router.post('/', auth, requireAdmin, async (req, res) => {
    try {
        const {
            nom,
            description,
            prix,
            prixOriginal,
            stock,
            categorie,
            marque,
            ingredients,
            modeEmploi,
            precautions,
            image,
            enVedette,
            enPromotion,
            actif
        } = req.body;
        
        // Validation
        if (!nom || !description || prix === undefined || stock === undefined || !categorie) {
            return res.status(400).json({
                message: 'Veuillez remplir tous les champs obligatoires (nom, description, prix, stock, categorie)'
            });
        }
        
        // Create product data
        const productData = {
            nom: nom.trim(),
            description: description.trim(),
            prix: parseFloat(prix),
            stock: parseInt(stock),
            categorie,
            marque: marque ? marque.trim() : '',
            actif: actif !== false,
            enVedette: enVedette || false,
            enPromotion: enPromotion || false
        };
        
        // Add optional fields
        if (prixOriginal) {
            productData.prixOriginal = parseFloat(prixOriginal);
            
            if (productData.enPromotion && productData.prixOriginal > productData.prix) {
                productData.pourcentagePromotion = Math.round(
                    (productData.prixOriginal - productData.prix) / productData.prixOriginal * 100
                );
            }
        }
        
        if (ingredients) productData.ingredients = ingredients.trim();
        if (modeEmploi) productData.modeEmploi = modeEmploi.trim();
        if (precautions) productData.precautions = precautions.trim();
        if (image) productData.image = image;
        
        const product = new Product(productData);
        await product.save();
        
        console.log('✅ Product created:', product.nom);
        
        res.status(201).json({
            message: 'Produit créé avec succès',
            product
        });
        
    } catch (error) {
        console.error('❌ Create product error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: messages[0] || 'Données de produit invalides'
            });
        }
        
        res.status(500).json({
            message: 'Erreur lors de la création du produit'
        });
    }
});

// @route   PUT /api/products/:id
// @desc    Update product (Admin only)
// @access  Private/Admin
router.put('/:id', auth, requireAdmin, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                message: 'Produit non trouvé'
            });
        }
        
        // Update fields if provided
        const allowedFields = [
            'nom', 'description', 'prix', 'prixOriginal', 'stock', 'categorie',
            'marque', 'ingredients', 'modeEmploi', 'precautions', 'image',
            'enVedette', 'enPromotion', 'actif'
        ];
        
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                if (field === 'prix' || field === 'prixOriginal') {
                    product[field] = parseFloat(req.body[field]);
                } else if (field === 'stock') {
                    product[field] = parseInt(req.body[field]);
                } else {
                    product[field] = req.body[field];
                }
            }
        });
        
        // Calculate promotion percentage if applicable
        if (product.enPromotion && product.prixOriginal && product.prixOriginal > product.prix) {
            product.pourcentagePromotion = Math.round(
                (product.prixOriginal - product.prix) / product.prixOriginal * 100
            );
        } else {
            product.pourcentagePromotion = 0;
        }
        
        await product.save();
        
        console.log('✅ Product updated:', product.nom);
        
        res.json({
            message: 'Produit mis à jour avec succès',
            product
        });
        
    } catch (error) {
        console.error('❌ Update product error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: messages[0] || 'Données de produit invalides'
            });
        }
        
        res.status(500).json({
            message: 'Erreur lors de la mise à jour du produit'
        });
    }
});

// @route   DELETE /api/products/:id
// @desc    Delete product (Admin only)
// @access  Private/Admin
router.delete('/:id', auth, requireAdmin, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                message: 'Produit non trouvé'
            });
        }
        
        await Product.findByIdAndDelete(req.params.id);
        
        console.log('✅ Product deleted:', product.nom);
        
        res.json({
            message: 'Produit supprimé avec succès'
        });
        
    } catch (error) {
        console.error('❌ Delete product error:', error);
        res.status(500).json({
            message: 'Erreur lors de la suppression du produit'
        });
    }
});

// @route   GET /api/products/categories/all
// @desc    Get all categories
// @access  Public
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

// @route   GET /api/products/featured/all
// @desc    Get featured products
// @access  Public
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

// @route   GET /api/products/promotions/all
// @desc    Get products on promotion
// @access  Public
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
