const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Main authentication middleware
const auth = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('x-auth-token') || 
                     req.header('Authorization')?.replace('Bearer ', '') ||
                     req.headers.authorization?.replace('Bearer ', '');
        
        // Check if no token
        if (!token) {
            return res.status(401).json({
                message: 'Accès refusé. Token d\'authentification manquant.'
            });
        }
        
        try {
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024');
            
            // Get user from database
            const user = await User.findById(decoded.id).select('-password');
            
            if (!user) {
                return res.status(401).json({
                    message: 'Token invalide. Utilisateur non trouvé.'
                });
            }
            
            if (!user.actif) {
                return res.status(401).json({
                    message: 'Compte utilisateur désactivé.'
                });
            }
            
            // Add user to request object
            req.user = {
                id: user._id.toString(),
                email: user.email,
                nom: user.nom,
                prenom: user.prenom,
                role: user.role,
                actif: user.actif,
                wilaya: user.wilaya
            };
            
            next();
            
        } catch (jwtError) {
            console.error('JWT verification error:', jwtError.message);
            
            if (jwtError.name === 'TokenExpiredError') {
                return res.status(401).json({
                    message: 'Token expiré. Veuillez vous reconnecter.',
                    code: 'TOKEN_EXPIRED'
                });
            } else if (jwtError.name === 'JsonWebTokenError') {
                return res.status(401).json({
                    message: 'Token invalide.',
                    code: 'TOKEN_INVALID'
                });
            } else {
                return res.status(401).json({
                    message: 'Erreur de vérification du token.',
                    code: 'TOKEN_ERROR'
                });
            }
        }
        
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({
            message: 'Erreur serveur lors de l\'authentification'
        });
    }
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
    try {
        const token = req.header('x-auth-token') || 
                     req.header('Authorization')?.replace('Bearer ', '') ||
                     req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            req.user = null;
            return next();
        }
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024');
            const user = await User.findById(decoded.id).select('-password');
            
            if (user && user.actif) {
                req.user = {
                    id: user._id.toString(),
                    email: user.email,
                    nom: user.nom,
                    prenom: user.prenom,
                    role: user.role,
                    actif: user.actif,
                    wilaya: user.wilaya
                };
            } else {
                req.user = null;
            }
        } catch (jwtError) {
            req.user = null;
        }
        
        next();
        
    } catch (error) {
        console.error('Optional auth middleware error:', error);
        req.user = null;
        next();
    }
};

// Admin role middleware
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            message: 'Authentification requise pour accéder à cette ressource.'
        });
    }
    
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            message: 'Accès refusé. Droits administrateur requis.',
            code: 'ADMIN_REQUIRED'
        });
    }
    
    next();
};

// Ownership or admin middleware
const requireOwnershipOrAdmin = (resourceUserIdField = 'userId') => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                message: 'Authentification requise'
            });
        }
        
        // Admin can access everything
        if (req.user.role === 'admin') {
            return next();
        }
        
        // Check resource ownership
        const resourceUserId = req.params[resourceUserIdField] || 
                              req.body[resourceUserIdField] ||
                              req.query[resourceUserIdField];
        
        if (!resourceUserId) {
            return res.status(400).json({
                message: 'ID utilisateur manquant dans la requête'
            });
        }
        
        if (resourceUserId !== req.user.id) {
            return res.status(403).json({
                message: 'Accès refusé. Vous ne pouvez accéder qu\'à vos propres ressources.'
            });
        }
        
        next();
    };
};

// Rate limiting middleware
const rateLimitAuth = () => {
    const attempts = new Map();
    const MAX_ATTEMPTS = 5;
    const WINDOW_TIME = 15 * 60 * 1000; // 15 minutes
    
    return (req, res, next) => {
        const identifier = req.ip + ':' + (req.body.email || req.body.telephone || '');
        const now = Date.now();
        
        if (!attempts.has(identifier)) {
            attempts.set(identifier, { count: 1, firstAttempt: now });
            return next();
        }
        
        const userAttempts = attempts.get(identifier);
        
        // Reset if window expired
        if (now - userAttempts.firstAttempt > WINDOW_TIME) {
            attempts.set(identifier, { count: 1, firstAttempt: now });
            return next();
        }
        
        // Check if limit reached
        if (userAttempts.count >= MAX_ATTEMPTS) {
            const timeLeft = Math.ceil((WINDOW_TIME - (now - userAttempts.firstAttempt)) / 1000 / 60);
            return res.status(429).json({
                message: `Trop de tentatives de connexion. Réessayez dans ${timeLeft} minutes.`,
                retryAfter: timeLeft
            });
        }
        
        // Increment counter
        userAttempts.count++;
        attempts.set(identifier, userAttempts);
        
        next();
    };
};

// Failed auth logging middleware
const logFailedAuth = (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
        if (res.statusCode === 401 || res.statusCode === 403) {
            console.log(`🚫 Failed auth attempt: ${req.method} ${req.path} from ${req.ip} - Status: ${res.statusCode}`);
            
            if (req.body && req.body.email) {
                console.log(`   Email: ${req.body.email}`);
            }
        }
        
        return originalSend.call(this, data);
    };
    
    next();
};

// Update last activity middleware
const updateLastActivity = async (req, res, next) => {
    if (req.user && req.user.id) {
        try {
            // Update in background without blocking request
            setImmediate(async () => {
                try {
                    await User.findByIdAndUpdate(req.user.id, {
                        dernierConnexion: new Date()
                    });
                } catch (error) {
                    console.error('Error updating last activity:', error);
                }
            });
        } catch (error) {
            console.error('Error in updateLastActivity:', error);
        }
    }
    
    next();
};

// Extract client info middleware
const extractClientInfo = (req, res, next) => {
    req.clientInfo = {
        ip: req.ip || 
            req.connection?.remoteAddress || 
            req.socket?.remoteAddress ||
            req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
            'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        timestamp: new Date(),
        method: req.method,
        path: req.path
    };
    
    next();
};

// Validate token format middleware
const validateTokenFormat = (req, res, next) => {
    const token = req.header('x-auth-token') || 
                 req.header('Authorization')?.replace('Bearer ', '') ||
                 req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
        // Basic JWT format validation
        const parts = token.split('.');
        if (parts.length !== 3) {
            return res.status(401).json({
                message: 'Format de token invalide.',
                code: 'INVALID_TOKEN_FORMAT'
            });
        }
    }
    
    next();
};

// CSRF protection middleware (simple)
const csrfProtection = (req, res, next) => {
    // Skip CSRF for GET requests and API endpoints
    if (req.method === 'GET' || req.path.startsWith('/api/')) {
        return next();
    }
    
    const token = req.headers['x-csrf-token'] || req.body._csrf;
    
    // In production, implement proper CSRF token validation
    // For now, just pass through
    next();
};

module.exports = {
    auth,
    optionalAuth,
    requireAdmin,
    requireOwnershipOrAdmin,
    rateLimitAuth,
    logFailedAuth,
    updateLastActivity,
    extractClientInfo,
    validateTokenFormat,
    csrfProtection
};
