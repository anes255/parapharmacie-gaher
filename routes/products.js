const express = require('express');
const Product = require('../models/Product');
const { auth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/products
// @desc    Get all products with filters and pagination
// @access  Public
router.get('/', async (req, res) => {
    try {
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
        console.error('❌ Get products error:', error);
        res.status(500).json({ 
            message: 'Erreur lors de la récupération des produits' 
        });
    }
});

// @route   GET /api/products/:id
// @desc    Get product by ID
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({ 
                message: 'Produit non trouvé' 
            });
        }
        
        res.json(product);
        
    } catch (error) {
        console.error('❌ Get product error:', error);
        res.status(500).json({ 
            message: 'Erreur lors de la récupération du produit' 
        });
    }
});

// @route   POST /api/products
// @desc    Create new product (Admin only)
// @access  Private/Admin
router.post('/', auth, requireAdmin, async (req, res) => {
    try {
        console.log('📦 Creating new product:', req.body.nom);
        
        const productData = {
            ...req.body,
            dateAjout: new Date()
        };
        
        const product = new Product(productData);
        await product.save();
        
        console.log('✅ Product created successfully:', product._id);
        
        res.status(201).json({
            message: 'Produit créé avec succès',
            product
        });
        
    } catch (error) {
        console.error('❌ Product creation error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: messages[0] || 'Données de produit invalides'
            });
        }
        
        res.status(500).json({
            message: 'Erreur serveur lors de la création du produit'
        });
    }
});

// @route   PUT /api/products/:id
// @desc    Update product (Admin only)
// @access  Private/Admin
router.put('/:id', auth, requireAdmin, async (req, res) => {
    try {
        console.log('📦 Updating product:', req.params.id);
        
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                message: 'Produit non trouvé'
            });
        }
        
        // Update product with new data
        Object.keys(req.body).forEach(key => {
            if (req.body[key] !== undefined) {
                product[key] = req.body[key];
            }
        });
        
        await product.save();
        
        console.log('✅ Product updated successfully:', product._id);
        
        res.json({
            message: 'Produit mis à jour avec succès',
            product
        });
        
    } catch (error) {
        console.error('❌ Product update error:', error);
        
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
        console.log('📦 Deleting product:', req.params.id);
        
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                message: 'Produit non trouvé'
            });
        }
        
        await Product.findByIdAndDelete(req.params.id);
        
        console.log('✅ Product deleted successfully:', req.params.id);
        
        res.json({
            message: 'Produit supprimé avec succès'
        });
        
    } catch (error) {
        console.error('❌ Product deletion error:', error);
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
            { nom: 'Vitalité', description: 'Vitamines et suppléments alimentaires' },
            { nom: 'Sport', description: 'Nutrition sportive' }
        ];
        
        res.json(categoriesInfo);
        
    } catch (error) {
        console.error('❌ Get categories error:', error);
        res.status(500).json({ 
            message: 'Erreur lors de la récupération des catégories' 
        });
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
        console.error('❌ Get featured products error:', error);
        res.status(500).json({ 
            message: 'Erreur lors de la récupération des produits vedette' 
        });
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
        console.error('❌ Get promotion products error:', error);
        res.status(500).json({ 
            message: 'Erreur lors de la récupération des produits en promotion' 
        });
    }
});

// @route   PUT /api/products/:id/toggle-featured
// @desc    Toggle featured status (Admin only)
// @access  Private/Admin
router.put('/:id/toggle-featured', auth, requireAdmin, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                message: 'Produit non trouvé'
            });
        }
        
        product.enVedette = !product.enVedette;
        await product.save();
        
        res.json({
            message: `Produit ${product.enVedette ? 'ajouté aux' : 'retiré des'} coups de coeur`,
            product
        });
        
    } catch (error) {
        console.error('❌ Toggle featured error:', error);
        res.status(500).json({
            message: 'Erreur lors de la modification du statut vedette'
        });
    }
});

// @route   PUT /api/products/:id/toggle-promotion
// @desc    Toggle promotion status (Admin only)
// @access  Private/Admin
router.put('/:id/toggle-promotion', auth, requireAdmin, async (req, res) => {
    try {
        const { enPromotion, prixOriginal, pourcentagePromotion } = req.body;
        
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                message: 'Produit non trouvé'
            });
        }
        
        product.enPromotion = enPromotion;
        
        if (enPromotion) {
            if (prixOriginal) {
                product.prixOriginal = prixOriginal;
            }
            if (pourcentagePromotion) {
                product.pourcentagePromotion = pourcentagePromotion;
            }
        } else {
            product.prixOriginal = null;
            product.pourcentagePromotion = 0;
        }
        
        await product.save();
        
        res.json({
            message: `Promotion ${enPromotion ? 'activée' : 'désactivée'}`,
            product
        });
        
    } catch (error) {
        console.error('❌ Toggle promotion error:', error);
        res.status(500).json({
            message: 'Erreur lors de la modification de la promotion'
        });
    }
});

// @route   GET /api/products/search/suggestions
// @desc    Get search suggestions
// @access  Public
router.get('/search/suggestions', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.length < 2) {
            return res.json([]);
        }
        
        const suggestions = await Product.find({
            actif: true,
            $or: [
                { nom: { $regex: q, $options: 'i' } },
                { marque: { $regex: q, $options: 'i' } },
                { categorie: { $regex: q, $options: 'i' } }
            ]
        })
        .select('nom marque categorie')
        .limit(5);
        
        const uniqueSuggestions = [];
        const seen = new Set();
        
        suggestions.forEach(product => {
            if (!seen.has(product.nom)) {
                uniqueSuggestions.push({
                    type: 'product',
                    text: product.nom,
                    category: product.categorie
                });
                seen.add(product.nom);
            }
        });
        
        res.json(uniqueSuggestions);
        
    } catch (error) {
        console.error('❌ Search suggestions error:', error);
        res.status(500).json({ 
            message: 'Erreur lors de la récupération des suggestions' 
        });
    }
});

module.exports = router;
