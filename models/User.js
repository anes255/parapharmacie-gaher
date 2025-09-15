const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Register user
router.post('/register', async (req, res) => {
    try {
        const { nom, prenom, email, password, telephone, adresse, wilaya } = req.body;
        
        // Validation
        if (!nom || !prenom || !email || !password || !telephone || !adresse || !wilaya) {
            return res.status(400).json({ message: 'Tous les champs sont obligatoires' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' });
        }
        
        // Check if user already exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: 'Un utilisateur avec cet email existe déjà' });
        }
        
        // Create user
        const user = new User({
            nom: nom.trim(),
            prenom: prenom.trim(),
            email: email.trim().toLowerCase(),
            password,
            telephone: telephone.trim(),
            adresse: adresse.trim(),
            wilaya: wilaya.trim()
        });
        
        await user.save();
        
        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );
        
        console.log('User registered successfully:', user.email);
        
        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                telephone: user.telephone,
                adresse: user.adresse,
                wilaya: user.wilaya,
                role: user.role
            },
            message: 'Compte créé avec succès'
        });
        
    } catch (error) {
        console.error('Register error:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Cet email est déjà utilisé' });
        }
        
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: errors.join(', ') });
        }
        
        res.status(500).json({ message: 'Erreur lors de la création du compte' });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validation
        if (!email || !password) {
            return res.status(400).json({ message: 'Email et mot de passe requis' });
        }
        
        // Find user
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(400).json({ message: 'Email ou mot de passe incorrect' });
        }
        
        // Check if user is active
        if (!user.actif) {
            return res.status(400).json({ message: 'Compte désactivé' });
        }
        
        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Email ou mot de passe incorrect' });
        }
        
        // Update last login
        await user.updateLastLogin();
        
        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );
        
        console.log('User logged in successfully:', user.email);
        
        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                telephone: user.telephone,
                adresse: user.adresse,
                wilaya: user.wilaya,
                role: user.role
            },
            message: 'Connexion réussie'
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Erreur lors de la connexion' });
    }
});

// Get user profile
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        
        res.json({
            success: true,
            user: {
                id: user._id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                telephone: user.telephone,
                adresse: user.adresse,
                wilaya: user.wilaya,
                role: user.role,
                dateInscription: user.dateInscription,
                derniereConnexion: user.derniereConnexion
            }
        });
        
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        
        // Update allowed fields
        const allowedUpdates = ['nom', 'prenom', 'telephone', 'adresse', 'wilaya', 'dateNaissance'];
        
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                user[field] = req.body[field];
            }
        });
        
        // Update preferences if provided
        if (req.body.preferences) {
            user.preferences = { ...user.preferences, ...req.body.preferences };
        }
        
        await user.save();
        
        res.json({
            success: true,
            user: {
                id: user._id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                telephone: user.telephone,
                adresse: user.adresse,
                wilaya: user.wilaya,
                role: user.role
            },
            message: 'Profil mis à jour avec succès'
        });
        
    } catch (error) {
        console.error('Update profile error:', error);
        
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: errors.join(', ') });
        }
        
        res.status(500).json({ message: 'Erreur lors de la mise à jour du profil' });
    }
});

// Change password
router.put('/change-password', auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Mot de passe actuel et nouveau requis' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'Le nouveau mot de passe doit contenir au moins 6 caractères' });
        }
        
        const user = await User.findById(req.user.id);
        
        // Check current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ message: 'Mot de passe actuel incorrect' });
        }
        
        // Update password
        user.password = newPassword;
        await user.save();
        
        res.json({
            success: true,
            message: 'Mot de passe modifié avec succès'
        });
        
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: 'Erreur lors du changement de mot de passe' });
    }
});

// Delete account
router.delete('/account', auth, async (req, res) => {
    try {
        const { password } = req.body;
        
        if (!password) {
            return res.status(400).json({ message: 'Mot de passe requis pour supprimer le compte' });
        }
        
        const user = await User.findById(req.user.id);
        
        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Mot de passe incorrect' });
        }
        
        // Soft delete - deactivate account instead of deleting
        user.actif = false;
        user.email = `deleted_${Date.now()}_${user.email}`;
        await user.save();
        
        res.json({
            success: true,
            message: 'Compte supprimé avec succès'
        });
        
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ message: 'Erreur lors de la suppression du compte' });
    }
});

// Verify token
router.get('/verify', auth, async (req, res) => {
    try {
        res.json({
            success: true,
            user: {
                id: req.user._id,
                nom: req.user.nom,
                prenom: req.user.prenom,
                email: req.user.email,
                role: req.user.role
            },
            message: 'Token valide'
        });
    } catch (error) {
        console.error('Verify token error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

module.exports = router;
