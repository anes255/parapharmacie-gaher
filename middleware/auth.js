const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Authentication middleware
const auth = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                message: 'Aucun token fourni, accès refusé' 
            });
        }
        
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024');
        
        // Get user from database
        const user = await User.findById(decoded.id);
        
        if (!user) {
            return res.status(401).json({ 
                message: 'Token invalide, utilisateur non trouvé' 
            });
        }
        
        if (!user.actif) {
            return res.status(401).json({ 
                message: 'Compte utilisateur désactivé' 
            });
        }
        
        // Add user to request object
        req.user = {
            id: user._id,
            email: user.email,
            role: user.role,
            nom: user.nom,
            prenom: user.prenom
        };
        
        next();
        
    } catch (error) {
        console.error('Auth middleware error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                message: 'Token invalide' 
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                message: 'Token expiré' 
            });
        }
        
        res.status(500).json({ 
            message: 'Erreur serveur lors de l\'authentification' 
        });
    }
};

// Admin authorization middleware
const adminAuth = async (req, res, next) => {
    try {
        // First run the auth middleware
        await new Promise((resolve, reject) => {
            auth(req, res, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                message: 'Accès refusé. Droits administrateur requis.'
            });
        }
        
        next();
        
    } catch (error) {
        console.error('Admin auth error:', error);
        res.status(500).json({
            message: 'Erreur serveur lors de la vérification des droits'
        });
    }
};

// Optional auth middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
    try {
        const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            req.user = null;
            return next();
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024');
        const user = await User.findById(decoded.id);
        
        if (user && user.actif) {
            req.user = {
                id: user._id,
                email: user.email,
                role: user.role,
                nom: user.nom,
                prenom: user.prenom
            };
        } else {
            req.user = null;
        }
        
        next();
        
    } catch (error) {
        // If token is invalid, just set user to null
        req.user = null;
        next();
    }
};

module.exports = {
    auth,
    adminAuth,
    optionalAuth
};
