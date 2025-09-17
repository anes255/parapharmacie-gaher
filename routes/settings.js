const express = require('express');
const Settings = require('../models/Settings');
const { auth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/settings
// @desc    Get all settings
// @access  Public (for basic settings) / Private/Admin (for all settings)
router.get('/', async (req, res) => {
    try {
        console.log('⚙️ Getting settings');
        
        const settings = await Settings.getSettings();
        
        // If not admin, only return public settings
        if (!req.user || req.user.role !== 'admin') {
            const publicSettings = {
                siteName: settings.siteName,
                siteDescription: settings.siteDescription,
                contact: settings.contact,
                shipping: {
                    fraisLivraisonDefaut: settings.shipping.fraisLivraisonDefaut,
                    livraisonGratuiteSeuil: settings.shipping.livraisonGratuiteSeuil,
                    delaiLivraisonMin: settings.shipping.delaiLivraisonMin,
                    delaiLivraisonMax: settings.shipping.delaiLivraisonMax,
                    wilayasDisponibles: settings.shipping.wilayasDisponibles
                },
                payment: {
                    modesDisponibles: settings.payment.modesDisponibles.filter(mode => mode.actif)
                },
                business: {
                    devise: settings.business.devise,
                    langue: settings.business.langue
                },
                maintenance: settings.maintenance,
                features: settings.features,
                theme: settings.theme
            };
            
            return res.json(publicSettings);
        }
        
        // Admin gets all settings
        res.json(settings);
        
    } catch (error) {
        console.error('❌ Settings retrieval error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des paramètres'
        });
    }
});

// @route   GET /api/settings/public
// @desc    Get public settings only
// @access  Public
router.get('/public', async (req, res) => {
    try {
        const settings = await Settings.getSettings();
        
        const publicSettings = {
            siteName: settings.siteName,
            siteDescription: settings.siteDescription,
            contact: {
                email: settings.contact.email,
                telephone: settings.contact.telephone,
                adresse: settings.contact.adresse,
                horaires: settings.contact.horaires
            },
            shipping: {
                fraisLivraisonDefaut: settings.shipping.fraisLivraisonDefaut,
                livraisonGratuiteSeuil: settings.shipping.livraisonGratuiteSeuil,
                wilayasDisponibles: settings.shipping.wilayasDisponibles
            },
            payment: {
                modesDisponibles: settings.payment.modesDisponibles.filter(mode => mode.actif)
            },
            business: {
                devise: settings.business.devise
            },
            socialMedia: settings.socialMedia,
            features: settings.features,
            theme: settings.theme
        };
        
        res.json(publicSettings);
        
    } catch (error) {
        console.error('❌ Public settings error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des paramètres publics'
        });
    }
});

