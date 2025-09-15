const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware d'authentification
const auth = async (req, res, next) => {
    try {
        // Récupérer le token depuis l'en-tête
        const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
        
        // Vérifier si le token existe
        if (!token) {
            return res.status(401).json({
                message: 'Accès refusé. Token manquant.'
            });
        }
        
        try {
            // Vérifier et décoder le token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024');
            
            // Récupérer l'utilisateur depuis la base de données
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
            
            // Ajouter l'utilisateur à la requête
            req.user = {
                id: user._id,
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

// Middleware optionnel d'authentification (ne rejette pas si pas de token)
const optionalAuth = async (req, res, next) => {
    try {
        const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            // Pas de token, continuer sans utilisateur
            req.user = null;
            return next();
        }
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024');
            const user = await User.findById(decoded.id);
            
            if (user && user.actif) {
                req.user = {
                    id: user._id,
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
            // Token invalide, continuer sans utilisateur
            req.user = null;
        }
        
        next();
        
    } catch (error) {
        console.error('Optional auth middleware error:', error);
        req.user = null;
        next();
    }
};

// Middleware pour vérifier le rôle admin
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            message: 'Authentification requise'
        });
    }
    
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            message: 'Accès refusé. Droits administrateur requis.'
        });
    }
    
    next();
};

// Middleware pour vérifier que l'utilisateur peut accéder à une ressource
const requireOwnershipOrAdmin = (resourceUserIdField = 'userId') => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                message: 'Authentification requise'
            });
        }
        
        // L'admin peut accéder à tout
        if (req.user.role === 'admin') {
            return next();
        }
        
        // Vérifier la propriété de la ressource
        const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
        
        if (!resourceUserId) {
            return res.status(400).json({
                message: 'ID utilisateur manquant dans la requête'
            });
        }
        
        if (resourceUserId !== req.user.id.toString()) {
            return res.status(403).json({
                message: 'Accès refusé. Vous ne pouvez accéder qu\'à vos propres ressources.'
            });
        }
        
        next();
    };
};

// Middleware pour limiter les tentatives de connexion
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
        
        // Réinitialiser si la fenêtre de temps est écoulée
        if (now - userAttempts.firstAttempt > WINDOW_TIME) {
            attempts.set(identifier, { count: 1, firstAttempt: now });
            return next();
        }
        
        // Vérifier si la limite est atteinte
        if (userAttempts.count >= MAX_ATTEMPTS) {
            const timeLeft = Math.ceil((WINDOW_TIME - (now - userAttempts.firstAttempt)) / 1000 / 60);
            return res.status(429).json({
                message: `Trop de tentatives de connexion. Réessayez dans ${timeLeft} minutes.`
            });
        }
        
        // Incrémenter le compteur
        userAttempts.count++;
        attempts.set(identifier, userAttempts);
        
        next();
    };
};

// Middleware pour enregistrer les tentatives de connexion échouées
const logFailedAuth = (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
        // Si c'est une erreur d'authentification, l'enregistrer
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

// Middleware pour mettre à jour la dernière activité
const updateLastActivity = async (req, res, next) => {
    if (req.user && req.user.id) {
        try {
            // Mettre à jour en arrière-plan
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
            // Ne pas faire échouer la requête si la mise à jour échoue
            console.error('Error in updateLastActivity:', error);
        }
    }
    
    next();
};

// Middleware pour extraire les informations du client
const extractClientInfo = (req, res, next) => {
    req.clientInfo = {
        ip: req.ip || req.connection.remoteAddress || req.socket.remoteAddress,
        userAgent: req.get('User-Agent') || '',
        timestamp: new Date()
    };
    
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
    extractClientInfo
};
