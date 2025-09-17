const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_for_development';

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', async (req, res) => {
    try {
        console.log('👤 New user registration attempt:', req.body.email);
        
        const {
            prenom,
            nom,
            email,
            telephone,
            password,
            adresse,
            wilaya
        } = req.body;

        // Validation des champs requis
        if (!prenom || !nom || !email || !telephone || !password || !adresse || !wilaya) {
            return res.status(400).json({
                message: 'Tous les champs sont requis'
            });
        }

        // Vérifier si l'utilisateur existe déjà
        let existingUser = await User.findOne({
            $or: [
                { email: email.toLowerCase() },
                { telephone: telephone.replace(/\s+/g, '') }
            ]
        });

        if (existingUser) {
            if (existingUser.email === email.toLowerCase()) {
                return res.status(400).json({
                    message: 'Un utilisateur avec cet email existe déjà'
                });
            } else {
                return res.status(400).json({
                    message: 'Un utilisateur avec ce téléphone existe déjà'
                });
            }
        }

        // Hasher le mot de passe
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Créer le nouvel utilisateur
        const newUser = new User({
            prenom: prenom.trim(),
            nom: nom.trim(),
            email: email.toLowerCase().trim(),
            telephone: telephone.replace(/\s+/g, ''),
            password: hashedPassword,
            adresse: adresse.trim(),
            wilaya
        });

        await newUser.save();
        console.log('✅ User registered successfully:', newUser.email);

        // Créer et signer le JWT
        const payload = {
            id: newUser._id,
            email: newUser.email,
            role: newUser.role
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });

        // Réponse sans le mot de passe
        const userResponse = {
            id: newUser._id,
            prenom: newUser.prenom,
            nom: newUser.nom,
            email: newUser.email,
            telephone: newUser.telephone,
            adresse: newUser.adresse,
            wilaya: newUser.wilaya,
            role: newUser.role,
            dateInscription: newUser.dateInscription
        };

        res.status(201).json({
            message: 'Inscription réussie',
            token,
            user: userResponse
        });

    } catch (error) {
        console.error('❌ Registration error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: messages[0] || 'Données d\'inscription invalides'
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
        console.log('🔐 Login attempt for:', req.body.email);
        
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                message: 'Email et mot de passe requis'
            });
        }

        // Chercher l'utilisateur par email
        const user = await User.findOne({ 
            email: email.toLowerCase().trim() 
        });

        if (!user) {
            return res.status(400).json({
                message: 'Identifiants invalides'
            });
        }

        // Vérifier le mot de passe
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({
                message: 'Identifiants invalides'
            });
        }

        // Vérifier si le compte est actif
        if (!user.actif) {
            return res.status(400).json({
                message: 'Compte désactivé. Contactez l\'administration.'
            });
        }

        // Mettre à jour la dernière connexion
        await user.updateLastLogin();

        // Créer et signer le JWT
        const payload = {
            id: user._id,
            email: user.email,
            role: user.role
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });

        console.log('✅ User logged in successfully:', user.email);

        // Réponse sans le mot de passe
        const userResponse = {
            id: user._id,
            prenom: user.prenom,
            nom: user.nom,
            email: user.email,
            telephone: user.telephone,
            adresse: user.adresse,
            wilaya: user.wilaya,
            role: user.role,
            dateInscription: user.dateInscription,
            derniereConnexion: user.derniereConnexion
        };

        res.json({
            message: 'Connexion réussie',
            token,
            user: userResponse
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            message: 'Erreur serveur lors de la connexion'
        });
    }
});

// @route   GET /api/auth/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
    try {
        console.log('👤 Profile request for user:', req.user.id);
        
        // Si c'est un utilisateur demo, retourner les infos demo
        if (req.user.id === 'admin-1' || req.user.id === 'user-demo') {
            return res.json(req.user);
        }

        const user = await User.findById(req.user.id).select('-password');
        
        if (!user) {
            return res.status(404).json({
                message: 'Utilisateur non trouvé'
            });
        }

        res.json({
            id: user._id,
            prenom: user.prenom,
            nom: user.nom,
            email: user.email,
            telephone: user.telephone,
            adresse: user.adresse,
            wilaya: user.wilaya,
            role: user.role,
            dateInscription: user.dateInscription,
            derniereConnexion: user.derniereConnexion
        });

    } catch (error) {
        console.error('❌ Profile fetch error:', error);
        res.status(500).json({
            message: 'Erreur serveur lors de la récupération du profil'
        });
    }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, async (req, res) => {
    try {
        console.log('✏️ Profile update for user:', req.user.id);
        
        // Si c'est un utilisateur demo, ne pas permettre la modification
        if (req.user.id === 'admin-1' || req.user.id === 'user-demo') {
            return res.status(400).json({
                message: 'Impossible de modifier un compte demo'
            });
        }

        const {
            prenom,
            nom,
            telephone,
            adresse,
            wilaya,
            preferences
        } = req.body;

        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({
                message: 'Utilisateur non trouvé'
            });
        }

        // Mettre à jour les champs si fournis
        if (prenom) user.prenom = prenom.trim();
        if (nom) user.nom = nom.trim();
        if (telephone) user.telephone = telephone.replace(/\s+/g, '');
        if (adresse) user.adresse = adresse.trim();
        if (wilaya) user.wilaya = wilaya;
        if (preferences) user.preferences = { ...user.preferences, ...preferences };

        await user.save();
        console.log('✅ Profile updated successfully for:', user.email);

        // Réponse sans le mot de passe
        const userResponse = {
            id: user._id,
            prenom: user.prenom,
            nom: user.nom,
            email: user.email,
            telephone: user.telephone,
            adresse: user.adresse,
            wilaya: user.wilaya,
            role: user.role,
            preferences: user.preferences
        };

        res.json({
            message: 'Profil mis à jour avec succès',
            user: userResponse
        });

    } catch (error) {
        console.error('❌ Profile update error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: messages[0] || 'Données de profil invalides'
            });
        }

        res.status(500).json({
            message: 'Erreur serveur lors de la mise à jour du profil'
        });
    }
});

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', auth, async (req, res) => {
    try {
        console.log('🔒 Password change request for user:', req.user.id);
        
        // Si c'est un utilisateur demo, ne pas permettre la modification
        if (req.user.id === 'admin-1' || req.user.id === 'user-demo') {
            return res.status(400).json({
                message: 'Impossible de modifier le mot de passe d\'un compte demo'
            });
        }

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

        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({
                message: 'Utilisateur non trouvé'
            });
        }

        // Vérifier le mot de passe actuel
        const isMatch = await bcrypt.compare(currentPassword, user.password);

        if (!isMatch) {
            return res.status(400).json({
                message: 'Mot de passe actuel incorrect'
            });
        }

        // Hasher le nouveau mot de passe
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        user.password = hashedPassword;
        await user.save();

        console.log('✅ Password changed successfully for:', user.email);

        res.json({
            message: 'Mot de passe modifié avec succès'
        });

    } catch (error) {
        console.error('❌ Password change error:', error);
        res.status(500).json({
            message: 'Erreur serveur lors du changement de mot de passe'
        });
    }
});

// @route   POST /api/auth/logout
// @desc    Logout user (client-side mainly)
// @access  Private
router.post('/logout', auth, (req, res) => {
    console.log('👋 User logged out:', req.user.email);
    
    res.json({
        message: 'Déconnexion réussie'
    });
});

// @route   GET /api/auth/verify-token
// @desc    Verify if token is still valid
// @access  Private
router.get('/verify-token', auth, (req, res) => {
    res.json({
        valid: true,
        user: req.user
    });
});

module.exports = router;