// @route   PUT /api/settings
// @desc    Update settings
// @access  Private/Admin
router.put('/', auth, requireAdmin, async (req, res) => {
    try {
        console.log('⚙️ Admin updating settings');
        
        const updatedSettings = await Settings.updateSettings(req.body);
        
        console.log('✅ Settings updated successfully');
        
        res.json({
            message: 'Paramètres mis à jour avec succès',
            settings: updatedSettings
        });
        
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

// @route   GET /api/settings/:section
// @desc    Get specific settings section
// @access  Private/Admin
router.get('/:section', auth, requireAdmin, async (req, res) => {
    try {
        const settings = await Settings.getSettings();
        const section = req.params.section;
        
        if (!settings[section]) {
            return res.status(404).json({
                message: 'Section de paramètres non trouvée'
            });
        }
        
        res.json({
            [section]: settings[section]
        });
        
    } catch (error) {
        console.error('❌ Settings section error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération de la section'
        });
    }
});

// @route   PUT /api/settings/:section
// @desc    Update specific settings section
// @access  Private/Admin
router.put('/:section', auth, requireAdmin, async (req, res) => {
    try {
        const section = req.params.section;
        const updateData = { [section]: req.body };
        
        const updatedSettings = await Settings.updateSettings(updateData);
        
        res.json({
            message: `Section ${section} mise à jour avec succès`,
            [section]: updatedSettings[section]
        });
        
    } catch (error) {
        console.error('❌ Settings section update error:', error);
        res.status(500).json({
            message: 'Erreur lors de la mise à jour de la section'
        });
    }
});

// @route   GET /api/settings/shipping/wilayas
// @desc    Get available wilayas for shipping
// @access  Public
router.get('/shipping/wilayas', async (req, res) => {
    try {
        const settings = await Settings.getSettings();
        
        res.json({
            wilayas: settings.shipping.wilayasDisponibles || [],
            fraisLivraisonDefaut: settings.shipping.fraisLivraisonDefaut,
            livraisonGratuiteSeuil: settings.shipping.livraisonGratuiteSeuil
        });
        
    } catch (error) {
        console.error('❌ Wilayas retrieval error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des wilayas'
        });
    }
});

// @route   POST /api/settings/shipping/wilayas
// @desc    Add or update wilaya shipping info
// @access  Private/Admin
router.post('/shipping/wilayas', auth, requireAdmin, async (req, res) => {
    try {
        const { nom, fraisLivraison, delaiLivraison } = req.body;
        
        if (!nom || fraisLivraison === undefined) {
            return res.status(400).json({
                message: 'Nom de wilaya et frais de livraison requis'
            });
        }
        
        const settings = await Settings.getSettings();
        
        // Check if wilaya already exists
        const existingIndex = settings.shipping.wilayasDisponibles.findIndex(w => w.nom === nom);
        
        const wilayaData = {
            nom,
            fraisLivraison: parseFloat(fraisLivraison),
            delaiLivraison: delaiLivraison || '2-7 jours'
        };
        
        if (existingIndex > -1) {
            // Update existing wilaya
            settings.shipping.wilayasDisponibles[existingIndex] = wilayaData;
        } else {
            // Add new wilaya
            settings.shipping.wilayasDisponibles.push(wilayaData);
        }
        
        await settings.save();
        
        res.json({
            message: 'Wilaya mise à jour avec succès',
            wilaya: wilayaData
        });
        
    } catch (error) {
        console.error('❌ Wilaya update error:', error);
        res.status(500).json({
            message: 'Erreur lors de la mise à jour de la wilaya'
        });
    }
});

// @route   DELETE /api/settings/shipping/wilayas/:nom
// @desc    Remove wilaya from shipping
// @access  Private/Admin
router.delete('/shipping/wilayas/:nom', auth, requireAdmin, async (req, res) => {
    try {
        const settings = await Settings.getSettings();
        
        settings.shipping.wilayasDisponibles = settings.shipping.wilayasDisponibles.filter(
            w => w.nom !== req.params.nom
        );
        
        await settings.save();
        
        res.json({
            message: 'Wilaya supprimée avec succès'
        });
        
    } catch (error) {
        console.error('❌ Wilaya deletion error:', error);
        res.status(500).json({
            message: 'Erreur lors de la suppression de la wilaya'
        });
    }
});

// @route   POST /api/settings/payment/modes
// @desc    Add or update payment mode
// @access  Private/Admin
router.post('/payment/modes', auth, requireAdmin, async (req, res) => {
    try {
        const { nom, actif, description } = req.body;
        
        if (!nom) {
            return res.status(400).json({
                message: 'Nom du mode de paiement requis'
            });
        }
        
        const settings = await Settings.getSettings();
        
        const existingIndex = settings.payment.modesDisponibles.findIndex(m => m.nom === nom);
        
        const modeData = {
            nom,
            actif: actif !== false,
            description: description || ''
        };
        
        if (existingIndex > -1) {
            settings.payment.modesDisponibles[existingIndex] = modeData;
        } else {
            settings.payment.modesDisponibles.push(modeData);
        }
        
        await settings.save();
        
        res.json({
            message: 'Mode de paiement mis à jour avec succès',
            mode: modeData
        });
        
    } catch (error) {
        console.error('❌ Payment mode update error:', error);
        res.status(500).json({
            message: 'Erreur lors de la mise à jour du mode de paiement'
        });
    }
});

// @route   POST /api/settings/init
// @desc    Initialize default settings
// @access  Private/Admin
router.post('/init', auth, requireAdmin, async (req, res) => {
    try {
        console.log('⚙️ Initializing default settings');
        
        // Initialize default wilayas
        await Settings.initializeDefaultWilayas();
        
        // Initialize default payment modes if not exist
        const settings = await Settings.getSettings();
        
        if (!settings.payment.modesDisponibles || settings.payment.modesDisponibles.length === 0) {
            settings.payment.modesDisponibles = [
                {
                    nom: 'Paiement à la livraison',
                    actif: true,
                    description: 'Payez en espèces lors de la réception de votre commande'
                },
                {
                    nom: 'Carte bancaire',
                    actif: false,
                    description: 'Paiement sécurisé par carte bancaire'
                },
                {
                    nom: 'Virement bancaire',
                    actif: false,
                    description: 'Virement sur notre compte bancaire'
                }
            ];
            
            await settings.save();
        }
        
        console.log('✅ Default settings initialized');
        
        res.json({
            message: 'Paramètres par défaut initialisés avec succès',
            settings
        });
        
    } catch (error) {
        console.error('❌ Settings initialization error:', error);
        res.status(500).json({
            message: 'Erreur lors de l\'initialisation des paramètres'
        });
    }
});

// @route   POST /api/settings/maintenance
// @desc    Toggle maintenance mode
// @access  Private/Admin
router.post('/maintenance', auth, requireAdmin, async (req, res) => {
    try {
        const { actif, message, dateDebut, dateFin } = req.body;
        
        const updateData = {
            maintenance: {
                actif: !!actif,
                message: message || 'Site en maintenance. Nous revenons bientôt!',
                dateDebut: dateDebut ? new Date(dateDebut) : (actif ? new Date() : null),
                dateFin: dateFin ? new Date(dateFin) : null
            }
        };
        
        const settings = await Settings.updateSettings(updateData);
        
        console.log(`✅ Maintenance mode ${actif ? 'activated' : 'deactivated'}`);
        
        res.json({
            message: `Mode maintenance ${actif ? 'activé' : 'désactivé'}`,
            maintenance: settings.maintenance
        });
        
    } catch (error) {
        console.error('❌ Maintenance toggle error:', error);
        res.status(500).json({
            message: 'Erreur lors du changement du mode maintenance'
        });
    }
});

module.exports = router;
