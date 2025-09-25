const express = require('express');
const Product = require('../models/Product');
const { auth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/products
// @desc    Get all active products with pagination and filtering
// @access  Public
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        const { 
            search, 
            categorie, 
            enPromotion, 
            enVedette, 
            prixMin, 
            prixMax,
            sortBy = 'dateAjout',
            sortOrder = 'desc'
        } = req.query;
        
        // Build filter object
        let filter = { actif: true };
        
        if (search) {
            filter.$or = [
                { nom: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { marque: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (categorie) filter.categorie = categorie;
        if (enPromotion === 'true') filter.enPromotion = true;
        if (enVedette === 'true') filter.enVedette = true;
        
        if (prixMin || prixMax) {
            filter.prix = {};
            if (prixMin) filter.prix.$gte = parseFloat(prixMin);
            if (prixMax) filter.prix.$lte = parseFloat(prixMax);
        }
        
        // Build sort object
        const sortObj = {};
        sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;
        
        console.log('📦 Products query:', { filter, sortObj, page, limit });
        
        const products = await Product.find(filter)
            .sort(sortObj)
            .skip(skip)
            .limit(limit)
            .lean();
        
        const total = await Product.countDocuments(filter);
        
        res.json({
            products,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalProducts: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        });
        
    } catch (error) {
        console.error('❌ Products fetch error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des produits',
            error: error.message
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
        
        if (!product.actif) {
            return res.status(404).json({
                message: 'Produit non disponible'
            });
        }
        
        res.json(product);
        
    } catch (error) {
        console.error('❌ Product fetch error:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                message: 'ID de produit invalide'
            });
        }
        res.status(500).json({
            message: 'Erreur lors de la récupération du produit',
            error: error.message
        });
    }
});

// @route   POST /api/products
// @desc    Create new product
// @access  Private/Admin
router.post('/', auth, requireAdmin, async (req, res) => {
    try {
        console.log('➕ Creating new product:', req.body);
        
        const {
            nom,
            description,
            prix,
            prixOriginal,
            categorie,
            marque,
            stock,
            images,
            enPromotion,
            enVedette,
            actif
        } = req.body;
        
        // Validation
        if (!nom || !description || !prix || !categorie) {
            return res.status(400).json({
                message: 'Nom, description, prix et catégorie sont requis'
            });
        }
        
        if (prix <= 0) {
            return res.status(400).json({
                message: 'Le prix doit être supérieur à 0'
            });
        }
        
        // Check if product with same name exists
        const existingProduct = await Product.findOne({ 
            nom: { $regex: new RegExp(`^${nom}$`, 'i') }
        });
        
        if (existingProduct) {
            return res.status(400).json({
                message: 'Un produit avec ce nom existe déjà'
            });
        }
        
        const product = new Product({
            nom,
            description,
            prix: parseFloat(prix),
            prixOriginal: prixOriginal ? parseFloat(prixOriginal) : null,
            categorie,
            marque: marque || '',
            stock: parseInt(stock) || 0,
            images: images || [],
            enPromotion: Boolean(enPromotion),
            enVedette: Boolean(enVedette),
            actif: actif !== undefined ? Boolean(actif) : true,
            dateAjout: new Date(),
            dateMiseAJour: new Date()
        });
        
        const savedProduct = await product.save();
        console.log('✅ Product created successfully:', savedProduct._id);
        
        res.status(201).json({
            message: 'Produit créé avec succès',
            product: savedProduct
        });
        
    } catch (error) {
        console.error('❌ Product creation error:', error);
        res.status(500).json({
            message: 'Erreur lors de la création du produit',
            error: error.message
        });
    }
});

// @route   PUT /api/products/:id
// @desc    Update product
// @access  Private/Admin
router.put('/:id', auth, requireAdmin, async (req, res) => {
    try {
        console.log('✏️ Updating product:', req.params.id, req.body);
        
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                message: 'Produit non trouvé'
            });
        }
        
        const {
            nom,
            description,
            prix,
            prixOriginal,
            categorie,
            marque,
            stock,
            images,
            enPromotion,
            enVedette,
            actif
        } = req.body;
        
        // Validation
        if (prix !== undefined && prix <= 0) {
            return res.status(400).json({
                message: 'Le prix doit être supérieur à 0'
            });
        }
        
        // Check if another product with same name exists (excluding current)
        if (nom && nom !== product.nom) {
            const existingProduct = await Product.findOne({ 
                nom: { $regex: new RegExp(`^${nom}$`, 'i') },
                _id: { $ne: product._id }
            });
            
            if (existingProduct) {
                return res.status(400).json({
                    message: 'Un autre produit avec ce nom existe déjà'
                });
            }
        }
        
        // Update fields
        if (nom) product.nom = nom;
        if (description) product.description = description;
        if (prix !== undefined) product.prix = parseFloat(prix);
        if (prixOriginal !== undefined) product.prixOriginal = prixOriginal ? parseFloat(prixOriginal) : null;
        if (categorie) product.categorie = categorie;
        if (marque !== undefined) product.marque = marque;
        if (stock !== undefined) product.stock = parseInt(stock);
        if (images !== undefined) product.images = images;
        if (enPromotion !== undefined) product.enPromotion = Boolean(enPromotion);
        if (enVedette !== undefined) product.enVedette = Boolean(enVedette);
        if (actif !== undefined) product.actif = Boolean(actif);
        
        product.dateMiseAJour = new Date();
        
        const updatedProduct = await product.save();
        console.log('✅ Product updated successfully:', updatedProduct._id);
        
        res.json({
            message: 'Produit mis à jour avec succès',
            product: updatedProduct
        });
        
    } catch (error) {
        console.error('❌ Product update error:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                message: 'ID de produit invalide'
            });
        }
        res.status(500).json({
            message: 'Erreur lors de la mise à jour du produit',
            error: error.message
        });
    }
});

