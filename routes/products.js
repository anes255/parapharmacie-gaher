const express = require('express');
const Product = require('../models/Product');
const { auth, adminAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Helper function to build product filter
const buildProductFilter = (query) => {
    const filter = { actif: true };
    
    if (query.categorie) {
        filter.categorie = query.categorie;
    }
    
    if (query.sousCategorie) {
        filter.sousCategorie = query.sousCategorie;
    }
    
    if (query.marque) {
        filter.marque = new RegExp(query.marque, 'i');
    }
    
    if (query.enPromotion === 'true') {
        filter.enPromotion = true;
    }
    
    if (query.enVedette === 'true') {
        filter.enVedette = true;
    }
    
    if (query.enStock === 'true') {
        filter.stock = { $gt: 0 };
    }
    
    if (query.prixMin || query.prixMax) {
        filter.prix = {};
        if (query.prixMin) filter.prix.$gte = parseFloat(query.prixMin);
        if (query.prixMax) filter.prix.$lte = parseFloat(query.prixMax);
    }
    
    if (query.search) {
        const searchRegex = new RegExp(query.search, 'i');
        filter.$or = [
            { nom: searchRegex },
            { description: searchRegex },
            { marque: searchRegex },
            { ingredients: searchRegex },
            { sousCategorie: searchRegex }
        ];
    }
    
    return filter;
};

// Helper function to build sort options
const buildSortOptions = (sortBy, sortOrder = 'asc') => {
    const validSortFields = ['nom', 'prix', 'dateAjout', 'stock', 'marque'];
    const validOrders = ['asc', 'desc'];
    
    if (!validSortFields.includes(sortBy)) {
        sortBy = 'dateAjout';
    }
    
    if (!validOrders.includes(sortOrder)) {
        sortOrder = 'desc';
    }
    
    return { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
};

// @route   GET /api/products
// @desc    Get all products with filtering, pagination, and sorting
// @access  Public
router.get('/', optionalAuth, async (req, res) => {
    try {
        console.log('📦 Products fetch request:', req.query);
        
        // Extract query parameters
        const {
            page = 1,
            limit = 20,
            sortBy = 'dateAjout',
            sortOrder = 'desc',
            ...filterParams
        } = req.query;
        
        // Build filter and sort options
        const filter = buildProductFilter(filterParams);
        const sortOptions = buildSortOptions(sortBy, sortOrder);
        
        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = Math.min(parseInt(limit), 100); // Max 100 items per page
        
        // Execute query
        const [products, totalProducts] = await Promise.all([
            Product.find(filter)
                .sort(sortOptions)
                .skip(skip)
                .limit(limitNum)
                .lean(),
            Product.countDocuments(filter)
        ]);
        
        // Calculate pagination info
        const totalPages = Math.ceil(totalProducts / limitNum);
        const hasNextPage = parseInt(page) < totalPages;
        const hasPrevPage = parseInt(page) > 1;
        
        console.log(`✅ Found ${products.length} products (${totalProducts} total)`);
        
        res.json({
            success: true,
            products,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalProducts,
                productsPerPage: limitNum,
                hasNextPage,
                hasPrevPage,
                nextPage: hasNextPage ? parseInt(page) + 1 : null,
                prevPage: hasPrevPage ? parseInt(page) - 1 : null
            },
            filters: {
                categorie: filterParams.categorie || null,
                search: filterParams.search || null,
                priceRange: {
                    min: filterParams.prixMin ? parseFloat(filterParams.prixMin) : null,
                    max: filterParams.prixMax ? parseFloat(filterParams.prixMax) : null
                }
            },
            sort: {
                field: sortBy,
                order: sortOrder
            }
        });
        
    } catch (error) {
        console.error('❌ Products fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement des produits'
        });
    }
});

