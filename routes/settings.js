const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

// Default application settings
const defaultSettings = {
    siteName: 'Shifa - Parapharmacie',
    siteDescription: 'Votre parapharmacie de confiance à Tipaza, Algérie',
    currency: 'DA',
    fraisLivraison: 300,
    livraisonGratuite: 5000,
    couleurPrimaire: '#10b981',
    couleurSecondaire: '#059669',
    couleurAccent: '#34d399',
    email: 'pharmaciegaher@gmail.com',
    telephone: '+213 123 456 789',
    adresse: 'Tipaza, Algérie',
    horaires: 'Lun-Sam: 8h-20h, Dim: 9h-18h',
    facebook: 'https://www.facebook.com/pharmaciegaher/?locale=mg_MG',
    instagram: 'https://www.instagram.com/pharmaciegaher/',
    maintenance: false,
    allowRegistrations: true,
    emailNotifications: true,
    smsNotifications: false,
    wilayasLivraison: [
        'Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi', 'Batna', 'Béjaïa', 'Biskra', 'Béchar',
        'Blida', 'Bouira', 'Tamanrasset', 'Tébessa', 'Tlemcen', 'Tiaret', 'Tizi Ouzou', 'Alger',
        'Djelfa', 'Jijel', 'Sétif', 'Saïda', 'Skikda', 'Sidi Bel Abbès', 'Annaba', 'Guelma',
        'Constantine', 'Médéa', 'Mostaganem', 'M\'Sila', 'Mascara', 'Ouargla', 'Oran', 'El Bayadh',
        'Illizi', 'Bordj Bou Arréridj', 'Boumerdès', 'El Tarf', 'Tindouf', 'Tissemsilt', 'El Oued',
        'Khenchela', 'Souk Ahras', 'Tipaza', 'Mila', 'Aïn Defla', 'Naâma', 'Aïn Témouchent',
        'Ghardaïa', 'Relizane', 'Timimoun', 'Bordj Badji Mokhtar', 'Ouled Djellal', 'Béni Abbès',
        'In Salah', 'In Guezzam', 'Touggourt', 'Djanet', 'El M\'Ghair', 'El Meniaa'
    ],
    tarifsByWilaya: {
        'Alger': 250,
        'Blida': 250,
        'Boumerdès': 250,
        'Tipaza': 200,
        'Médéa': 300,
        'default': 350
    }
};

// In-memory settings storage (in production, this would be in a database)
let currentSettings = { ...defaultSettings };

// Middleware to check admin role
const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            message: 'Accès administrateur requis'
        });
    }
    next();
};

// @route   GET /api/settings
// @desc    Get application settings
// @access  Public
router.get('/', (req, res) => {
    try {
        // Return public settings only
        const publicSettings = {
            siteName: currentSettings.siteName,
            siteDescription: currentSettings.siteDescription,
            currency: currentSettings.currency,
            fraisLivraison: currentSettings.fraisLivraison,
            livraisonGratuite: currentSettings.livraisonGratuite,
            couleurPrimaire: currentSettings.couleurPrimaire,
            couleurSecondaire: currentSettings.couleurSecondaire,
            couleurAccent: currentSettings.couleurAccent,
            email: currentSettings.email,
            telephone: currentSettings.telephone,
            adresse: currentSettings.adresse,
            horaires: currentSettings.horaires,
            facebook: currentSettings.facebook,
            instagram: currentSettings.instagram,
            maintenance: currentSettings.maintenance,
            allowRegistrations: currentSettings.allowRegistrations,
            wilayasLivraison: currentSettings.wilayasLivraison,
            tarifsByWilaya: currentSettings.tarifsByWilaya
        };

        res.json({
            settings: publicSettings,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Get settings error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des paramètres'
        });
    }
});

// @route   GET /api/settings/admin
// @desc    Get all settings for admin
// @access  Private/Admin
router.get('/admin', auth, requireAdmin, (req, res) => {
    try {
        res.json({
            settings: currentSettings,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Get admin settings error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des paramètres'
        });
    }
});

