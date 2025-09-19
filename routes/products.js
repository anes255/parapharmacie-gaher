const express = require('express');
const Product = require('../models/Product');
const { auth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// PUBLIC ROUTES (no auth required)

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
        
        console.log(`✅ Products retrieved: ${products.length}/${total} total`);
        
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
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des produits' });
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
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'ID de produit invalide' });
        }
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Obtenir les catégories
router.get('/categories/all', async (req, res) => {
    try {
        const categories = await Product.distinct('categorie', { actif: true });
        
        const categoriesInfo = [
            { nom: 'Vitalité', description: 'Vitamines et suppléments alimentaires', icon: 'fa-seedling' },
            { nom: 'Sport', description: 'Nutrition sportive', icon: 'fa-dumbbell' },
            { nom: 'Cheveux', description: 'Soins capillaires', icon: 'fa-cut' },
            { nom: 'Visage', description: 'Soins du visage', icon: 'fa-smile' },
            { nom: 'Intime', description: 'Hygiène intime', icon: 'fa-heart' },
            { nom: 'Solaire', description: 'Protection solaire', icon: 'fa-sun' },
            { nom: 'Soins', description: 'Soins corporels', icon: 'fa-spa' },
            { nom: 'Bébé', description: 'Soins pour bébés', icon: 'fa-baby-carriage' },
            { nom: 'Homme', description: 'Soins pour hommes', icon: 'fa-user-tie' },
            { nom: 'Dentaire', description: 'Hygiène dentaire', icon: 'fa-tooth' }
        ];
        
        // Only return categories that have products
        const availableCategories = categoriesInfo.filter(cat => 
            categories.includes(cat.nom)
        );
        
        res.json(availableCategories);
        
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
        
        console.log(`✅ Featured products: ${products.length}`);
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
        
        console.log(`✅ Promotion products: ${products.length}`);
        res.json(products);
        
    } catch (error) {
        console.error('Erreur produits promotion:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// ADMIN ROUTES (require authentication and admin role)

// @route   POST /api/products
// @desc    Create new product (Admin only)
// @access  Private/Admin
router.post('/', [auth, requireAdmin], async (req, res) => {
    try {
        console.log('📦 Creating new product:', req.body);
        
        // Extract and validate required fields
        const {
            nom,
            description,
            prix,
            stock,
            categorie,
            marque,
            prixOriginal,
            ingredients,
            modeEmploi,
            precautions,
            enVedette,
            enPromotion,
            actif,
            image
        } = req.body;
        
        // Validate required fields
        if (!nom || !description || prix === undefined || stock === undefined || !categorie) {
            console.error('❌ Missing required fields:', { nom: !!nom, description: !!description, prix: prix !== undefined, stock: stock !== undefined, categorie: !!categorie });
            return res.status(400).json({
                message: 'Champs obligatoires manquants: nom, description, prix, stock, catégorie',
                received: { nom, description, prix, stock, categorie }
            });
        }
        
        // Validate data types and ranges
        const prixNum = parseFloat(prix);
        const stockNum = parseInt(stock);
        const prixOriginalNum = prixOriginal ? parseFloat(prixOriginal) : null;
        
        if (isNaN(prixNum) || prixNum < 0) {
            return res.status(400).json({
                message: 'Le prix doit être un nombre positif'
            });
        }
        
        if (isNaN(stockNum) || stockNum < 0) {
            return res.status(400).json({
                message: 'Le stock doit être un nombre entier positif'
            });
        }
        
        if (prixOriginalNum && (isNaN(prixOriginalNum) || prixOriginalNum < 0)) {
            return res.status(400).json({
                message: 'Le prix original doit être un nombre positif'
            });
        }
        
        // Validate category
        const validCategories = [
            'Vitalité', 'Sport', 'Visage', 'Cheveux', 'Solaire', 
            'Intime', 'Soins', 'Bébé', 'Homme', 'Dentaire'
        ];
        
        if (!validCategories.includes(categorie)) {
            return res.status(400).json({
                message: 'Catégorie invalide',
                validCategories
            });
        }
        
        // Prepare product data
        const productData = {
            nom: nom.trim(),
            description: description.trim(),
            prix: prixNum,
            stock: stockNum,
            categorie,
            marque: marque ? marque.trim() : '',
            ingredients: ingredients ? ingredients.trim() : '',
            modeEmploi: modeEmploi ? modeEmploi.trim() : '',
            precautions: precautions ? precautions.trim() : '',
            enVedette: Boolean(enVedette),
            enPromotion: Boolean(enPromotion),
            actif: actif !== false, // Default to true
            image: image || '',
            dateAjout: new Date()
        };
        
        // Add optional fields
        if (prixOriginalNum) {
            productData.prixOriginal = prixOriginalNum;
            
            // Calculate discount percentage if in promotion
            if (productData.enPromotion && prixOriginalNum > prixNum) {
                productData.pourcentagePromotion = Math.round(
                    ((prixOriginalNum - prixNum) / prixOriginalNum) * 100
                );
            }
        }
        
        console.log('📦 Final product data:', productData);
        
        // Create and save product
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
                message: messages[0] || 'Données de produit invalides',
                errors: messages,
                details: error.errors
            });
        }
        
        if (error.code === 11000) {
            return res.status(400).json({
                message: 'Un produit avec ce nom existe déjà'
            });
        }
        
        res.status(500).json({
            message: 'Erreur serveur lors de la création du produit',
            error: error.message
        });
    }
});

// @route   PUT /api/products/:id
// @desc    Update product (Admin only)
// @access  Private/Admin
router.put('/:id', [auth, requireAdmin], async (req, res) => {
    try {
        console.log('📦 Updating product:', req.params.id);
        
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                message: 'Produit non trouvé'
            });
        }
        
        // Extract fields from request body
        const {
            nom,
            description,
            prix,
            stock,
            categorie,
            marque,
            prixOriginal,
            ingredients,
            modeEmploi,
            precautions,
            enVedette,
            enPromotion,
            actif,
            image
        } = req.body;
        
        // Update fields if provided
        if (nom !== undefined) product.nom = nom.trim();
        if (description !== undefined) product.description = description.trim();
        if (prix !== undefined) {
            const prixNum = parseFloat(prix);
            if (isNaN(prixNum) || prixNum < 0) {
                return res.status(400).json({
                    message: 'Le prix doit être un nombre positif'
                });
            }
            product.prix = prixNum;
        }
        if (stock !== undefined) {
            const stockNum = parseInt(stock);
            if (isNaN(stockNum) || stockNum < 0) {
                return res.status(400).json({
                    message: 'Le stock doit être un nombre entier positif'
                });
            }
            product.stock = stockNum;
        }
        if (categorie !== undefined) product.categorie = categorie;
        if (marque !== undefined) product.marque = marque ? marque.trim() : '';
        if (prixOriginal !== undefined) {
            if (prixOriginal) {
                const prixOriginalNum = parseFloat(prixOriginal);
                if (isNaN(prixOriginalNum) || prixOriginalNum < 0) {
                    return res.status(400).json({
                        message: 'Le prix original doit être un nombre positif'
                    });
                }
                product.prixOriginal = prixOriginalNum;
            } else {
                product.prixOriginal = null;
            }
        }
        if (ingredients !== undefined) product.ingredients = ingredients ? ingredients.trim() : '';
        if (modeEmploi !== undefined) product.modeEmploi = modeEmploi ? modeEmploi.trim() : '';
        if (precautions !== undefined) product.precautions = precautions ? precautions.trim() : '';
        if (enVedette !== undefined) product.enVedette = Boolean(enVedette);
        if (enPromotion !== undefined) product.enPromotion = Boolean(enPromotion);
        if (actif !== undefined) product.actif = Boolean(actif);
        if (image !== undefined) product.image = image || '';
        
        // Recalculate promotion percentage if applicable
        if (product.enPromotion && product.prixOriginal && product.prixOriginal > product.prix) {
            product.pourcentagePromotion = Math.round(
                ((product.prixOriginal - product.prix) / product.prixOriginal) * 100
            );
        } else if (!product.enPromotion) {
            product.pourcentagePromotion = 0;
        }
        
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
                message: messages[0] || 'Données de produit invalides',
                errors: messages
            });
        }
        
        if (error.name === 'CastError') {
            return res.status(400).json({
                message: 'ID de produit invalide'
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
router.delete('/:id', [auth, requireAdmin], async (req, res) => {
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
            message: 'Produit supprimé avec succès',
            productId: req.params.id
        });
        
    } catch (error) {
        console.error('❌ Product deletion error:', error);
        
        if (error.name === 'CastError') {
            return res.status(400).json({
                message: 'ID de produit invalide'
            });
        }
        
        res.status(500).json({
            message: 'Erreur lors de la suppression du produit'
        });
    }
});

