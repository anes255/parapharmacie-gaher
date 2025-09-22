const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const { auth, rateLimiter, validateRequest } = require('../middleware/auth');

const router = express.Router();

// Input validation schemas (basic version without joi for simplicity)
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePhone = (phone) => /^(\+213|0)[5-9]\d{8}$/.test(phone.replace(/\s+/g, ''));
const validatePassword = (password) => password && password.length >= 6;

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024', {
        expiresIn: '30d'
    });
};

// Rate limiter for auth endpoints
const authLimiter = rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per window
    message: 'Trop de tentatives. Réessayez dans 15 minutes.'
});

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', authLimiter, async (req, res) => {
    try {
        console.log('📝 Registration attempt for:', req.body.email);
        
        const { 
            nom, 
            prenom, 
            email, 
            password, 
            confirmPassword,
            telephone, 
            adresse, 
            ville, 
            wilaya, 
            codePostal 
        } = req.body;
        
        // Basic validation
        const errors = [];
        
        if (!nom || nom.trim().length < 2) {
            errors.push('Le nom doit contenir au moins 2 caractères');
        }
        
        if (!prenom || prenom.trim().length < 2) {
            errors.push('Le prénom doit contenir au moins 2 caractères');
        }
        
        if (!email || !validateEmail(email)) {
            errors.push('Adresse email invalide');
        }
        
        if (!password || !validatePassword(password)) {
            errors.push('Le mot de passe doit contenir au moins 6 caractères');
        }
        
        if (confirmPassword && password !== confirmPassword) {
            errors.push('Les mots de passe ne correspondent pas');
        }
        
        if (!telephone || !validatePhone(telephone)) {
            errors.push('Numéro de téléphone invalide (format algérien requis)');
        }
        
        if (!adresse || adresse.trim().length < 10) {
            errors.push('L\'adresse doit contenir au moins 10 caractères');
        }
        
        if (!wilaya) {
            errors.push('La wilaya est requise');
        }
        
        if (errors.length > 0) {
            return res.status(400).json({
                message: 'Données invalides',
                errors
            });
        }
        
        // Check if user already exists
        const existingUser = await User.findOne({ 
            $or: [
                { email: email.toLowerCase().trim() },
                { telephone: telephone.replace(/\s+/g, '') }
            ]
        });
        
        if (existingUser) {
            if (existingUser.email === email.toLowerCase().trim()) {
                return res.status(400).json({
                    message: 'Un compte avec cet email existe déjà'
                });
            } else {
                return res.status(400).json({
                    message: 'Un compte avec ce numéro de téléphone existe déjà'
                });
            }
        }
        
        // Create new user
        const user = new User({
            nom: nom.trim(),
            prenom: prenom.trim(),
            email: email.toLowerCase().trim(),
            password, // Will be hashed by pre-save hook
            telephone: telephone.replace(/\s+/g, ''),
            adresse: adresse.trim(),
            ville: ville ? ville.trim() : '',
            wilaya,
            codePostal: codePostal ? codePostal.trim() : '',
            dateInscription: new Date(),
            dernierConnexion: new Date()
        });
        
        await user.save();
        console.log('✅ User registered successfully:', user.email);
        
        // Generate token
        const token = generateToken(user._id);
        
        // Prepare user data for response (excluding sensitive info)
        const userData = {
            id: user._id,
            nom: user.nom,
            prenom: user.prenom,
            email: user.email,
            telephone: user.telephone,
            adresse: user.adresse,
            ville: user.ville,
            wilaya: user.wilaya,
            codePostal: user.codePostal,
            role: user.role,
            dateInscription: user.dateInscription,
            nomComplet: user.nomComplet,
            initiales: user.initiales
        };
        
        res.status(201).json({
            message: 'Inscription réussie! Bienvenue chez Shifa Parapharmacie.',
            success: true,
            token,
            user: userData
        });
        
    } catch (error) {
        console.error('❌ Registration error:', error);
        
        if (error.code === 11000) {
            // Duplicate key error
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({
                message: `${field === 'email' ? 'Email' : 'Téléphone'} déjà utilisé`
            });
        }
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: 'Données invalides',
                errors: messages
            });
        }
        
        res.status(500).json({
            message: 'Erreur lors de l\'inscription. Veuillez réessayer.'
        });
    }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', authLimiter, async (req, res) => {
    try {
        console.log('🔐 Login attempt for:', req.body.email);
        
        const { email, password } = req.body;
        
        // Validation
        if (!email || !password) {
            return res.status(400).json({
                message: 'Email et mot de passe requis'
            });
        }
        
        if (!validateEmail(email)) {
            return res.status(400).json({
                message: 'Format d\'email invalide'
            });
        }
        
        // Find user (include password for comparison)
        const user = await User.findOne({ 
            email: email.toLowerCase().trim(),
            actif: true 
        }).select('+password');
        
        if (!user) {
            console.log('❌ Login failed: User not found for', email);
            return res.status(401).json({
                message: 'Email ou mot de passe incorrect'
            });
        }
        
        // Check password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            console.log('❌ Login failed: Invalid password for', email);
            return res.status(401).json({
                message: 'Email ou mot de passe incorrect'
            });
        }
        
        console.log('✅ Login successful for:', user.email, '| Role:', user.role);
        
        // Generate token
        const token = generateToken(user._id);
        
        // Update last connection
        await user.updateLastConnection(req.ip, req.get('User-Agent') || '');
        
        // Prepare user data for response
        const userData = {
            id: user._id,
            nom: user.nom,
            prenom: user.prenom,
            email: user.email,
            telephone: user.telephone,
            adresse: user.adresse,
            ville: user.ville,
            wilaya: user.wilaya,
            codePostal: user.codePostal,
            role: user.role,
            dateInscription: user.dateInscription,
            dernierConnexion: user.dernierConnexion,
            nomComplet: user.nomComplet,
            initiales: user.initiales,
            estAdmin: user.estAdmin
        };
        
        res.json({
            message: `Bienvenue ${user.prenom}! Connexion réussie.`,
            success: true,
            token,
            user: userData
        });
        
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            message: 'Erreur lors de la connexion. Veuillez réessayer.'
        });
    }
});

