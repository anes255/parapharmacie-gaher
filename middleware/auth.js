const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Main authentication middleware
const auth = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                message: 'Accès refusé. Token d\'authentification requis.'
            });
        }
        
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024');
        
        // Get user from database
        const user = await User.findById(decoded.id);
        
        if (!user) {
            return res.status(401).json({
                message: 'Token invalide. Utilisateur non trouvé.'
            });
        }
        
        if (!user.actif) {
            return res.status(401).json({
                message: 'Compte désactivé.'
            });
        }
        
        // Add user to request
        req.user = user;
        req.token = token;
        
        next();
        
    } catch (error) {
        console.error('Auth middleware error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                message: 'Token invalide.'
            });
        } else if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                message: 'Token expiré. Veuillez vous reconnecter.'
            });
        } else {
            return res.status(500).json({
                message: 'Erreur d\'authentification.'
            });
        }
    }
};

// Admin authentication middleware
const adminAuth = async (req, res, next) => {
    try {
        // First run regular auth
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
        console.error('Admin auth middleware error:', error);
        return res.status(401).json({
            message: 'Erreur d\'authentification administrateur.'
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
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024');
        const user = await User.findById(decoded.id);
        
        if (user && user.actif) {
            req.user = user;
            req.token = token;
        } else {
            req.user = null;
        }
        
        next();
        
    } catch (error) {
        // If token is invalid, continue without user
        req.user = null;
        next();
    }
};

// Rate limiting middleware
const rateLimiter = (options = {}) => {
    const { windowMs = 15 * 60 * 1000, max = 100, message = 'Trop de requêtes' } = options;
    const requests = new Map();
    
    return (req, res, next) => {
        const key = req.ip;
        const now = Date.now();
        const windowStart = now - windowMs;
        
        // Clean old entries
        const userRequests = requests.get(key) || [];
        const validRequests = userRequests.filter(timestamp => timestamp > windowStart);
        
        if (validRequests.length >= max) {
            return res.status(429).json({
                message: message,
                retryAfter: Math.ceil((validRequests[0] + windowMs - now) / 1000)
            });
        }
        
        validRequests.push(now);
        requests.set(key, validRequests);
        
        next();
    };
};

// User activity tracking middleware
const trackActivity = async (req, res, next) => {
    if (req.user) {
        try {
            // Update last connection without waiting
            setImmediate(async () => {
                try {
                    await req.user.updateLastConnection(
                        req.ip,
                        req.get('User-Agent') || ''
                    );
                } catch (error) {
                    console.error('Failed to track user activity:', error);
                }
            });
        } catch (error) {
            console.error('Activity tracking error:', error);
        }
    }
    
    next();
};

// Role-based access control
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                message: 'Authentification requise.'
            });
        }
        
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: `Accès refusé. Rôles requis: ${roles.join(', ')}.`
            });
        }
        
        next();
    };
};

// Account status check middleware
const checkAccountStatus = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            message: 'Authentification requise.'
        });
    }
    
    if (!req.user.actif) {
        return res.status(403).json({
            message: 'Compte désactivé. Contactez l\'administrateur.'
        });
    }
    
    next();
};

// Email verification middleware
const requireEmailVerification = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            message: 'Authentification requise.'
        });
    }
    
    if (!req.user.emailVerifie) {
        return res.status(403).json({
            message: 'Vérification d\'email requise.'
        });
    }
    
    next();
};

// Phone verification middleware
const requirePhoneVerification = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            message: 'Authentification requise.'
        });
    }
    
    if (!req.user.telephoneVerifie) {
        return res.status(403).json({
            message: 'Vérification de téléphone requise.'
        });
    }
    
    next();
};

// CORS preflight handler
const handleCORS = (req, res, next) => {
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token');
        return res.sendStatus(200);
    }
    next();
};

// Request validation middleware
const validateRequest = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);
        
        if (error) {
            return res.status(400).json({
                message: 'Données invalides',
                errors: error.details.map(detail => detail.message)
            });
        }
        
        next();
    };
};

// IP whitelist middleware
const requireWhitelistedIP = (allowedIPs = []) => {
    return (req, res, next) => {
        const clientIP = req.ip;
        
        if (!allowedIPs.includes(clientIP)) {
            return res.status(403).json({
                message: 'Accès refusé depuis cette adresse IP.'
            });
        }
        
        next();
    };
};

// Time-based access control
const requireTimeWindow = (startHour = 8, endHour = 20) => {
    return (req, res, next) => {
        const currentHour = new Date().getHours();
        
        if (currentHour < startHour || currentHour > endHour) {
            return res.status(403).json({
                message: `Accès autorisé uniquement entre ${startHour}h et ${endHour}h.`
            });
        }
        
        next();
    };
};

module.exports = {
    auth,
    adminAuth,
    optionalAuth,
    rateLimiter,
    trackActivity,
    requireRole,
    checkAccountStatus,
    requireEmailVerification,
    requirePhoneVerification,
    handleCORS,
    validateRequest,
    requireWhitelistedIP,
    requireTimeWindow
};
