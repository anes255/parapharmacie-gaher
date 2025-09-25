const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Simple rate limiter middleware function
const rateLimiter = (maxRequests = 5, windowMs = 15 * 60 * 1000) => {
    const requests = new Map();
    
    return (req, res, next) => {
        const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
        const now = Date.now();
        
        if (!requests.has(clientIP)) {
            requests.set(clientIP, []);
        }
        
        const clientRequests = requests.get(clientIP);
        const validRequests = clientRequests.filter(timestamp => now - timestamp < windowMs);
        
        if (validRequests.length >= maxRequests) {
            return res.status(429).json({
                message: 'Trop de tentatives. Veuillez réessayer plus tard.'
            });
        }
        
        validRequests.push(now);
        requests.set(clientIP, validRequests);
        next();
    };
};

// @route   POST /api/auth/register
// @desc    Register user
// @access  Public
router.post('/register', rateLimiter(5, 15 * 60 * 1000), async (req, res) => {
    try {
        console.log('📝 Registration attempt:', req.body.email);
        
        const { prenom, nom, email, motDePasse, telephone } = req.body;
        
        // Validation
        if (!prenom || !nom || !email || !motDePasse) {
            return res.status(400).json({
                message: 'Tous les champs obligatoires doivent être remplis'
            });
        }
        
        if (motDePasse.length < 6) {
            return res.status(400).json({
                message: 'Le mot de passe doit contenir au moins 6 caractères'
            });
        }
        
        // Check if user already exists
        let user = await User.findOne({ email: email.toLowerCase() });
        if (user) {
            return res.status(400).json({
                message: 'Un utilisateur avec cet email existe déjà'
            });
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(motDePasse, salt);
        
        // Create user
        user = new User({
            prenom,
            nom,
            email: email.toLowerCase(),
            motDePasse: hashedPassword,
            telephone,
            role: 'client',
            actif: true,
            dateInscription: new Date()
        });
        
        await user.save();
        console.log('✅ User registered successfully:', user.email);
        
        // Generate JWT token
        const payload = {
            userId: user._id,
            email: user.email,
            role: user.role
        };
        
        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET || 'fallback_secret_key',
            { expiresIn: '7d' }
        );
        
        // Return user data without password
        const userData = {
            _id: user._id,
            prenom: user.prenom,
            nom: user.nom,
            email: user.email,
            telephone: user.telephone,
            role: user.role,
            actif: user.actif,
            dateInscription: user.dateInscription
        };
        
        res.status(201).json({
            message: 'Inscription réussie',
            token,
            user: userData
        });
        
    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({
            message: 'Erreur serveur lors de l\'inscription',
            error: error.message
        });
    }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', rateLimiter(5, 15 * 60 * 1000), async (req, res) => {
    try {
        console.log('🔐 Login attempt for:', req.body.email);
        
        const { email, motDePasse } = req.body;
        
        // Validation
        if (!email || !motDePasse) {
            return res.status(400).json({
                message: 'Email et mot de passe requis'
            });
        }
        
        // Check if user exists
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(400).json({
                message: 'Identifiants invalides'
            });
        }
        
        // Check if user is active
        if (!user.actif) {
            return res.status(400).json({
                message: 'Compte désactivé. Contactez l\'administrateur.'
            });
        }
        
        // Validate password
        const isMatch = await bcrypt.compare(motDePasse, user.motDePasse);
        if (!isMatch) {
            return res.status(400).json({
                message: 'Identifiants invalides'
            });
        }
        
        console.log('✅ Login successful for:', user.email);
        
        // Update last login
        user.derniereConnexion = new Date();
        await user.save();
        
        // Generate JWT token
        const payload = {
            userId: user._id,
            email: user.email,
            role: user.role
        };
        
        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET || 'fallback_secret_key',
            { expiresIn: '7d' }
        );
        
        // Return user data without password
        const userData = {
            _id: user._id,
            prenom: user.prenom,
            nom: user.nom,
            email: user.email,
            telephone: user.telephone,
            role: user.role,
            actif: user.actif,
            dateInscription: user.dateInscription,
            derniereConnexion: user.derniereConnexion
        };
        
        res.json({
            message: 'Connexion réussie',
            token,
            user: userData
        });
        
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            message: 'Erreur serveur lors de la connexion',
            error: error.message
        });
    }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-motDePasse');
        if (!user) {
            return res.status(404).json({
                message: 'Utilisateur non trouvé'
            });
        }
        
        res.json(user);
        
    } catch (error) {
        console.error('❌ Get user error:', error);
        res.status(500).json({
            message: 'Erreur serveur lors de la récupération du profil',
            error: error.message
        });
    }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, async (req, res) => {
    try {
        const { prenom, nom, telephone } = req.body;
        
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({
                message: 'Utilisateur non trouvé'
            });
        }
        
        // Update fields
        if (prenom) user.prenom = prenom;
        if (nom) user.nom = nom;
        if (telephone) user.telephone = telephone;
        
        await user.save();
        
        // Return updated user without password
        const userData = await User.findById(user._id).select('-motDePasse');
        
        res.json({
            message: 'Profil mis à jour avec succès',
            user: userData
        });
        
    } catch (error) {
        console.error('❌ Update profile error:', error);
        res.status(500).json({
            message: 'Erreur lors de la mise à jour du profil',
            error: error.message
        });
    }
});

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', auth, async (req, res) => {
    try {
        const { motDePasseActuel, nouveauMotDePasse } = req.body;
        
        if (!motDePasseActuel || !nouveauMotDePasse) {
            return res.status(400).json({
                message: 'Mot de passe actuel et nouveau mot de passe requis'
            });
        }
        
        if (nouveauMotDePasse.length < 6) {
            return res.status(400).json({
                message: 'Le nouveau mot de passe doit contenir au moins 6 caractères'
            });
        }
        
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({
                message: 'Utilisateur non trouvé'
            });
        }
        
        // Validate current password
        const isMatch = await bcrypt.compare(motDePasseActuel, user.motDePasse);
        if (!isMatch) {
            return res.status(400).json({
                message: 'Mot de passe actuel incorrect'
            });
        }
        
        // Hash new password
        const salt = await bcrypt.genSalt(10);
        user.motDePasse = await bcrypt.hash(nouveauMotDePasse, salt);
        
        await user.save();
        
        res.json({
            message: 'Mot de passe modifié avec succès'
        });
        
    } catch (error) {
        console.error('❌ Change password error:', error);
        res.status(500).json({
            message: 'Erreur lors du changement de mot de passe',
            error: error.message
        });
    }
});

module.exports = router;
