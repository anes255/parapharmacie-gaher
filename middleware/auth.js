const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                message: 'Aucun token fourni, accès refusé'
            });
        }
        
        try {
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024');
            
            // Find user
            const user = await User.findById(decoded.id);
            
            if (!user || !user.actif) {
                return res.status(401).json({
                    message: 'Token invalide - utilisateur introuvable'
                });
            }
            
            // Add user to request
            req.user = {
                id: user._id,
                email: user.email,
                role: user.role
            };
            
            next();
            
        } catch (tokenError) {
            console.error('Token verification failed:', tokenError.message);
            return res.status(401).json({
                message: 'Token invalide'
            });
        }
        
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({
            message: 'Erreur serveur d\'authentification'
        });
    }
};

// Admin middleware
const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({
            message: 'Accès refusé - droits administrateur requis'
        });
    }
};

// Optional auth middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
    try {
        const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
        
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024');
                const user = await User.findById(decoded.id);
                
                if (user && user.actif) {
                    req.user = {
                        id: user._id,
                        email: user.email,
                        role: user.role
                    };
                }
            } catch (tokenError) {
                // Token invalid but continue anyway
                console.log('Optional auth - invalid token:', tokenError.message);
            }
        }
        
        next();
        
    } catch (error) {
        console.error('Optional auth middleware error:', error);
        next();
    }
};

module.exports = {
    auth,
    admin,
    optionalAuth
};
