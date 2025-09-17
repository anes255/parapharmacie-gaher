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
    const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Main authentication middleware
const auth = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
        
        // Check if no token
        if (!token) {
            return res.status(401).json({
                message: 'Accès refusé. Token manquant.'
            });
        }
        
        try {
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024');
            
            console.log('🔍 Token decoded for user ID:', decoded.id);
            
            // Get user from database
            const user = await User.findById(decoded.id);
            
            if (!user) {
                console.log('❌ User not found for ID:', decoded.id);
                return res.status(401).json({
                    message: 'Token invalide. Utilisateur non trouvé.'
                });
            }
            
            if (!user.actif) {
                console.log('❌ User account inactive:', user.email);
                return res.status(401).json({
                    message: 'Compte désactivé.'
                });
            }
            
            console.log('✅ User authenticated:', user.email, 'Role:', user.role);
            
            // Add user to request object
            req.user = {
                id: user._id.toString(),
                email: user.email,
                nom: user.nom,
                prenom: user.prenom,
                role: user.role,
                actif: user.actif
            };
            
            next();
            
        } catch (jwtError) {
            console.error('JWT Error:', jwtError.message);
            
            if (jwtError.name === 'TokenExpiredError') {
                return res.status(401).json({
                    message: 'Token expiré. Veuillez vous reconnecter.'
                });
            } else if (jwtError.name === 'JsonWebTokenError') {
                return res.status(401).json({
                    message: 'Token invalide.'
                });
            } else {
                return res.status(401).json({
                    message: 'Erreur de vérification du token.'
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
        const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            // No token, continue without user
            req.user = null;
            return next();
        }
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024');
            const user = await User.findById(decoded.id);
            
            if (user && user.actif) {
                req.user = {
                    id: user._id.toString(),
                    email: user.email,
                    nom: user.nom,
                    prenom: user.prenom,
                    role: user.role,
                    actif: user.actif
                };
            } else {
                req.user = null;
            }
        } catch (jwtError) {
            // Invalid token, continue without user
            req.user = null;
        }
        
        next();
        
    } catch (error) {
        console.error('Optional auth middleware error:', error);
        req.user = null;
        next();
    }
};

// Admin role verification middleware
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            message: 'Authentification requise'
        });
    }
    
    if (req.user.role !== 'admin') {
        console.log('❌ Access denied for non-admin user:', req.user.email);
        return res.status(403).json({
            message: 'Accès refusé. Droits administrateur requis.'
        });
    }
    
    console.log('✅ Admin access granted for:', req.user.email);
    next();
};

// Ownership or admin verification middleware
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
        const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
        
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

// Rate limiting middleware for authentication endpoints
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
        
        // Reset if window has passed
        if (now - userAttempts.firstAttempt > WINDOW_TIME) {
            attempts.set(identifier, { count: 1, firstAttempt: now });
            return next();
        }
        
        // Check if limit reached
        if (userAttempts.count >= MAX_ATTEMPTS) {
            const timeLeft = Math.ceil((WINDOW_TIME - (now - userAttempts.firstAttempt)) / 1000 / 60);
            return res.status(429).json({
                message: `Trop de tentatives de connexion. Réessayez dans ${timeLeft} minutes.`
            });
        }
        
        // Increment counter
        userAttempts.count++;
        attempts.set(identifier, userAttempts);
        
        next();
    };
};

// Log failed authentication attempts
const logFailedAuth = (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
        // Log authentication failures
        if (res.statusCode === 401 || res.statusCode === 403) {
            console.log(`🚫 Failed auth attempt: ${req.method} ${req.path} from ${req.ip} - Status: ${res.statusCode}`);
            
            if (req.body.email) {
                console.log(`   Email: ${req.body.email}`);
            }
        }
        
        return originalSend.call(this, data);
    };
    
    next();
};

// Update last activity timestamp
const updateLastActivity = async (req, res, next) => {
    if (req.user && req.user.id) {
        try {
            // Update in background without waiting
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
            // Don't fail the request if this fails
            console.error('Error in updateLastActivity:', error);
        }
    }
    
    next();
};

// Extract client information
const extractClientInfo = (req, res, next) => {
    req.clientInfo = {
        ip: req.ip || req.connection.remoteAddress || req.socket.remoteAddress,
        userAgent: req.get('User-Agent') || '',
        timestamp: new Date()
    };
    
    next();
};

// Validate API key for certain endpoints (if needed)
const validateApiKey = (req, res, next) => {
    const apiKey = req.header('X-API-Key');
    
    if (!apiKey) {
        return res.status(401).json({
            message: 'Clé API manquante'
        });
    }
    
    // In production, validate against stored API keys
    const validApiKey = process.env.API_KEY || 'shifa_api_key_2024';
    
    if (apiKey !== validApiKey) {
        return res.status(401).json({
            message: 'Clé API invalide'
        });
    }
    
    next();
};

// CORS middleware for auth endpoints
const authCORS = (req, res, next) => {
    // Set CORS headers specifically for auth endpoints
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-auth-token');
    res.header('Access-Control-Allow-Credentials', 'false');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    next();
};

// Middleware to ensure HTTPS in production
const requireHTTPS = (req, res, next) => {
    if (process.env.NODE_ENV === 'production' && !req.secure) {
        return res.status(403).json({
            message: 'HTTPS requis en production'
        });
    }
    next();
};

// Debug middleware for authentication testing
const debugAuth = (req, res, next) => {
    if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Auth Debug Info:');
        console.log('  Method:', req.method);
        console.log('  Path:', req.path);
        console.log('  Headers:', {
            'x-auth-token': req.header('x-auth-token') ? '***PROVIDED***' : 'MISSING',
            'authorization': req.header('Authorization') ? '***PROVIDED***' : 'MISSING'
        });
        console.log('  User:', req.user ? `${req.user.email} (${req.user.role})` : 'NOT_AUTHENTICATED');
    }
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
    validateApiKey,
    authCORS,
    requireHTTPS,
    debugAuth
};
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