// @route   GET /api/auth/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .populate('adressesLivraison')
            .select('-password');
        
        if (!user) {
            return res.status(404).json({
                message: 'Utilisateur non trouvé'
            });
        }
        
        res.json({
            id: user._id,
            nom: user.nom,
            prenom: user.prenom,
            email: user.email,
            telephone: user.telephone,
            adresse: user.adresse,
            ville: user.ville,
            wilaya: user.wilaya,
            codePostal: user.codePostal,
            role: user.role,
            dateInscription: user.dateInscription,
            dernierConnexion: user.dernierConnexion,
            preferences: user.preferences,
            statistiques: user.statistiques,
            adressesLivraison: user.adressesLivraison,
            nomComplet: user.nomComplet,
            initiales: user.initiales,
            estAdmin: user.estAdmin,
            ancienneteCompte: user.ancienneteCompte
        });
        
    } catch (error) {
        console.error('❌ Profile fetch error:', error);
        res.status(500).json({
            message: 'Erreur lors du chargement du profil'
        });
    }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, async (req, res) => {
    try {
        const { 
            nom, 
            prenom, 
            telephone, 
            adresse, 
            ville, 
            wilaya, 
            codePostal, 
            preferences 
        } = req.body;
        
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                message: 'Utilisateur non trouvé'
            });
        }
        
        // Validate fields if provided
        const errors = [];
        
        if (nom && nom.trim().length < 2) {
            errors.push('Le nom doit contenir au moins 2 caractères');
        }
        
        if (prenom && prenom.trim().length < 2) {
            errors.push('Le prénom doit contenir au moins 2 caractères');
        }
        
        if (telephone) {
            if (!validatePhone(telephone)) {
                errors.push('Format de téléphone invalide');
            } else {
                // Check if phone is already used by another user
                const existingPhone = await User.findOne({ 
                    telephone: telephone.replace(/\s+/g, ''), 
                    _id: { $ne: req.user.id } 
                });
                if (existingPhone) {
                    errors.push('Ce numéro de téléphone est déjà utilisé');
                }
            }
        }
        
        if (adresse && adresse.trim().length < 10) {
            errors.push('L\'adresse doit contenir au moins 10 caractères');
        }
        
        if (errors.length > 0) {
            return res.status(400).json({
                message: 'Données invalides',
                errors
            });
        }
        
        // Update fields
        if (nom) user.nom = nom.trim();
        if (prenom) user.prenom = prenom.trim();
        if (telephone) user.telephone = telephone.replace(/\s+/g, '');
        if (adresse) user.adresse = adresse.trim();
        if (ville) user.ville = ville.trim();
        if (wilaya) user.wilaya = wilaya;
        if (codePostal) user.codePostal = codePostal.trim();
        if (preferences) user.preferences = { ...user.preferences, ...preferences };
        
        await user.save();
        
        console.log('✅ Profile updated for:', user.email);
        
        res.json({
            message: 'Profil mis à jour avec succès',
            success: true,
            user: {
                id: user._id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                telephone: user.telephone,
                adresse: user.adresse,
                ville: user.ville,
                wilaya: user.wilaya,
                codePostal: user.codePostal,
                role: user.role,
                preferences: user.preferences,
                nomComplet: user.nomComplet,
                initiales: user.initiales
            }
        });
        
    } catch (error) {
        console.error('❌ Profile update error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: 'Données invalides',
                errors: messages
            });
        }
        
        res.status(500).json({
            message: 'Erreur lors de la mise à jour du profil'
        });
    }
});

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', auth, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmNewPassword } = req.body;
        
        // Validation
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                message: 'Mot de passe actuel et nouveau mot de passe requis'
            });
        }
        
        if (!validatePassword(newPassword)) {
            return res.status(400).json({
                message: 'Le nouveau mot de passe doit contenir au moins 6 caractères'
            });
        }
        
        if (confirmNewPassword && newPassword !== confirmNewPassword) {
            return res.status(400).json({
                message: 'Les nouveaux mots de passe ne correspondent pas'
            });
        }
        
        // Find user with password
        const user = await User.findById(req.user.id).select('+password');
        if (!user) {
            return res.status(404).json({
                message: 'Utilisateur non trouvé'
            });
        }
        
        // Check current password
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                message: 'Mot de passe actuel incorrect'
            });
        }
        
        // Update password
        user.password = newPassword; // Will be hashed by pre-save hook
        await user.save();
        
        console.log('✅ Password changed for:', user.email);
        
        res.json({
            message: 'Mot de passe modifié avec succès',
            success: true
        });
        
    } catch (error) {
        console.error('❌ Password change error:', error);
        res.status(500).json({
            message: 'Erreur lors du changement de mot de passe'
        });
    }
});