// @route   PUT /api/settings
// @desc    Update application settings
// @access  Private/Admin
router.put('/', auth, requireAdmin, (req, res) => {
    try {
        console.log('⚙️ Admin updating settings');

        const {
            siteName,
            siteDescription,
            currency,
            fraisLivraison,
            livraisonGratuite,
            couleurPrimaire,
            couleurSecondaire,
            couleurAccent,
            email,
            telephone,
            adresse,
            horaires,
            facebook,
            instagram,
            maintenance,
            allowRegistrations,
            emailNotifications,
            smsNotifications,
            wilayasLivraison,
            tarifsByWilaya
        } = req.body;

        // Validate required fields
        if (siteName) currentSettings.siteName = siteName.trim();
        if (siteDescription) currentSettings.siteDescription = siteDescription.trim();
        if (currency) currentSettings.currency = currency.trim();
        
        if (fraisLivraison !== undefined) {
            const shipping = parseFloat(fraisLivraison);
            if (shipping >= 0) {
                currentSettings.fraisLivraison = shipping;
            }
        }
        
        if (livraisonGratuite !== undefined) {
            const freeShipping = parseFloat(livraisonGratuite);
            if (freeShipping >= 0) {
                currentSettings.livraisonGratuite = freeShipping;
            }
        }

        // Colors
        if (couleurPrimaire && /^#[0-9A-F]{6}$/i.test(couleurPrimaire)) {
            currentSettings.couleurPrimaire = couleurPrimaire;
        }
        if (couleurSecondaire && /^#[0-9A-F]{6}$/i.test(couleurSecondaire)) {
            currentSettings.couleurSecondaire = couleurSecondaire;
        }
        if (couleurAccent && /^#[0-9A-F]{6}$/i.test(couleurAccent)) {
            currentSettings.couleurAccent = couleurAccent;
        }

        // Contact info
        if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            currentSettings.email = email.toLowerCase().trim();
        }
        if (telephone) currentSettings.telephone = telephone.trim();
        if (adresse) currentSettings.adresse = adresse.trim();
        if (horaires) currentSettings.horaires = horaires.trim();

        // Social media
        if (facebook) currentSettings.facebook = facebook.trim();
        if (instagram) currentSettings.instagram = instagram.trim();

        // Boolean settings
        if (maintenance !== undefined) currentSettings.maintenance = Boolean(maintenance);
        if (allowRegistrations !== undefined) currentSettings.allowRegistrations = Boolean(allowRegistrations);
        if (emailNotifications !== undefined) currentSettings.emailNotifications = Boolean(emailNotifications);
        if (smsNotifications !== undefined) currentSettings.smsNotifications = Boolean(smsNotifications);

        // Arrays
        if (Array.isArray(wilayasLivraison)) {
            currentSettings.wilayasLivraison = wilayasLivraison.filter(w => w && w.trim());
        }

        if (tarifsByWilaya && typeof tarifsByWilaya === 'object') {
            // Validate tariffs
            const validTariffs = {};
            for (const [wilaya, tarif] of Object.entries(tarifsByWilaya)) {
                const price = parseFloat(tarif);
                if (!isNaN(price) && price >= 0) {
                    validTariffs[wilaya] = price;
                }
            }
            currentSettings.tarifsByWilaya = { ...currentSettings.tarifsByWilaya, ...validTariffs };
        }

        console.log('✅ Settings updated successfully');

        res.json({
            message: 'Paramètres mis à jour avec succès',
            settings: currentSettings,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Update settings error:', error);
        res.status(500).json({
            message: 'Erreur lors de la mise à jour des paramètres'
        });
    }
});

// @route   POST /api/settings/reset
// @desc    Reset settings to default
// @access  Private/Admin
router.post('/reset', auth, requireAdmin, (req, res) => {
    try {
        console.log('⚙️ Admin resetting settings to default');

        currentSettings = { ...defaultSettings };

        console.log('✅ Settings reset to default');

        res.json({
            message: 'Paramètres réinitialisés aux valeurs par défaut',
            settings: currentSettings,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Reset settings error:', error);
        res.status(500).json({
            message: 'Erreur lors de la réinitialisation des paramètres'
        });
    }
});

// @route   GET /api/settings/shipping/:wilaya
// @desc    Get shipping cost for specific wilaya
// @access  Public
router.get('/shipping/:wilaya', (req, res) => {
    try {
        const { wilaya } = req.params;
        const { total = 0 } = req.query;

        const orderTotal = parseFloat(total) || 0;

        // Free shipping if order total exceeds threshold
        if (orderTotal >= currentSettings.livraisonGratuite) {
            return res.json({
                wilaya,
                orderTotal,
                shippingCost: 0,
                freeShipping: true,
                message: 'Livraison gratuite'
            });
        }

        // Get shipping cost for wilaya
        const shippingCost = currentSettings.tarifsByWilaya[wilaya] || currentSettings.tarifsByWilaya.default;

        res.json({
            wilaya,
            orderTotal,
            shippingCost,
            freeShipping: false,
            remainingForFreeShipping: currentSettings.livraisonGratuite - orderTotal
        });

    } catch (error) {
        console.error('❌ Get shipping cost error:', error);
        res.status(500).json({
            message: 'Erreur lors du calcul des frais de livraison'
        });
    }
});

// @route   GET /api/settings/maintenance
// @desc    Check maintenance mode
// @access  Public
router.get('/maintenance', (req, res) => {
    try {
        res.json({
            maintenance: currentSettings.maintenance,
            message: currentSettings.maintenance ? 'Site en maintenance' : 'Site disponible'
        });

    } catch (error) {
        console.error('❌ Check maintenance error:', error);
        res.status(500).json({
            message: 'Erreur lors de la vérification du mode maintenance'
        });
    }
});

// @route   PUT /api/settings/maintenance
// @desc    Toggle maintenance mode
// @access  Private/Admin
router.put('/maintenance', auth, requireAdmin, (req, res) => {
    try {
        const { maintenance } = req.body;

        if (maintenance !== undefined) {
            currentSettings.maintenance = Boolean(maintenance);
            
            console.log(`✅ Maintenance mode ${currentSettings.maintenance ? 'enabled' : 'disabled'}`);

            res.json({
                message: `Mode maintenance ${currentSettings.maintenance ? 'activé' : 'désactivé'}`,
                maintenance: currentSettings.maintenance
            });
        } else {
            res.status(400).json({
                message: 'Paramètre maintenance requis'
            });
        }

    } catch (error) {
        console.error('❌ Toggle maintenance error:', error);
        res.status(500).json({
            message: 'Erreur lors de la modification du mode maintenance'
        });
    }
});

// @route   GET /api/settings/export
// @desc    Export settings
// @access  Private/Admin
router.get('/export', auth, requireAdmin, (req, res) => {
    try {
        console.log('⚙️ Admin exporting settings');

        const exportData = {
            settings: currentSettings,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="shifa-settings-${new Date().toISOString().split('T')[0]}.json"`);
        
        res.json(exportData);

    } catch (error) {
        console.error('❌ Export settings error:', error);
        res.status(500).json({
            message: 'Erreur lors de l\'export des paramètres'
        });
    }
});

// @route   POST /api/settings/import
// @desc    Import settings
// @access  Private/Admin
router.post('/import', auth, requireAdmin, (req, res) => {
    try {
        console.log('⚙️ Admin importing settings');

        const { settings } = req.body;

        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({
                message: 'Données de paramètres invalides'
            });
        }

        // Merge imported settings with current settings
        currentSettings = { ...currentSettings, ...settings };

        console.log('✅ Settings imported successfully');

        res.json({
            message: 'Paramètres importés avec succès',
            settings: currentSettings,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Import settings error:', error);
        res.status(500).json({
            message: 'Erreur lors de l\'import des paramètres'
        });
    }
});

module.exports = router;
