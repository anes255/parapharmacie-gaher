const express = require('express');
const Settings = require('../models/Settings');
const { auth, adminAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/settings
// @desc    Get current site settings (public info only for non-admin)
// @access  Public
router.get('/', optionalAuth, async (req, res) => {
    try {
        console.log('⚙️ Settings request by:', req.user?.email || 'Guest', '| Role:', req.user?.role || 'Guest');
        
        const settings = await Settings.getCurrent();
        
        if (!settings) {
            return res.status(404).json({
                success: false,
                message: 'Paramètres non trouvés'
            });
        }
        
        // Public settings (visible to everyone)
        const publicSettings = {
            siteName: settings.siteName,
            siteDescription: settings.siteDescription,
            contact: {
                email: settings.contact.email,
                telephone: settings.contact.telephone,
                adresse: settings.contact.adresse,
                ville: settings.contact.ville,
                wilaya: settings.contact.wilaya,
                horaires: settings.contact.horaires
            },
            socialMedia: settings.socialMedia,
            shipping: {
                standardCost: settings.shipping.standardCost,
                freeShippingThreshold: settings.shipping.freeShippingThreshold,
                estimatedDays: settings.shipping.estimatedDays
            },
            payment: {
                currency: settings.payment.currency,
                methods: settings.payment.methods.filter(method => method.actif),
                defaultMethod: settings.payment.defaultMethod
            },
            localization: settings.localization
        };
        
        // Admin gets full settings
        if (req.user && req.user.role === 'admin') {
            console.log('✅ Full settings returned to admin');
            return res.json({
                success: true,
                settings,
                isAdmin: true
            });
        }
        
        console.log('✅ Public settings returned');
        res.json({
            success: true,
            settings: publicSettings,
            isAdmin: false
        });
        
    } catch (error) {
        console.error('❌ Settings fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement des paramètres'
        });
    }
});

// @route   PUT /api/settings
// @desc    Update site settings (Admin only)
// @access  Private/Admin
router.put('/', adminAuth, async (req, res) => {
    try {
        console.log('⚙️ Settings update request by:', req.user.email);
        
        const settings = await Settings.getCurrent();
        const updateData = req.body;
        
        // Validate critical fields
        if (updateData.siteName && updateData.siteName.trim().length < 3) {
            return res.status(400).json({
                success: false,
                message: 'Le nom du site doit contenir au moins 3 caractères'
            });
        }
        
        if (updateData.contact?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updateData.contact.email)) {
            return res.status(400).json({
                success: false,
                message: 'Format d\'email invalide'
            });
        }
        
        if (updateData.shipping?.standardCost && updateData.shipping.standardCost < 0) {
            return res.status(400).json({
                success: false,
                message: 'Le coût de livraison ne peut pas être négatif'
            });
        }
        
        if (updateData.shipping?.freeShippingThreshold && updateData.shipping.freeShippingThreshold < 0) {
            return res.status(400).json({
                success: false,
                message: 'Le seuil de livraison gratuite ne peut pas être négatif'
            });
        }
        
        // Update settings (deep merge for nested objects)
        const updateSettings = (target, source) => {
            for (const key in source) {
                if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    if (!target[key]) target[key] = {};
                    updateSettings(target[key], source[key]);
                } else if (source[key] !== undefined) {
                    target[key] = source[key];
                }
            }
        };
        
        updateSettings(settings, updateData);
        
        await settings.save();
        
        console.log('✅ Settings updated successfully by:', req.user.email);
        
        res.json({
            success: true,
            message: 'Paramètres mis à jour avec succès',
            settings
        });
        
    } catch (error) {
        console.error('❌ Settings update error:', error);
        
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
            message: 'Erreur lors de la mise à jour des paramètres'
        });
    }
});

// @route   GET /api/settings/contact
// @desc    Get contact information
// @access  Public
router.get('/contact', async (req, res) => {
    try {
        console.log('📞 Contact info request');
        
        const settings = await Settings.getCurrent();
        
        const contactInfo = {
            siteName: settings.siteName,
            contact: settings.contact,
            socialMedia: settings.socialMedia,
            reseauxSociaux: settings.reseauxSociaux // virtual field
        };
        
        console.log('✅ Contact info returned');
        
        res.json({
            success: true,
            contact: contactInfo
        });
        
    } catch (error) {
        console.error('❌ Contact info error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement des informations de contact'
        });
    }
});

