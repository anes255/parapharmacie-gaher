const express = require('express');
const jwt = require('jsonwebtoken');
const Settings = require('../models/Settings');
const User = require('../models/User');

const router = express.Router();

// Middleware admin
const adminAuth = async (req, res, next) => {
    const token = req.header('x-auth-token');
    
    if (!token) {
        return res.status(401).json({ message: 'Accès refusé' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.user.id);
        
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: 'Accès administrateur requis' });
        }
        
        req.user = decoded.user;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token invalide' });
    }
};

// Obtenir les paramètres
router.get('/', async (req, res) => {
    try {
        let settings = await Settings.findOne();
        
        if (!settings) {
            settings = new Settings();
            await settings.save();
        }
        
        res.json(settings);
        
    } catch (error) {
        console.error('Erreur récupération paramètres:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Mettre à jour les paramètres (admin seulement)
router.put('/', adminAuth, async (req, res) => {
    try {
        let settings = await Settings.findOne();
        
        if (!settings) {
            settings = new Settings();
        }
        
        // Mettre à jour tous les champs fournis
        Object.keys(req.body).forEach(key => {
            if (req.body[key] !== undefined) {
                settings[key] = req.body[key];
            }
        });
        
        await settings.save();
        
        res.json({ message: 'Paramètres mis à jour avec succès', settings });
        
    } catch (error) {
        console.error('Erreur mise à jour paramètres:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Obtenir les frais de livraison
router.get('/shipping', async (req, res) => {
    try {
        let settings = await Settings.findOne();
        
        if (!settings) {
            settings = new Settings();
            await settings.save();
        }
        
        res.json({
            fraisLivraison: settings.fraisLivraison,
            livraisonGratuite: settings.livraisonGratuite
        });
        
    } catch (error) {
        console.error('Erreur frais livraison:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

module.exports = router;