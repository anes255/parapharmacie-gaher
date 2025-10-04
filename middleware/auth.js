const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Main authentication middleware - FIXED
const auth = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
        
        // Check if token exists
        if (!token) {
            return res.status(401).json({
                message: 'Aucun token fourni, accès refusé'
            });
        }
        
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024');
        
        console.log('🔍 Token decoded:', { id: decoded.id });
        
        // CRITICAL FIX: Use decoded.id instead of decoded.userId to match token generation
        const user = await User.findById(decoded.id).select('-password');
        
        console.log('🔍 User lookup result:', user ? `Found: ${user.email}` : 'NOT FOUND');
        
        if (!user) {
            console.error('❌ User not found for token ID:', decoded.id);
            return res.status(401).json({
                message: 'Token invalide, utilisateur non trouvé'
            });
        }
        
        if (!user.actif) {
            return res.status(401).json({
                message: 'Compte désactivé'
            });
        }
        
        // Add user info to request - using consistent field names
        req.user = {
            id: user._id.toString(),
            userId: user._id, // Keep both for backwards compatibility
            email: user.email,
            role: user.role,
            prenom: user.prenom,
            nom: user.nom,
            actif: user.actif
        };
        
        console.log('✅ Auth successful for:', user.email, 'Role:', user.role);
        next();
        
    } catch (error) {
        console.error('❌ Auth middleware error:', error);
        
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
            message: 'Erreur de vérification du token',
            error: error.message
        });
    }
};

// Admin role check middleware
const requireAdmin = (req, res, next) => {
    try {
        console.log('🔐 Checking admin role for user:', req.user?.email);
        
        if (!req.user) {
            return res.status(401).json({
                message: 'Authentication requise'
            });
        }
        
        if (req.user.role !== 'admin') {
            console.log('❌ Access denied - user role:', req.user.role);
            return res.status(403).json({
                message: 'Accès refusé - privilèges administrateur requis'
            });
        }
        
        console.log('✅ Admin access granted to:', req.user.email);
        next();
        
    } catch (error) {
        console.error('❌ Admin check error:', error);
        res.status(500).json({
            message: 'Erreur lors de la vérification des privilèges',
            error: error.message
        });
    }
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
    try {
        const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            req.user = null;
            return next();
        }
        
        // CRITICAL FIX: Use decoded.id instead of decoded.userId
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024');
        const user = await User.findById(decoded.id).select('-password');
        
        if (user && user.actif) {
            req.user = {
                id: user._id.toString(),
                userId: user._id,
                email: user.email,
                role: user.role,
                prenom: user.prenom,
                nom: user.nom,
                actif: user.actif
            };
        } else {
            req.user = null;
        }
        
        next();
        
    } catch (error) {
        // If token is invalid, just set user to null and continue
        req.user = null;
        next();
    }
};

// User role check middleware (excludes guests)
const requireUser = (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                message: 'Authentication requise'
            });
        }
        
        if (!['client', 'admin'].includes(req.user.role)) {
            return res.status(403).json({
                message: 'Accès refusé - compte utilisateur requis'
            });
        }
        
        next();
        
    } catch (error) {
        console.error('❌ User check error:', error);
        res.status(500).json({
            message: 'Erreur lors de la vérification du compte utilisateur',
            error: error.message
        });
    }
};

// Check if user owns resource or is admin
const requireOwnershipOrAdmin = (userIdField = 'userId') => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    message: 'Authentication requise'
                });
            }
            
            // Admin can access everything
            if (req.user.role === 'admin') {
                return next();
            }
            
            // Check ownership - handle both id and userId for flexibility
            const resourceUserId = req.params[userIdField] || req.body[userIdField];
            const currentUserId = req.user.id || req.user.userId?.toString();
            
            if (!resourceUserId || resourceUserId !== currentUserId) {
                return res.status(403).json({
                    message: 'Accès refusé - vous ne pouvez accéder qu\'à vos propres ressources'
                });
            }
            
            next();
            
        } catch (error) {
            console.error('❌ Ownership check error:', error);
            res.status(500).json({
                message: 'Erreur lors de la vérification des droits d\'accès',
                error: error.message
            });
        }
    };
};

module.exports = {
    auth,
    requireAdmin,
    optionalAuth,
    requireUser,
    requireOwnershipOrAdmin
};