// @route   DELETE /api/products/:id
// @desc    Delete product (soft delete)
// @access  Private/Admin
router.delete('/:id', auth, requireAdmin, async (req, res) => {
    try {
        console.log('🗑️ Deleting product:', req.params.id);
        
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                message: 'Produit non trouvé'
            });
        }
        
        // Soft delete - just mark as inactive
        product.actif = false;
        product.dateMiseAJour = new Date();
        
        await product.save();
        console.log('✅ Product soft deleted:', product._id);
        
        res.json({
            message: 'Produit supprimé avec succès'
        });
        
    } catch (error) {
        console.error('❌ Product deletion error:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                message: 'ID de produit invalide'
            });
        }
        res.status(500).json({
            message: 'Erreur lors de la suppression du produit',
            error: error.message
        });
    }
});

// @route   GET /api/products/featured/all
// @desc    Get featured products
// @access  Public
router.get('/featured/all', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 8;
        
        const products = await Product.find({ 
            enVedette: true, 
            actif: true 
        })
        .limit(limit)
        .sort({ dateAjout: -1 })
        .lean();
        
        res.json(products);
        
    } catch (error) {
        console.error('❌ Featured products error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des produits vedette',
            error: error.message
        });
    }
});

// @route   GET /api/products/promotions/all
// @desc    Get promotional products
// @access  Public
router.get('/promotions/all', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 8;
        
        const products = await Product.find({ 
            enPromotion: true, 
            actif: true 
        })
        .limit(limit)
        .sort({ dateAjout: -1 })
        .lean();
        
        res.json(products);
        
    } catch (error) {
        console.error('❌ Promotional products error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des produits en promotion',
            error: error.message
        });
    }
});

// @route   GET /api/products/categories/all
// @desc    Get all product categories
// @access  Public
router.get('/categories/all', async (req, res) => {
    try {
        const categories = await Product.distinct('categorie', { actif: true });
        
        const categoriesWithCount = await Promise.all(
            categories.map(async (category) => {
                const count = await Product.countDocuments({ 
                    categorie: category, 
                    actif: true 
                });
                return { nom: category, count };
            })
        );
        
        res.json(categoriesWithCount);
        
    } catch (error) {
        console.error('❌ Categories fetch error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des catégories',
            error: error.message
        });
    }
});

// @route   PATCH /api/products/:id/stock
// @desc    Update product stock
// @access  Private/Admin
router.patch('/:id/stock', auth, requireAdmin, async (req, res) => {
    try {
        const { stock, operation = 'set' } = req.body;
        
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                message: 'Produit non trouvé'
            });
        }
        
        let newStock;
        switch (operation) {
            case 'add':
                newStock = product.stock + parseInt(stock);
                break;
            case 'subtract':
                newStock = Math.max(0, product.stock - parseInt(stock));
                break;
            case 'set':
            default:
                newStock = parseInt(stock);
                break;
        }
        
        product.stock = newStock;
        product.dateMiseAJour = new Date();
        
        await product.save();
        
        res.json({
            message: 'Stock mis à jour avec succès',
            product: product
        });
        
    } catch (error) {
        console.error('❌ Stock update error:', error);
        res.status(500).json({
            message: 'Erreur lors de la mise à jour du stock',
            error: error.message
        });
    }
});

module.exports = router;