// @route   POST /api/auth/verify-token
// @desc    Verify if token is valid
// @access  Public
router.post('/verify-token', async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({
                valid: false,
                message: 'Token requis'
            });
        }
        
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024');
        
        // Check if user exists and is active
        const user = await User.findById(decoded.id);
        if (!user || !user.actif) {
            return res.status(401).json({
                valid: false,
                message: 'Token invalide ou utilisateur inactif'
            });
        }
        
        res.json({
            valid: true,
            user: {
                id: user._id,
                email: user.email,
                role: user.role,
                nom: user.nom,
                prenom: user.prenom,
                nomComplet: user.nomComplet
            }
        });
        
    } catch (error) {
        console.error('❌ Token verification error:', error);
        
        let message = 'Token invalide';
        if (error.name === 'TokenExpiredError') {
            message = 'Token expiré';
        } else if (error.name === 'JsonWebTokenError') {
            message = 'Token malformé';
        }
        
        res.status(401).json({
            valid: false,
            message
        });
    }
});

// @route   POST /api/auth/refresh-token
// @desc    Refresh authentication token
// @access  Private
router.post('/refresh-token', auth, async (req, res) => {
    try {
        // Generate new token
        const newToken = generateToken(req.user._id);
        
        // Update last connection
        await req.user.updateLastConnection(req.ip, req.get('User-Agent') || '');
        
        console.log('✅ Token refreshed for:', req.user.email);
        
        res.json({
            message: 'Token rafraîchi avec succès',
            success: true,
            token: newToken,
            user: {
                id: req.user._id,
                nom: req.user.nom,
                prenom: req.user.prenom,
                email: req.user.email,
                role: req.user.role,
                nomComplet: req.user.nomComplet
            }
        });
        
    } catch (error) {
        console.error('❌ Token refresh error:', error);
        res.status(500).json({
            message: 'Erreur lors du rafraîchissement du token'
        });
    }
});

// @route   POST /api/auth/logout
// @desc    Logout user (client-side mainly, token blacklisting could be added)
// @access  Private
router.post('/logout', auth, async (req, res) => {
    try {
        console.log('👋 User logged out:', req.user.email);
        
        res.json({
            message: 'Déconnexion réussie',
            success: true
        });
        
    } catch (error) {
        console.error('❌ Logout error:', error);
        res.status(500).json({
            message: 'Erreur lors de la déconnexion'
        });
    }
});

module.exports = router;