// @route   GET /api/products/categories
// @desc    Get all product categories with counts
// @access  Public
router.get('/categories', async (req, res) => {
    try {
        console.log('📂 Categories request');
        
        const categories = await Product.aggregate([
            { $match: { actif: true } },
            {
                $group: {
                    _id: '$categorie',
                    count: { $sum: 1 },
                    avgPrice: { $avg: '$prix' },
                    minPrice: { $min: '$prix' },
                    maxPrice: { $max: '$prix' },
                    promotionCount: {
                        $sum: { $cond: ['$enPromotion', 1, 0] }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        
        console.log(`✅ Found ${categories.length} categories`);
        
        res.json({
            success: true,
            categories: categories.map(cat => ({
                nom: cat._id,
                count: cat.count,
                avgPrice: Math.round(cat.avgPrice),
                minPrice: cat.minPrice,
                maxPrice: cat.maxPrice,
                promotionCount: cat.promotionCount
            }))
        });
        
    } catch (error) {
        console.error('❌ Categories fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement des catégories'
        });
    }
});

// @route   GET /api/products/featured
// @desc    Get featured products
// @access  Public
router.get('/featured', async (req, res) => {
    try {
        console.log('⭐ Featured products request');
        
        const limit = Math.min(parseInt(req.query.limit) || 8, 20);
        
        const products = await Product.find({
            actif: true,
            enVedette: true,
            stock: { $gt: 0 }
        })
        .sort({ dateAjout: -1 })
        .limit(limit)
        .lean();
        
        console.log(`✅ Found ${products.length} featured products`);
        
        res.json({
            success: true,
            products,
            count: products.length
        });
        
    } catch (error) {
        console.error('❌ Featured products error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement des produits vedettes'
        });
    }
});

// @route   GET /api/products/promotions
// @desc    Get products on promotion
// @access  Public
router.get('/promotions', async (req, res) => {
    try {
        console.log('🏷️ Promotion products request');
        
        const limit = Math.min(parseInt(req.query.limit) || 8, 20);
        
        const products = await Product.find({
            actif: true,
            enPromotion: true,
            stock: { $gt: 0 }
        })
        .sort({ pourcentagePromotion: -1, dateAjout: -1 })
        .limit(limit)
        .lean();
        
        console.log(`✅ Found ${products.length} promotion products`);
        
        res.json({
            success: true,
            products,
            count: products.length
        });
        
    } catch (error) {
        console.error('❌ Promotion products error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement des promotions'
        });
    }
});

// @route   GET /api/products/search
// @desc    Search products
// @access  Public
router.get('/search', async (req, res) => {
    try {
        const { q: query, limit = 10 } = req.query;
        
        if (!query || query.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'La recherche doit contenir au moins 2 caractères'
            });
        }
        
        console.log('🔍 Search request for:', query);
        
        const searchRegex = new RegExp(query.trim(), 'i');
        const limitNum = Math.min(parseInt(limit), 50);
        
        const products = await Product.find({
            actif: true,
            $or: [
                { nom: searchRegex },
                { description: searchRegex },
                { marque: searchRegex },
                { ingredients: searchRegex },
                { sousCategorie: searchRegex }
            ]
        })
        .sort({ enVedette: -1, nom: 1 })
        .limit(limitNum)
        .lean();
        
        console.log(`✅ Search found ${products.length} results`);
        
        res.json({
            success: true,
            query: query.trim(),
            products,
            count: products.length
        });
        
    } catch (error) {
        console.error('❌ Search error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la recherche'
        });
    }
});

// @route   GET /api/products/:id
// @desc    Get single product by ID
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        console.log('📦 Single product request:', req.params.id);
        
        const product = await Product.findById(req.params.id).lean();
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Produit non trouvé'
            });
        }
        
        if (!product.actif) {
            return res.status(404).json({
                success: false,
                message: 'Produit non disponible'
            });
        }
        
        // Get related products from same category
        const relatedProducts = await Product.find({
            _id: { $ne: product._id },
            categorie: product.categorie,
            actif: true
        })
        .sort({ enVedette: -1, dateAjout: -1 })
        .limit(4)
        .lean();
        
        console.log(`✅ Product found: ${product.nom}`);
        
        res.json({
            success: true,
            product,
            relatedProducts,
            meta: {
                inStock: product.stock > 0,
                isPromotion: product.enPromotion,
                isFeatured: product.enVedette,
                category: product.categorie,
                brand: product.marque
            }
        });
        
    } catch (error) {
        console.error('❌ Single product error:', error);
        
        if (error.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: 'Produit non trouvé'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement du produit'
        });
    }
});

// @route   POST /api/products
// @desc    Create new product (Admin only)
// @access  Private/Admin
router.post('/', adminAuth, async (req, res) => {
    try {
        console.log('➕ Product creation request by:', req.user.email);
        
        const productData = req.body;
        
        // Validate required fields
        const requiredFields = ['nom', 'description', 'prix', 'categorie', 'stock'];
        const missingFields = requiredFields.filter(field => !productData[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Champs manquants requis',
                missingFields
            });
        }
        
        // Validate data types and ranges
        if (productData.prix <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Le prix doit être supérieur à 0'
            });
        }
        
        if (productData.stock < 0) {
            return res.status(400).json({
                success: false,
                message: 'Le stock ne peut pas être négatif'
            });
        }
        
        // Create product
        const product = new Product({
            ...productData,
            dateAjout: new Date()
        });
        
        await product.save();
        
        console.log('✅ Product created:', product.nom, 'by', req.user.email);
        
        res.status(201).json({
            success: true,
            message: 'Produit créé avec succès',
            product
        });
        
    } catch (error) {
        console.error('❌ Product creation error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Données invalides',
                errors: messages
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création du produit'
        });
    }
});

