const express = require('express');
const Settings = require('../models/Settings');
const { auth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/settings
// @desc    Get current settings
// @access  Public
router.get('/', async (req, res) => {
    try {
        console.log('⚙️ Fetching settings');
        
        let settings = await Settings.findOne();
        
        // If no settings exist, create default settings
        if (!settings) {
            console.log('📝 Creating default settings');
            
            settings = new Settings({
                nomSite: 'Pharmacie Gaher',
                descriptionSite: 'Votre parapharmacie de confiance',
                adresse: '123 Rue de la Santé, 75001 Paris',
                telephone: '01 23 45 67 89',
                email: 'contact@pharmaciegaher.com',
                horaires: 'Lun-Sam: 9h-19h, Dim: 10h-18h',
                fraisLivraison: 5.99,
                fraisLivraisonGratuite: 50,
                tva: 0.20,
                couleurPrimaire: '#10b981',
                couleurSecondaire: '#059669',
                couleurAccent: '#34d399',
                logo: '',
                favicon: '',
                reseauxSociaux: {
                    facebook: '',
                    instagram: '',
                    twitter: ''
                },
                paiement: {
                    paiementLivraison: true,
                    carteCredit: false,
                    paypal: false
                },
                seo: {
                    titre: 'Pharmacie Gaher - Parapharmacie en ligne',
                    description: 'Découvrez notre large gamme de produits parapharmaceutiques en ligne. Livraison rapide et conseils experts.',
                    motsCles: 'parapharmacie, pharmacie, santé, beauté, bien-être'
                },
                actif: true,
                dateCreation: new Date(),
                dateMiseAJour: new Date()
            });
            
            await settings.save();
            console.log('✅ Default settings created');
        }
        
        res.json(settings);
        
    } catch (error) {
        console.error('❌ Settings fetch error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des paramètres',
            error: error.message
        });
    }
});

// @route   PUT /api/settings
// @desc    Update settings
// @access  Private/Admin
router.put('/', auth, requireAdmin, async (req, res) => {
    try {
        console.log('⚙️ Updating settings:', req.body);
        
        let settings = await Settings.findOne();
        
        if (!settings) {
            // Create new settings if none exist
            settings = new Settings(req.body);
        } else {
            // Update existing settings
            const {
                nomSite,
                descriptionSite,
                adresse,
                telephone,
                email,
                horaires,
                fraisLivraison,
                fraisLivraisonGratuite,
                tva,
                couleurPrimaire,
                couleurSecondaire,
                couleurAccent,
                logo,
                favicon,
                reseauxSociaux,
                paiement,
                seo,
                actif
            } = req.body;
            
            // Update fields if provided
            if (nomSite !== undefined) settings.nomSite = nomSite;
            if (descriptionSite !== undefined) settings.descriptionSite = descriptionSite;
            if (adresse !== undefined) settings.adresse = adresse;
            if (telephone !== undefined) settings.telephone = telephone;
            if (email !== undefined) settings.email = email;
            if (horaires !== undefined) settings.horaires = horaires;
            if (fraisLivraison !== undefined) settings.fraisLivraison = parseFloat(fraisLivraison);
            if (fraisLivraisonGratuite !== undefined) settings.fraisLivraisonGratuite = parseFloat(fraisLivraisonGratuite);
            if (tva !== undefined) settings.tva = parseFloat(tva);
            if (couleurPrimaire !== undefined) settings.couleurPrimaire = couleurPrimaire;
            if (couleurSecondaire !== undefined) settings.couleurSecondaire = couleurSecondaire;
            if (couleurAccent !== undefined) settings.couleurAccent = couleurAccent;
            if (logo !== undefined) settings.logo = logo;
            if (favicon !== undefined) settings.favicon = favicon;
            if (reseauxSociaux !== undefined) settings.reseauxSociaux = reseauxSociaux;
            if (paiement !== undefined) settings.paiement = paiement;
            if (seo !== undefined) settings.seo = seo;
            if (actif !== undefined) settings.actif = Boolean(actif);
        }
        
        settings.dateMiseAJour = new Date();
        const updatedSettings = await settings.save();
        
        console.log('✅ Settings updated successfully');
        
        res.json({
            message: 'Paramètres mis à jour avec succès',
            settings: updatedSettings
        });
        
    } catch (error) {
        console.error('❌ Settings update error:', error);
        res.status(500).json({
            message: 'Erreur lors de la mise à jour des paramètres',
            error: error.message
        });
    }
});

