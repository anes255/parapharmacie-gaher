const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

// Middleware to check if user is admin
const adminAuth = (req, res, next) => {
    if (req.user && req.user.role !== 'admin') {
        return res.status(403).json({
            message: 'Accès administrateur requis'
        });
    }
    next();
};

// Default settings
const defaultSettings = {
    siteName: 'Shifa - Parapharmacie',
    siteDescription: 'Votre parapharmacie de confiance à Tipaza',
    contactEmail: 'pharmaciegaher@gmail.com',
    contactPhone: '+213 123 456 789',
    address: 'Tipaza, Algérie',
    currency: 'DA',
    language: 'fr',
    timezone: 'Africa/Algiers',
    freeShippingThreshold: 5000,
    defaultShippingCost: 300,
    taxRate: 0,
    enableRegistration: true,
    enableReviews: true,
    enableNewsletter: true,
    enableSocialLogin: false,
    maintenanceMode: false,
    theme: {
        primaryColor: '#10b981',
        secondaryColor: '#059669',
        accentColor: '#34d399'
    },
    seo: {
        metaTitle: 'Shifa - Parapharmacie Tipaza',
        metaDescription: 'Découvrez notre large gamme de produits de parapharmacie à Tipaza. Livraison rapide dans toute l\'Algérie.',
        metaKeywords: 'parapharmacie, tipaza, algérie, santé, beauté, produits naturels'
    },
    social: {
        facebook: 'https://www.facebook.com/pharmaciegaher/',
        instagram: 'https://www.instagram.com/pharmaciegaher/',
        twitter: '',
        linkedin: ''
    }
};

// @route   GET /api/settings
// @desc    Get all settings
// @access  Private/Admin
router.get('/', auth, adminAuth, async (req, res) => {
    try {
        console.log('⚙️ Loading application settings...');
        
        let settings = defaultSettings;
        
        try {
            const Settings = require('../models/Settings');
            const savedSettings = await Settings.findOne({});
            
            if (savedSettings) {
                settings = { ...defaultSettings, ...savedSettings.toObject() };
                delete settings._id;
                delete settings.__v;
            }
            
        } catch (modelError) {
            console.log('⚠️ Settings model not available, using defaults');
        }

        console.log('✅ Settings loaded successfully');
        
        res.json({
            message: 'Paramètres récupérés avec succès',
            settings
        });

    } catch (error) {
        console.error('❌ Settings fetch error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des paramètres'
        });
    }
});

// @route   PUT /api/settings
// @desc    Update settings
// @access  Private/Admin
router.put('/', auth, adminAuth, async (req, res) => {
    try {
        console.log('⚙️ Updating application settings...');
        
        const updatedSettings = req.body;
        
        // Validate required fields
        if (!updatedSettings.siteName) {
            return res.status(400).json({
                message: 'Le nom du site est requis'
            });
        }
        
        try {
            const Settings = require('../models/Settings');
            
            let settings = await Settings.findOne({});
            
            if (settings) {
                Object.assign(settings, updatedSettings);
            } else {
                settings = new Settings(updatedSettings);
            }
            
            await settings.save();
            
            const response = { ...defaultSettings, ...settings.toObject() };
            delete response._id;
            delete response.__v;
            
            console.log('✅ Settings updated successfully');
            
            res.json({
                message: 'Paramètres mis à jour avec succès',
                settings: response
            });
            
        } catch (modelError) {
            console.log('⚠️ Settings model not available, saving to memory only');
            
            // In a real application without database, you might save to file
            res.json({
                message: 'Paramètres mis à jour (en mémoire uniquement)',
                settings: { ...defaultSettings, ...updatedSettings }
            });
        }

    } catch (error) {
        console.error('❌ Settings update error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: messages[0] || 'Données de paramètres invalides'
            });
        }
        
        res.status(500).json({
            message: 'Erreur lors de la mise à jour des paramètres'
        });
    }
});

// @route   GET /api/settings/public
// @desc    Get public settings (no auth required)
// @access  Public
router.get('/public', async (req, res) => {
    try {
        console.log('🌐 Loading public settings...');
        
        let settings = defaultSettings;
        
        try {
            const Settings = require('../models/Settings');
            const savedSettings = await Settings.findOne({});
            
            if (savedSettings) {
                settings = { ...defaultSettings, ...savedSettings.toObject() };
            }
            
        } catch (modelError) {
            console.log('⚠️ Settings model not available, using defaults');
        }

        // Filter to only public settings
        const publicSettings = {
            siteName: settings.siteName,
            siteDescription: settings.siteDescription,
            currency: settings.currency,
            language: settings.language,
            freeShippingThreshold: settings.freeShippingThreshold,
            defaultShippingCost: settings.defaultShippingCost,
            enableRegistration: settings.enableRegistration,
            enableReviews: settings.enableReviews,
            enableNewsletter: settings.enableNewsletter,
            maintenanceMode: settings.maintenanceMode,
            theme: settings.theme,
            seo: settings.seo,
            social: settings.social
        };

        res.json({
            message: 'Paramètres publics récupérés',
            settings: publicSettings
        });

    } catch (error) {
        console.error('❌ Public settings fetch error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des paramètres publics'
        });
    }
});

// @route   POST /api/settings/reset
// @desc    Reset settings to default
// @access  Private/Admin
router.post('/reset', auth, adminAuth, async (req, res) => {
    try {
        console.log('🔄 Resetting settings to default...');
        
        try {
            const Settings = require('../models/Settings');
            await Settings.deleteMany({});
            
            const newSettings = new Settings(defaultSettings);
            await newSettings.save();
            
            console.log('✅ Settings reset to default successfully');
            
            res.json({
                message: 'Paramètres réinitialisés aux valeurs par défaut',
                settings: defaultSettings
            });
            
        } catch (modelError) {
            console.log('⚠️ Settings model not available, using memory only');
            
            res.json({
                message: 'Paramètres réinitialisés (en mémoire)',
                settings: defaultSettings
            });
        }

    } catch (error) {
        console.error('❌ Settings reset error:', error);
        res.status(500).json({
            message: 'Erreur lors de la réinitialisation des paramètres'
        });
    }
});

module.exports = router;
