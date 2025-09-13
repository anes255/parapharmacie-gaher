const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Helper function to generate JWT token
const generateToken = (userId) => {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: process.env.JWT_EXPIRE || '30d' }
    );
};

// POST /api/auth/register - Register new user
router.post('/register', async (req, res) => {
    try {
        const {
            nom,
            prenom,
            email,
            telephone,
            password,
            adresse,
            wilaya,
            codePostal
        } = req.body;
        
        // Validation
        if (!nom || !prenom || !email || !telephone || !password || !adresse || !wilaya) {
            return res.status(400).json({
                message: 'Tous les champs obligatoires doivent être remplis'
            });
        }
        
        // Check if user already exists
        const existingUser = await User.findOne({ 
            $or: [
                { email: email.toLowerCase() },
                { telephone: telephone }
            ]
        });
        
        if (existingUser) {
            if (existingUser.email === email.toLowerCase()) {
                return res.status(400).json({ message: 'Un compte avec cet email existe déjà' });
            } else {
                return res.status(400).json({ message: 'Un compte avec ce numéro de téléphone existe déjà' });
            }
        }
        
        // Validate password length
        if (password.length < 6) {
            return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' });
        }
        
        // Create user
        const user = new User({
            nom: nom.trim(),
            prenom: prenom.trim(),
            email: email.toLowerCase().trim(),
            telephone: telephone.trim(),
            password,
            adresse: adresse.trim(),
            wilaya,
            codePostal: codePostal ? codePostal.trim() : ''
        });
        
        await user.save();
        
        // Generate token
        const token = generateToken(user._id);
        
        // Record login
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');
        user.recordLogin(ip, userAgent);
        await user.save();
        
        // Return user data (without password)
        const userData = {
            _id: user._id,
            nom: user.nom,
            prenom: user.prenom,
            email: user.email,
            telephone: user.telephone,
            adresse: user.adresse,
            wilaya: user.wilaya,
            codePostal: user.codePostal,
            role: user.role,
            actif: user.actif,
            dateInscription: user.createdAt
        };
        
        res.status(201).json({
            message: 'Compte créé avec succès',
            token,
            user: userData
        });
        
        console.log(`New user registered: ${user.email}`);
        
    } catch (error) {
        console.error('Register error:', error);
        
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: errors.join(', ') });
        }
        
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Un compte avec ces informations existe déjà' });
        }
        
        res.status(500).json({ message: 'Erreur serveur lors de l\'inscription' });
    }
});

// POST /api/auth/login - Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validation
        if (!email || !password) {
            return res.status(400).json({ message: 'Email et mot de passe requis' });
        }
        
        // Find user by email
        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) {
            return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
        }
        
        // Check if user is active
        if (!user.actif) {
            return res.status(401).json({ message: 'Compte désactivé. Contactez l\'administrateur.' });
        }
        
        // Check password
        const isPasswordMatch = await user.matchPassword(password);
        
        if (!isPasswordMatch) {
            return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
        }
        
        // Generate token
        const token = generateToken(user._id);
        
        // Record login
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');
        user.recordLogin(ip, userAgent);
        await user.save();
        
        // Return user data (without password)
        const userData = {
            _id: user._id,
            nom: user.nom,
            prenom: user.prenom,
            email: user.email,
            telephone: user.telephone,
            adresse: user.adresse,
            wilaya: user.wilaya,
            codePostal: user.codePostal,
            role: user.role,
            actif: user.actif,
            derniereConnexion: user.derniereConnexion
        };
        
        res.json({
            message: 'Connexion réussie',
            token,
            user: userData
        });
        
        console.log(`User logged in: ${user.email}`);
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la connexion' });
    }
});

// GET /api/auth/profile - Get current user profile
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        
        res.json(user);
        
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// PUT /api/auth/profile - Update user profile
router.put('/profile', auth, async (req, res) => {
    try {
        const {
            nom,
            prenom,
            telephone,
            adresse,
            wilaya,
            codePostal,
            dateNaissance,
            genre,
            preferences
        } = req.body;
        
        const user = await User.findById(req.user._id);
        
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        
        // Check if telephone is being changed and is unique
        if (telephone && telephone !== user.telephone) {
            const existingUser = await User.findOne({ 
                telephone: telephone,
                _id: { $ne: user._id }
            });
            
            if (existingUser) {
                return res.status(400).json({ message: 'Ce numéro de téléphone est déjà utilisé' });
            }
        }
        
        // Update fields
        if (nom) user.nom = nom.trim();
        if (prenom) user.prenom = prenom.trim();
        if (telephone) user.telephone = telephone.trim();
        if (adresse) user.adresse = adresse.trim();
        if (wilaya) user.wilaya = wilaya;
        if (codePostal !== undefined) user.codePostal = codePostal.trim();
        if (dateNaissance) user.dateNaissance = new Date(dateNaissance);
        if (genre) user.genre = genre;
        if (preferences) {
            user.preferences = { ...user.preferences, ...preferences };
        }
        
        await user.save();
        
        // Return updated user (without password)
        const updatedUser = await User.findById(user._id).select('-password');
        
        res.json({
            message: 'Profil mis à jour avec succès',
            user: updatedUser
        });
        
    } catch (error) {
        console.error('Update profile error:', error);
        
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: errors.join(', ') });
        }
        
        res.status(500).json({ message: 'Erreur serveur lors de la mise à jour' });
    }
});

