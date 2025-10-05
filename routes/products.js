const express = require('express');
const Product = require('../models/Product');
const { auth, requireAdmin } = require('../middleware/auth'); // FIXED: Destructure the import

const router = express.Router();

// ============================================================================
// GET ROUTES (Public)
// ============================================================================

// Obtenir tous les produits avec filtres et pagination
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
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
        
        res.json({ product });
        
    } catch (error) {
        console.error('Erreur récupération produit:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// ============================================================================
// ADMIN ROUTES (Protected - require authentication + admin role)
// ============================================================================

// CREATE - Ajouter un nouveau produit
router.post('/', auth, requireAdmin, async (req, res) => {
    try {
        const productData = {
            nom: req.body.nom,
            description: req.body.description || '',
            categorie: req.body.categorie,
            prix: req.body.prix,
            prixOriginal: req.body.prixOriginal || null,
            pourcentagePromotion: req.body.pourcentagePromotion || null,
            stock: req.body.stock,
            marque: req.body.marque || '',
            image: req.body.image || '',
            actif: req.body.actif !== false,
            enVedette: req.body.enVedette || false,
            enPromotion: req.body.enPromotion || false,
            dateAjout: new Date()
        };

        const product = new Product(productData);
        await product.save();

        console.log('✅ Product created:', product._id);
        res.status(201).json({ 
            message: 'Produit créé avec succès',
            product 
        });

    } catch (error) {
        console.error('Erreur création produit:', error);
        res.status(500).json({ 
            message: 'Erreur lors de la création du produit',
            error: error.message 
        });
    }
});

// UPDATE - Modifier un produit
router.put('/:id', auth, requireAdmin, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({ message: 'Produit non trouvé' });
        }

        // Update fields
        product.nom = req.body.nom || product.nom;
        product.description = req.body.description !== undefined ? req.body.description : product.description;
        product.categorie = req.body.categorie || product.categorie;
        product.prix = req.body.prix !== undefined ? req.body.prix : product.prix;
        product.prixOriginal = req.body.prixOriginal !== undefined ? req.body.prixOriginal : product.prixOriginal;
        product.pourcentagePromotion = req.body.pourcentagePromotion !== undefined ? req.body.pourcentagePromotion : product.pourcentagePromotion;
        product.stock = req.body.stock !== undefined ? req.body.stock : product.stock;
        product.marque = req.body.marque !== undefined ? req.body.marque : product.marque;
        product.image = req.body.image !== undefined ? req.body.image : product.image;
        product.actif = req.body.actif !== undefined ? req.body.actif : product.actif;
        product.enVedette = req.body.enVedette !== undefined ? req.body.enVedette : product.enVedette;
        product.enPromotion = req.body.enPromotion !== undefined ? req.body.enPromotion : product.enPromotion;

        await product.save();

        console.log('✅ Product updated:', product._id);
        res.json({ 
            message: 'Produit modifié avec succès',
            product 
        });

    } catch (error) {
        console.error('Erreur modification produit:', error);
        res.status(500).json({ 
            message: 'Erreur lors de la modification du produit',
            error: error.message 
        });
    }
});

// DELETE - Supprimer un produit
router.delete('/:id', auth, requireAdmin, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({ message: 'Produit non trouvé' });
        }

        await Product.findByIdAndDelete(req.params.id);

        console.log('✅ Product deleted:', req.params.id);
        res.json({ 
            message: 'Produit supprimé avec succès',
            deletedId: req.params.id
        });

    } catch (error) {
        console.error('Erreur suppression produit:', error);
        res.status(500).json({ 
            message: 'Erreur lors de la suppression du produit',
            error: error.message 
        });
    }
});

// ============================================================================
// ADDITIONAL ROUTES
// ============================================================================

// Obtenir les catégories
router.get('/categories/all', async (req, res) => {
    try {
        const categories = await Product.distinct('categorie');
        
        const categoriesInfo = [
            { nom: 'Vitalité', description: 'Vitamines & Énergie' },
            { nom: 'Sport', description: 'Nutrition sportive' },
            { nom: 'Visage', description: 'Soins du visage' },
            { nom: 'Cheveux', description: 'Soins capillaires' },
            { nom: 'Solaire', description: 'Protection solaire' },
            { nom: 'Intime', description: 'Hygiène intime' },
            { nom: 'Soins', description: 'Soins corporels' },
            { nom: 'Bébé', description: 'Soins bébé' },
            { nom: 'Homme', description: 'Soins masculins' },
            { nom: 'Dentaire', description: 'Hygiène dentaire' }
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
