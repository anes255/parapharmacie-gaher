const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Authentication middleware
const auth = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('x-auth-token');
        
        if (!token) {
            return res.status(401).json({
                message: 'Token manquant, accès refusé'
            });
        }
        
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        // Get user from database
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
            return res.status(401).json({
                message: 'Token invalide - utilisateur non trouvé'
            });
        }
        
        if (!user.actif) {
            return res.status(401).json({
                message: 'Compte utilisateur désactivé'
            });
        }
        
        // Add user to request
        req.user = user;
        next();
        
    } catch (error) {
        console.error('Auth middleware error:', error.message);
        
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

// Admin role middleware
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            message: 'Authentification requise'
        });
    }
    
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            message: 'Accès administrateur requis'
        });
    }
    
    next();
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
    try {
        const token = req.header('x-auth-token');
        
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            const user = await User.findById(decoded.id).select('-password');
            
            if (user && user.actif) {
                req.user = user;
            }
        }
        
        next();
        
    } catch (error) {
        // Silent fail - continue without user
        next();
    }
};

module.exports = {
    auth,
    requireAdmin,
    optionalAuth
};