// @route   PATCH /api/products/:id/toggle-featured
// @desc    Toggle featured status (Admin only)
// @access  Private/Admin
router.patch('/:id/toggle-featured', [auth, requireAdmin], async (req, res) => {
    try {
        console.log('⭐ Toggling featured status for product:', req.params.id);
        
        const { enVedette } = req.body;
        
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                message: 'Produit non trouvé'
            });
        }
        
        product.enVedette = enVedette !== undefined ? Boolean(enVedette) : !product.enVedette;
        await product.save();
        
        console.log(`✅ Product featured status updated: ${product._id} -> ${product.enVedette}`);
        
        res.json({
            message: `Produit ${product.enVedette ? 'ajouté aux' : 'retiré des'} coups de cœur`,
            product: {
                _id: product._id,
                nom: product.nom,
                enVedette: product.enVedette
            }
        });
        
    } catch (error) {
        console.error('❌ Toggle featured error:', error);
        
        if (error.name === 'CastError') {
            return res.status(400).json({
                message: 'ID de produit invalide'
            });
        }
        
        res.status(500).json({
            message: 'Erreur lors de la modification'
        });
    }
});

// @route   PATCH /api/products/:id/stock
// @desc    Update product stock (Admin only)
// @access  Private/Admin
router.patch('/:id/stock', [auth, requireAdmin], async (req, res) => {
    try {
        const { stock, operation } = req.body; // operation can be 'set', 'add', 'subtract'
        
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                message: 'Produit non trouvé'
            });
        }
        
        const stockNum = parseInt(stock);
        if (isNaN(stockNum)) {
            return res.status(400).json({
                message: 'Le stock doit être un nombre entier'
            });
        }
        
        switch (operation) {
            case 'set':
                product.stock = Math.max(0, stockNum);
                break;
            case 'add':
                product.stock += stockNum;
                break;
            case 'subtract':
                product.stock = Math.max(0, product.stock - stockNum);
                break;
            default:
                product.stock = Math.max(0, stockNum);
        }
        
        await product.save();
        
        console.log(`✅ Product stock updated: ${product._id} -> ${product.stock}`);
        
        res.json({
            message: 'Stock mis à jour avec succès',
            product: {
                _id: product._id,
                nom: product.nom,
                stock: product.stock
            }
        });
        
    } catch (error) {
        console.error('❌ Stock update error:', error);
        res.status(500).json({
            message: 'Erreur lors de la mise à jour du stock'
        });
    }
});

module.exports = router;
