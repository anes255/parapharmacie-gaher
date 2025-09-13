const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Authentication middleware
const auth = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
        
        // Check if no token
        if (!token) {
            return res.status(401).json({
                message: 'Aucun token fourni, autorisation refusée'
            });
        }
        
        try {
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024');
            
            // Find user by id from token
            const user = await User.findById(decoded.id);
            
            if (!user || !user.actif) {
                return res.status(401).json({
                    message: 'Token invalide - utilisateur non trouvé'
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
            
        } catch (tokenError) {
            console.error('Token verification error:', tokenError.message);
            return res.status(401).json({
                message: 'Token invalide ou expiré'
            });
        }
        
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({
            message: 'Erreur serveur dans l\'authentification'
        });
    }
};

// Admin authentication middleware
const adminAuth = async (req, res, next) => {
    try {
        // First run the regular auth
        await new Promise((resolve, reject) => {
            auth(req, res, (error) => {
                if (error) reject(error);
                else resolve();
            });
        });
        
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                message: 'Accès refusé - Droits administrateur requis'
            });
        }
        
        next();
        
    } catch (error) {
        console.error('Admin auth error:', error);
        res.status(500).json({
            message: 'Erreur serveur dans l\'authentification administrateur'
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
                        role: user.role,
                        nom: user.nom,
                        prenom: user.prenom
                    };
                }
            } catch (tokenError) {
                // Ignore token errors in optional auth
                console.log('Optional auth - invalid token ignored');
            }
        }
        
        next();
        
    } catch (error) {
        console.error('Optional auth error:', error);
        next(); // Continue anyway
    }
};

module.exports = {
    auth,
    adminAuth,
    optionalAuth
};
