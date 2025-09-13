const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const auth = require('../middleware/auth');

const router = express.Router();

// Generate unique order number with timestamp and random component
function generateOrderNumber() {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `CMD-${timestamp.slice(-8)}${random}`;
}

// Create new order
router.post('/', async (req, res) => {
    try {
        console.log('📦 Creating new order...', req.body);
        
        const { produits, total, clientInfo, adresseLivraison, fraisLivraison } = req.body;
        
        // Validation
        if (!produits || produits.length === 0) {
            return res.status(400).json({ message: 'Aucun produit dans la commande' });
        }
        
        if (!clientInfo || !clientInfo.nom || !clientInfo.telephone) {
            return res.status(400).json({ message: 'Informations client manquantes' });
        }
        
        if (!adresseLivraison || !adresseLivraison.adresse || !adresseLivraison.wilaya) {
            return res.status(400).json({ message: 'Adresse de livraison manquante' });
        }
        
        // Generate unique order number with multiple attempts
        let numeroCommande;
        let attempts = 0;
        const maxAttempts = 10;
        
        do {
            numeroCommande = generateOrderNumber();
            const existingOrder = await Order.findOne({ numeroCommande });
            
            if (!existingOrder) {
                break; // Unique number found
            }
            
            attempts++;
            
            if (attempts >= maxAttempts) {
                console.error('❌ Cannot generate unique order number after', maxAttempts, 'attempts');
                return res.status(500).json({ 
                    message: 'Erreur technique lors de la génération du numéro de commande. Veuillez réessayer.' 
                });
            }
            
            // Add small delay to ensure timestamp uniqueness
            await new Promise(resolve => setTimeout(resolve, 10));
            
        } while (true);
        
        console.log('✅ Generated unique order number:', numeroCommande, 'after', attempts + 1, 'attempts');
        
        // Verify product availability and calculate total
        let calculatedTotal = 0;
        let sousTotal = 0;
        
        for (let item of produits) {
            const product = await Product.findById(item.produit);
            
            if (!product) {
                return res.status(400).json({ 
                    message: `Produit non trouvé: ${item.nom || item.produit}` 
                });
            }
            
            if (product.stock < item.quantite) {
                return res.status(400).json({ 
                    message: `Stock insuffisant pour ${product.nom}. Stock disponible: ${product.stock}` 
                });
            }
            
            const itemTotal = product.prix * item.quantite;
            sousTotal += itemTotal;
        }
        
        // Calculate shipping
        const shippingCost = sousTotal >= 5000 ? 0 : (fraisLivraison || 300);
        calculatedTotal = sousTotal + shippingCost;
        
        // Verify total matches
        if (Math.abs(calculatedTotal - total) > 1) { // Allow 1 DA difference for rounding
            console.warn('⚠️ Total mismatch:', { sent: total, calculated: calculatedTotal });
        }
        
        // Create order
        const order = new Order({
            numeroCommande,
            produits: produits.map(item => ({
                produit: item.produit,
                nom: item.nom,
                prix: item.prix,
                quantite: item.quantite,
                image: item.image
            })),
            clientInfo: {
                nom: clientInfo.nom,
                prenom: clientInfo.prenom || '',
                email: clientInfo.email || '',
                telephone: clientInfo.telephone
            },
            adresseLivraison,
            sousTotal,
            fraisLivraison: shippingCost,
            total: calculatedTotal,
            statut: 'en-attente',
            dateCommande: new Date(),
            user: req.user ? req.user.id : null // Link to user if authenticated
        });
        
        // Save order
        await order.save();
        console.log('✅ Order saved successfully:', numeroCommande);
        
        // Update product stock (optional - uncomment if you want to reduce stock immediately)
        // for (let item of produits) {
        //     await Product.findByIdAndUpdate(item.produit, {
        //         $inc: { stock: -item.quantite }
        //     });
        // }
        
        res.status(201).json({
            message: 'Commande créée avec succès',
            numeroCommande,
            order: {
                _id: order._id,
                numeroCommande,
                total: calculatedTotal,
                statut: order.statut,
                dateCommande: order.dateCommande
            }
        });
        
    } catch (error) {
        console.error('❌ Order creation error:', error);
        
        if (error.code === 11000 && error.keyPattern && error.keyPattern.numeroCommande) {
            // Duplicate key error
            return res.status(400).json({ 
                message: 'Numéro de commande déjà existant, veuillez réessayer' 
            });
        }
        
        res.status(500).json({ 
            message: 'Erreur lors de la création de la commande',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get order by number
router.get('/:numeroCommande', async (req, res) => {
    try {
        const order = await Order.findOne({ numeroCommande: req.params.numeroCommande })
            .populate('produits.produit')
            .populate('user', 'nom prenom email');
        
        if (!order) {
            return res.status(404).json({ message: 'Commande non trouvée' });
        }
        
        res.json(order);
        
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Get user orders (protected route)
router.get('/user/all', auth, async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user.id })
            .sort({ dateCommande: -1 })
            .populate('produits.produit');
        
        res.json(orders);
        
    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Update order status (admin only)
router.patch('/:id/status', auth, async (req, res) => {
    try {
        const { statut } = req.body;
        
        // Check if user is admin
        const User = require('../models/User');
        const user = await User.findById(req.user.id);
        
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Accès refusé' });
        }
        
        const validStatuses = ['en-attente', 'confirmée', 'expédiée', 'livrée', 'annulée'];
        
        if (!validStatuses.includes(statut)) {
            return res.status(400).json({ message: 'Statut invalide' });
        }
        
        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { statut, dateModification: new Date() },
            { new: true }
        );
        
        if (!order) {
            return res.status(404).json({ message: 'Commande non trouvée' });
        }
        
        res.json({ message: 'Statut mis à jour', order });
        
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

module.exports = router;