// PUT /api/auth/change-password - Change password
router.put('/change-password', auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        // Validation
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Mot de passe actuel et nouveau mot de passe requis' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'Le nouveau mot de passe doit contenir au moins 6 caractères' });
        }
        
        const user = await User.findById(req.user._id);
        
        // Check current password
        const isCurrentPasswordMatch = await user.matchPassword(currentPassword);
        
        if (!isCurrentPasswordMatch) {
            return res.status(400).json({ message: 'Mot de passe actuel incorrect' });
        }
        
        // Update password
        user.password = newPassword;
        await user.save();
        
        res.json({ message: 'Mot de passe changé avec succès' });
        
        console.log(`Password changed for user: ${user.email}`);
        
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: 'Erreur serveur lors du changement de mot de passe' });
    }
});

// POST /api/auth/forgot-password - Request password reset
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ message: 'Email requis' });
        }
        
        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) {
            // Don't reveal if email exists or not for security
            return res.json({ message: 'Si un compte avec cet email existe, un lien de réinitialisation a été envoyé' });
        }
        
        // Generate reset token
        const resetToken = user.getResetPasswordToken();
        await user.save();
        
        // In a real application, you would send an email here
        // For now, we'll just return success
        console.log(`Password reset requested for: ${user.email}, token: ${resetToken}`);
        
        res.json({ 
            message: 'Si un compte avec cet email existe, un lien de réinitialisation a été envoyé',
            // For development only - remove in production
            ...(process.env.NODE_ENV === 'development' && { resetToken })
        });
        
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// PUT /api/auth/reset-password/:resetToken - Reset password
router.put('/reset-password/:resetToken', async (req, res) => {
    try {
        const { password } = req.body;
        
        if (!password) {
            return res.status(400).json({ message: 'Nouveau mot de passe requis' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' });
        }
        
        // Hash the token to compare with database
        const crypto = require('crypto');
        const resetPasswordToken = crypto
            .createHash('sha256')
            .update(req.params.resetToken)
            .digest('hex');
        
        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        });
        
        if (!user) {
            return res.status(400).json({ message: 'Token invalide ou expiré' });
        }
        
        // Set new password
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        
        await user.save();
        
        // Generate new JWT token
        const token = generateToken(user._id);
        
        res.json({
            message: 'Mot de passe réinitialisé avec succès',
            token
        });
        
        console.log(`Password reset successful for user: ${user.email}`);
        
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// POST /api/auth/logout - Logout (client-side mainly)
router.post('/logout', auth, async (req, res) => {
    try {
        // In a JWT system, logout is mainly handled client-side by removing the token
        // But we can log the logout event
        console.log(`User logged out: ${req.user.email}`);
        
        res.json({ message: 'Déconnexion réussie' });
        
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// DELETE /api/auth/account - Delete account
router.delete('/account', auth, async (req, res) => {
    try {
        const { password } = req.body;
        
        if (!password) {
            return res.status(400).json({ message: 'Mot de passe requis pour supprimer le compte' });
        }
        
        const user = await User.findById(req.user._id);
        
        // Verify password
        const isPasswordMatch = await user.matchPassword(password);
        
        if (!isPasswordMatch) {
            return res.status(400).json({ message: 'Mot de passe incorrect' });
        }
        
        // For admins, prevent deletion if they are the only admin
        if (user.role === 'admin') {
            const adminCount = await User.countDocuments({ role: 'admin', actif: true });
            if (adminCount <= 1) {
                return res.status(400).json({ message: 'Impossible de supprimer le dernier compte administrateur' });
            }
        }
        
        // Instead of hard delete, deactivate the account
        user.actif = false;
        user.email = `deleted_${Date.now()}_${user.email}`;
        await user.save();
        
        console.log(`Account deactivated: ${req.user.email}`);
        
        res.json({ message: 'Compte supprimé avec succès' });
        
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

module.exports = router;
