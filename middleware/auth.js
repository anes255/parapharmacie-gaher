const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    try {
        console.log('🔐 Checking authentication...');
        
        // Get token from header
        const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            console.log('❌ No token provided');
            return res.status(401).json({
                message: 'Accès refusé - Token requis'
            });
        }
        
        try {
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024');
            console.log('🔓 Token verified for user:', decoded.id);
            
            // Get user from database
            const user = await User.findById(decoded.id).select('-password');
            
            if (!user) {
                console.log('❌ User not found');
                return res.status(401).json({
                    message: 'Token invalide - Utilisateur non trouvé'
                });
            }
            
            if (!user.actif) {
                console.log('❌ User account inactive');
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
            
            console.log('✅ Authentication successful:', user.email, 'Role:', user.role);
            next();
            
        } catch (jwtError) {
            console.log('❌ JWT verification failed:', jwtError.message);
            
            if (jwtError.name === 'TokenExpiredError') {
                return res.status(401).json({
                    message: 'Token expiré - Veuillez vous reconnecter'
                });
            } else if (jwtError.name === 'JsonWebTokenError') {
                return res.status(401).json({
                    message: 'Token invalide'
                });
            } else {
                return res.status(401).json({
                    message: 'Erreur de vérification du token'
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Auth middleware error:', error);
        res.status(500).json({
            message: 'Erreur serveur lors de l\'authentification'
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
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024');
            const user = await User.findById(decoded.id).select('-password');
            
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
        } catch (jwtError) {
            req.user = null;
        }
        
        next();
        
    } catch (error) {
        console.error('Optional auth error:', error);
        req.user = null;
        next();
    }
};

// Admin only middleware
const adminOnly = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            message: 'Accès refusé - Droits administrateur requis'
        });
    }
    next();
};

module.exports = auth;
module.exports.optionalAuth = optionalAuth;
module.exports.adminOnly = adminOnly;