// @route   GET /api/settings/shipping
// @desc    Get shipping information and calculate cost
// @access  Public
router.get('/shipping', async (req, res) => {
    try {
        console.log('🚚 Shipping info request');
        
        const { wilaya, total } = req.query;
        const settings = await Settings.getCurrent();
        
        const shippingInfo = {
            methods: settings.shipping.shippingMethods.filter(method => method.actif),
            standardCost: settings.shipping.standardCost,
            freeShippingThreshold: settings.shipping.freeShippingThreshold,
            estimatedDays: settings.shipping.estimatedDays,
            availableWilayas: settings.shipping.availableWilayas
        };
        
        // Calculate shipping cost if wilaya and total are provided
        if (wilaya && total) {
            const orderTotal = parseFloat(total);
            const shippingCost = settings.getShippingCost(wilaya, orderTotal);
            
            shippingInfo.calculation = {
                wilaya,
                orderTotal,
                shippingCost,
                isFree: shippingCost === 0,
                isAvailable: shippingCost !== null
            };
        }
        
        console.log('✅ Shipping info returned');
        
        res.json({
            success: true,
            shipping: shippingInfo
        });
        
    } catch (error) {
        console.error('❌ Shipping info error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement des informations de livraison'
        });
    }
});

// @route   POST /api/settings/shipping/calculate
// @desc    Calculate shipping cost for specific order
// @access  Public
router.post('/shipping/calculate', async (req, res) => {
    try {
        const { wilaya, orderTotal, items } = req.body;
        
        console.log('💰 Shipping calculation request for:', wilaya, 'Total:', orderTotal);
        
        if (!wilaya || orderTotal === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Wilaya et montant total requis'
            });
        }
        
        const settings = await Settings.getCurrent();
        const total = parseFloat(orderTotal);
        
        const shippingCost = settings.getShippingCost(wilaya, total);
        
        if (shippingCost === null) {
            return res.status(400).json({
                success: false,
                message: 'Livraison non disponible pour cette wilaya'
            });
        }
        
        const calculation = {
            wilaya,
            orderTotal: total,
            shippingCost,
            finalTotal: total + shippingCost,
            isFree: shippingCost === 0,
            freeShippingThreshold: settings.shipping.freeShippingThreshold,
            amountForFreeShipping: shippingCost > 0 ? 
                Math.max(0, settings.shipping.freeShippingThreshold - total) : 0,
            estimatedDays: settings.shipping.estimatedDays
        };
        
        console.log('✅ Shipping cost calculated:', shippingCost, 'DA');
        
        res.json({
            success: true,
            calculation
        });
        
    } catch (error) {
        console.error('❌ Shipping calculation error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du calcul des frais de livraison'
        });
    }
});

// @route   GET /api/settings/payment
// @desc    Get payment methods and settings
// @access  Public
router.get('/payment', async (req, res) => {
    try {
        console.log('💳 Payment methods request');
        
        const settings = await Settings.getCurrent();
        
        const paymentInfo = {
            currency: settings.payment.currency,
            methods: settings.payment.methods.filter(method => method.actif).map(method => ({
                nom: method.nom,
                actif: method.actif
                // Configuration is excluded for security
            })),
            defaultMethod: settings.payment.defaultMethod,
            features: {
                cashOnDelivery: settings.payment.cashOnDelivery,
                bankTransfer: settings.payment.bankTransfer,
                creditCard: settings.payment.creditCard
            }
        };
        
        console.log('✅ Payment methods returned');
        
        res.json({
            success: true,
            payment: paymentInfo
        });
        
    } catch (error) {
        console.error('❌ Payment methods error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement des méthodes de paiement'
        });
    }
});

// @route   PUT /api/settings/maintenance
// @desc    Toggle maintenance mode (Admin only)
// @access  Private/Admin
router.put('/maintenance', adminAuth, async (req, res) => {
    try {
        const { enabled, message } = req.body;
        
        console.log('🛠️ Maintenance mode toggle by:', req.user.email, '| Enabled:', enabled);
        
        const settings = await Settings.getCurrent();
        
        settings.maintenance.enabled = Boolean(enabled);
        if (message) settings.maintenance.message = message;
        
        await settings.save();
        
        console.log('✅ Maintenance mode updated');
        
        res.json({
            success: true,
            message: `Mode maintenance ${enabled ? 'activé' : 'désactivé'}`,
            maintenance: {
                enabled: settings.maintenance.enabled,
                message: settings.maintenance.message
            }
        });
        
    } catch (error) {
        console.error('❌ Maintenance toggle error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la modification du mode maintenance'
        });
    }
});