// @route   PUT /api/settings/appearance
// @desc    Update appearance settings only
// @access  Private/Admin
router.put('/appearance', auth, requireAdmin, async (req, res) => {
    try {
        console.log('🎨 Updating appearance settings:', req.body);
        
        let settings = await Settings.findOne();
        
        if (!settings) {
            return res.status(404).json({
                message: 'Paramètres non trouvés'
            });
        }
        
        const {
            couleurPrimaire,
            couleurSecondaire,
            couleurAccent,
            logo,
            favicon
        } = req.body;
        
        // Update appearance fields
        if (couleurPrimaire !== undefined) settings.couleurPrimaire = couleurPrimaire;
        if (couleurSecondaire !== undefined) settings.couleurSecondaire = couleurSecondaire;
        if (couleurAccent !== undefined) settings.couleurAccent = couleurAccent;
        if (logo !== undefined) settings.logo = logo;
        if (favicon !== undefined) settings.favicon = favicon;
        
        settings.dateMiseAJour = new Date();
        const updatedSettings = await settings.save();
        
        console.log('✅ Appearance settings updated successfully');
        
        res.json({
            message: 'Paramètres d\'apparence mis à jour avec succès',
            settings: updatedSettings
        });
        
    } catch (error) {
        console.error('❌ Appearance settings update error:', error);
        res.status(500).json({
            message: 'Erreur lors de la mise à jour de l\'apparence',
            error: error.message
        });
    }
});

// @route   PUT /api/settings/shipping
// @desc    Update shipping settings only
// @access  Private/Admin
router.put('/shipping', auth, requireAdmin, async (req, res) => {
    try {
        console.log('🚚 Updating shipping settings:', req.body);
        
        let settings = await Settings.findOne();
        
        if (!settings) {
            return res.status(404).json({
                message: 'Paramètres non trouvés'
            });
        }
        
        const { fraisLivraison, fraisLivraisonGratuite } = req.body;
        
        // Validation
        if (fraisLivraison !== undefined && fraisLivraison < 0) {
            return res.status(400).json({
                message: 'Les frais de livraison ne peuvent pas être négatifs'
            });
        }
        
        if (fraisLivraisonGratuite !== undefined && fraisLivraisonGratuite < 0) {
            return res.status(400).json({
                message: 'Le montant pour la livraison gratuite ne peut pas être négatif'
            });
        }
        
        // Update shipping fields
        if (fraisLivraison !== undefined) settings.fraisLivraison = parseFloat(fraisLivraison);
        if (fraisLivraisonGratuite !== undefined) settings.fraisLivraisonGratuite = parseFloat(fraisLivraisonGratuite);
        
        settings.dateMiseAJour = new Date();
        const updatedSettings = await settings.save();
        
        console.log('✅ Shipping settings updated successfully');
        
        res.json({
            message: 'Paramètres de livraison mis à jour avec succès',
            settings: updatedSettings
        });
        
    } catch (error) {
        console.error('❌ Shipping settings update error:', error);
        res.status(500).json({
            message: 'Erreur lors de la mise à jour des paramètres de livraison',
            error: error.message
        });
    }
});

// @route   PUT /api/settings/payment
// @desc    Update payment settings only
// @access  Private/Admin
router.put('/payment', auth, requireAdmin, async (req, res) => {
    try {
        console.log('💳 Updating payment settings:', req.body);
        
        let settings = await Settings.findOne();
        
        if (!settings) {
            return res.status(404).json({
                message: 'Paramètres non trouvés'
            });
        }
        
        const { paiement } = req.body;
        
        if (paiement !== undefined) {
            settings.paiement = {
                ...settings.paiement,
                ...paiement
            };
        }
        
        settings.dateMiseAJour = new Date();
        const updatedSettings = await settings.save();
        
        console.log('✅ Payment settings updated successfully');
        
        res.json({
            message: 'Paramètres de paiement mis à jour avec succès',
            settings: updatedSettings
        });
        
    } catch (error) {
        console.error('❌ Payment settings update error:', error);
        res.status(500).json({
            message: 'Erreur lors de la mise à jour des paramètres de paiement',
            error: error.message
        });
    }
});

// @route   GET /api/settings/public
// @desc    Get public settings (without sensitive data)
// @access  Public
router.get('/public', async (req, res) => {
    try {
        const settings = await Settings.findOne().select('-_id -__v -dateCreation -dateMiseAJour');
        
        if (!settings) {
            return res.json({
                nomSite: 'Pharmacie Gaher',
                descriptionSite: 'Votre parapharmacie de confiance',
                couleurPrimaire: '#10b981',
                couleurSecondaire: '#059669',
                couleurAccent: '#34d399',
                fraisLivraison: 5.99,
                fraisLivraisonGratuite: 50
            });
        }
        
        // Return only public-safe settings
        const publicSettings = {
            nomSite: settings.nomSite,
            descriptionSite: settings.descriptionSite,
            couleurPrimaire: settings.couleurPrimaire,
            couleurSecondaire: settings.couleurSecondaire,
            couleurAccent: settings.couleurAccent,
            logo: settings.logo,
            fraisLivraison: settings.fraisLivraison,
            fraisLivraisonGratuite: settings.fraisLivraisonGratuite,
            reseauxSociaux: settings.reseauxSociaux,
            paiement: settings.paiement,
            seo: settings.seo
        };
        
        res.json(publicSettings);
        
    } catch (error) {
        console.error('❌ Public settings fetch error:', error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des paramètres publics',
            error: error.message
        });
    }
});

module.exports = router;