// @route   PUT /api/products/:id
// @desc    Update product (Admin only)
// @access  Private/Admin
router.put('/:id', adminAuth, async (req, res) => {
    try {
        console.log('📝 Product update request:', req.params.id, 'by:', req.user.email);
        
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Produit non trouvé'
            });
        }
        
        const updateData = req.body;
        
        // Validate price if provided
        if (updateData.prix !== undefined && updateData.prix <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Le prix doit être supérieur à 0'
            });
        }
        
        // Validate stock if provided
        if (updateData.stock !== undefined && updateData.stock < 0) {
            return res.status(400).json({
                success: false,
                message: 'Le stock ne peut pas être négatif'
            });
        }
        
        // Update product
        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined) {
                product[key] = updateData[key];
            }
        });
        
        await product.save();
        
        console.log('✅ Product updated:', product.nom, 'by', req.user.email);
        
        res.json({
            success: true,
            message: 'Produit mis à jour avec succès',
            product
        });
        
    } catch (error) {
        console.error('❌ Product update error:', error);
        
        if (error.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: 'Produit non trouvé'
            });
        }
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Données invalides',
                errors: messages
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour du produit'
        });
    }
});

// @route   DELETE /api/products/:id
// @desc    Delete product (Admin only)
// @access  Private/Admin
router.delete('/:id', adminAuth, async (req, res) => {
    try {
        console.log('🗑️ Product deletion request:', req.params.id, 'by:', req.user.email);
        
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Produit non trouvé'
            });
        }
        
        // Soft delete by setting actif to false
        product.actif = false;
        await product.save();
        
        console.log('✅ Product soft deleted:', product.nom, 'by', req.user.email);
        
        res.json({
            success: true,
            message: 'Produit supprimé avec succès'
        });
        
    } catch (error) {
        console.error('❌ Product deletion error:', error);
        
        if (error.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: 'Produit non trouvé'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression du produit'
        });
    }
});

// @route   PATCH /api/products/:id/toggle-featured
// @desc    Toggle product featured status (Admin only)
// @access  Private/Admin
router.patch('/:id/toggle-featured', adminAuth, async (req, res) => {
    try {
        console.log('⭐ Toggle featured request:', req.params.id, 'by:', req.user.email);
        
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Produit non trouvé'
            });
        }
        
        product.enVedette = !product.enVedette;
        await product.save();
        
        console.log(`✅ Product ${product.enVedette ? 'added to' : 'removed from'} featured:`, product.nom);
        
        res.json({
            success: true,
            message: `Produit ${product.enVedette ? 'ajouté aux' : 'retiré des'} coups de cœur`,
            featured: product.enVedette,
            product: {
                id: product._id,
                nom: product.nom,
                enVedette: product.enVedette
            }
        });
        
    } catch (error) {
        console.error('❌ Toggle featured error:', error);
        
        if (error.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: 'Produit non trouvé'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la modification du statut vedette'
        });
    }
});

// @route   PATCH /api/products/:id/toggle-promotion
// @desc    Toggle product promotion status (Admin only)
// @access  Private/Admin
router.patch('/:id/toggle-promotion', adminAuth, async (req, res) => {
    try {
        console.log('🏷️ Toggle promotion request:', req.params.id, 'by:', req.user.email);
        
        const { pourcentagePromotion, prixOriginal } = req.body;
        
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Produit non trouvé'
            });
        }
        
        if (!product.enPromotion) {
            // Enable promotion
            if (!prixOriginal || prixOriginal <= product.prix) {
                return res.status(400).json({
                    success: false,
                    message: 'Le prix original doit être supérieur au prix actuel'
                });
            }
            
            product.enPromotion = true;
            product.prixOriginal = prixOriginal;
            product.pourcentagePromotion = pourcentagePromotion || Math.round((prixOriginal - product.prix) / prixOriginal * 100);
        } else {
            // Disable promotion
            product.enPromotion = false;
            product.prixOriginal = null;
            product.pourcentagePromotion = 0;
        }
        
        await product.save();
        
        console.log(`✅ Product promotion ${product.enPromotion ? 'enabled' : 'disabled'}:`, product.nom);
        
        res.json({
            success: true,
            message: `Promotion ${product.enPromotion ? 'activée' : 'désactivée'} pour le produit`,
            promotion: product.enPromotion,
            product: {
                id: product._id,
                nom: product.nom,
                prix: product.prix,
                prixOriginal: product.prixOriginal,
                pourcentagePromotion: product.pourcentagePromotion,
                enPromotion: product.enPromotion
            }
        });
        
    } catch (error) {
        console.error('❌ Toggle promotion error:', error);
        
        if (error.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: 'Produit non trouvé'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la modification de la promotion'
        });
    }
});

module.exports = router;