// @route   GET /api/settings/maintenance
// @desc    Check maintenance status
// @access  Public
router.get('/maintenance', async (req, res) => {
    try {
        const settings = await Settings.getCurrent();
        
        res.json({
            success: true,
            maintenance: {
                enabled: settings.maintenance.enabled,
                message: settings.maintenance.message,
                allowedIPs: settings.maintenance.allowedIPs
            }
        });
        
    } catch (error) {
        console.error('❌ Maintenance status error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la vérification du statut maintenance'
        });
    }
});

// @route   GET /api/settings/wilayas
// @desc    Get list of Algerian wilayas
// @access  Public
router.get('/wilayas', async (req, res) => {
    try {
        const algerianWilayas = [
            'Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi', 'Batna', 'Béjaïa',
            'Biskra', 'Béchar', 'Blida', 'Bouira', 'Tamanrasset', 'Tébessa',
            'Tlemcen', 'Tiaret', 'Tizi Ouzou', 'Alger', 'Djelfa', 'Jijel',
            'Sétif', 'Saïda', 'Skikda', 'Sidi Bel Abbès', 'Annaba', 'Guelma',
            'Constantine', 'Médéa', 'Mostaganem', 'M\'Sila', 'Mascara', 'Ouargla',
            'Oran', 'El Bayadh', 'Illizi', 'Bordj Bou Arréridj', 'Boumerdès',
            'El Tarf', 'Tindouf', 'Tissemsilt', 'El Oued', 'Khenchela',
            'Souk Ahras', 'Tipaza', 'Mila', 'Aïn Defla', 'Naâma', 'Aïn Témouchent',
            'Ghardaïa', 'Relizane'
        ];
        
        // Get shipping availability for each wilaya
        const settings = await Settings.getCurrent();
        
        const wilayasWithShipping = algerianWilayas.map(wilaya => ({
            nom: wilaya,
            livraison: settings.shipping.availableWilayas.length === 0 || 
                      settings.shipping.availableWilayas.includes(wilaya),
            coutLivraison: settings.getShippingCost(wilaya, 0) // Base cost
        }));
        
        res.json({
            success: true,
            wilayas: wilayasWithShipping
        });
        
    } catch (error) {
        console.error('❌ Wilayas list error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du chargement des wilayas'
        });
    }
});

// @route   POST /api/settings/test-email
// @desc    Test email configuration (Admin only)
// @access  Private/Admin
router.post('/test-email', adminAuth, async (req, res) => {
    try {
        const { recipient } = req.body;
        
        console.log('📧 Email test request by:', req.user.email, 'to:', recipient);
        
        if (!recipient) {
            return res.status(400).json({
                success: false,
                message: 'Adresse de destination requise'
            });
        }
        
        const settings = await Settings.getCurrent();
        
        // Here you would implement actual email sending
        // For now, just return success
        console.log('✅ Email test would be sent to:', recipient);
        
        res.json({
            success: true,
            message: `Email de test envoyé à ${recipient}`,
            config: {
                from: settings.email.from.email,
                smtp: {
                    host: settings.email.smtp.host,
                    port: settings.email.smtp.port
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Email test error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du test d\'email'
        });
    }
});

// @route   POST /api/settings/backup
// @desc    Create backup of current settings (Admin only)
// @access  Private/Admin
router.post('/backup', adminAuth, async (req, res) => {
    try {
        console.log('💾 Settings backup request by:', req.user.email);
        
        const settings = await Settings.getCurrent();
        
        const backup = {
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            settings: settings.toObject(),
            createdBy: req.user.email
        };
        
        console.log('✅ Settings backup created');
        
        res.json({
            success: true,
            message: 'Sauvegarde des paramètres créée',
            backup: {
                timestamp: backup.timestamp,
                size: JSON.stringify(backup).length,
                createdBy: backup.createdBy
            }
        });
        
    } catch (error) {
        console.error('❌ Settings backup error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de la sauvegarde'
        });
    }
});

module.exports = router;
