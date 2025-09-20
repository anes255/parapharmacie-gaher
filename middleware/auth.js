const jwt = require('jsonwebtoken');

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
            
            try {
                // Try to get User model
                const User = require('../models/User');
                
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
                
            } catch (dbError) {
                console.error('Database error in auth:', dbError.message);
                
                // Fallback to token data if database unavailable
                req.user = {
                    id: decoded.id,
                    email: decoded.email,
                    nom: decoded.nom || '',
                    prenom: decoded.prenom || '',
                    role: decoded.role || 'user',
                    actif: true
                };
                
                next();
            }
            
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

module.exports = auth;
