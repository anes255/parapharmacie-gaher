const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024', {
        expiresIn: '30d'
    });
};

// @route   POST /api/auth/register
// @desc    Register user
// @access  Public
router.post('/register', async (req, res) => {
    try {
        console.log('📝 Registration attempt:', req.body.email);
        
        const { nom, prenom, email, password, telephone, adresse, ville, wilaya, codePostal } = req.body;
        
        // Validation
        if (!nom || !prenom || !email || !password || !telephone || !wilaya) {
            return res.status(400).json({
                message: 'Veuillez remplir tous les champs obligatoires'
            });
        }
        
        // Check if user exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                message: 'Un utilisateur avec cet email existe déjà'
            });
        }
        
        // Check if telephone exists
        const existingPhone = await User.findOne({ telephone });
        if (existingPhone) {
            return res.status(400).json({
                message: 'Ce numéro de téléphone est déjà utilisé'
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                message: 'Format d\'email invalide'
            });
        }
        
        // Validate password strength
        if (password.length < 6) {
            return res.status(400).json({
                message: 'Le mot de passe doit contenir au moins 6 caractères'
            });
        }
        
        // Validate phone format (Algerian)
        const phoneRegex = /^(\+213|0)[5-9]\d{8}$/;
        if (!phoneRegex.test(telephone.replace(/\s+/g, ''))) {
            return res.status(400).json({
                message: 'Format de téléphone invalide (numéro algérien requis)'
            });
        }
        
        // Create user
        const user = new User({
            nom: nom.trim(),
            prenom: prenom.trim(),
            email: email.toLowerCase().trim(),
            password, // Will be hashed by pre-save hook
            telephone: telephone.replace(/\s+/g, ''),
            adresse: adresse ? adresse.trim() : '',
            ville: ville ? ville.trim() : '',
            wilaya,
            codePostal: codePostal ? codePostal.trim() : '',
            dateInscription: new Date()
        });
        
        await user.save();
        console.log('✅ User registered successfully:', user.email);
        
        // Generate token
        const token = generateToken(user._id);
        
        // Update last connection
        await user.updateLastConnection();
        
        res.status(201).json({
            message: 'Inscription réussie',
            token,
            user: {
                id: user._id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                telephone: user.telephone,
                adresse: user.adresse,
                ville: user.ville,
                wilaya: user.wilaya,
                role: user.role,
                dateInscription: user.dateInscription
            }
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
                message: messages[0] || 'Données invalides'
            });
        }
        
        res.status(500).json({
            message: 'Erreur serveur lors de l\'inscription'
        });
    }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
    try {
        console.log('🔐 Login attempt:', req.body.email);
        
        const { email, password } = req.body;
        
        // Validation
        if (!email || !password) {
            return res.status(400).json({
                message: 'Email et mot de passe requis'
            });
        }
        
        // Find user and include password for comparison
        const user = await User.findOne({ 
            email: email.toLowerCase(),
            actif: true 
        }).select('+password');
        
        if (!user) {
            return res.status(401).json({
                message: 'Email ou mot de passe incorrect'
            });
        }
        
        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                message: 'Email ou mot de passe incorrect'
            });
        }
        
        console.log('✅ Login successful:', user.email, 'Role:', user.role);
        
        // Generate token
        const token = generateToken(user._id);
        
        // Update last connection
        await user.updateLastConnection();
        
        res.json({
            message: 'Connexion réussie',
            token,
            user: {
                id: user._id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                telephone: user.telephone,
                adresse: user.adresse,
                ville: user.ville,
                wilaya: user.wilaya,
                role: user.role,
                dateInscription: user.dateInscription,
                dernierConnexion: user.dernierConnexion
            }
        });
        
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            message: 'Erreur serveur lors de la connexion'
        });
    }
});

// @route   GET /api/auth/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user || !user.actif) {
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
            preferences: user.preferences
        });
        
    } catch (error) {
        console.error('❌ Profile error:', error);
        res.status(500).json({
            message: 'Erreur serveur'
        });
    }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, async (req, res) => {
    try {
        const { nom, prenom, telephone, adresse, ville, wilaya, codePostal, preferences } = req.body;
        
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                message: 'Utilisateur non trouvé'
            });
        }
        
        // Update fields if provided
        if (nom) user.nom = nom.trim();
        if (prenom) user.prenom = prenom.trim();
        if (telephone) {
            // Check if phone is already used by another user
            const existingPhone = await User.findOne({ 
                telephone, 
                _id: { $ne: req.user.id } 
            });
            if (existingPhone) {
                return res.status(400).json({
                    message: 'Ce numéro de téléphone est déjà utilisé'
                });
            }
            user.telephone = telephone.replace(/\s+/g, '');
        }
        if (adresse) user.adresse = adresse.trim();
        if (ville) user.ville = ville.trim();
        if (wilaya) user.wilaya = wilaya;
        if (codePostal) user.codePostal = codePostal.trim();
        if (preferences) user.preferences = { ...user.preferences, ...preferences };
        
        await user.save();
        
        res.json({
            message: 'Profil mis à jour avec succès',
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
                preferences: user.preferences
            }
        });
        
    } catch (error) {
        console.error('❌ Profile update error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: messages[0] || 'Données invalides'
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
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                message: 'Mot de passe actuel et nouveau mot de passe requis'
            });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({
                message: 'Le nouveau mot de passe doit contenir au moins 6 caractères'
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
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({
                message: 'Mot de passe actuel incorrect'
            });
        }
        
        // Update password
        user.password = newPassword; // Will be hashed by pre-save hook
        await user.save();
        
        res.json({
            message: 'Mot de passe modifié avec succès'
        });
        
    } catch (error) {
        console.error('❌ Password change error:', error);
        res.status(500).json({
            message: 'Erreur lors du changement de mot de passe'
        });
    }
});

// @route   POST /api/auth/verify-token
// @desc    Verify JWT token
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
        
        // Check if user exists
        const user = await User.findById(decoded.id);
        if (!user || !user.actif) {
            return res.status(401).json({
                valid: false,
                message: 'Token invalide'
            });
        }
        
        res.json({
            valid: true,
            user: {
                id: user._id,
                email: user.email,
                role: user.role
            }
        });
        
    } catch (error) {
        console.error('❌ Token verification error:', error);
        res.status(401).json({
            valid: false,
            message: 'Token invalide ou expiré'
        });
    }
});

module.exports = router;
