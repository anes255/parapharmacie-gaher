const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Basic authentication middleware
const auth = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('x-auth-token');
        
        if (!token) {
            return res.status(401).json({ message: 'Token manquant, accès refusé' });
        }
        
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        // Get user from database
        const user = await User.findById(decoded.userId).select('-password');
        if (!user) {
            return res.status(401).json({ message: 'Utilisateur non trouvé' });
        }
        
        // Add user to request
        req.user = user;
        next();
        
    } catch (error) {
        console.error('Auth middleware error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Token invalide' });
        } else if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expiré' });
        }
        
        res.status(500).json({ message: 'Erreur serveur' });
    }
};

// Admin authentication middleware
const adminAuth = async (req, res, next) => {
    try {
        // First run basic auth
        await new Promise((resolve, reject) => {
            auth(req, res, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Accès administrateur requis' });
        }
        
        next();
        
    } catch (error) {
        console.error('Admin auth middleware error:', error);
        res.status(401).json({ message: 'Accès refusé' });
    }
};

// Optional auth middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
    try {
        const token = req.header('x-auth-token');
        
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            const user = await User.findById(decoded.userId).select('-password');
            if (user) {
                req.user = user;
            }
        }
        
        next();
        
    } catch (error) {
        // Don't fail, just continue without user
        console.warn('Optional auth failed:', error.message);
        next();
    }
};

module.exports = {
    auth,
    adminAuth,
    optionalAuth
};
