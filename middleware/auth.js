const jwt = require('jsonwebtoken');

// Enhanced authentication middleware function
const auth = async (req, res, next) => {
    // Get token from header
    let token = req.header('x-auth-token') || req.header('Authorization');
    
    // Handle Bearer token format
    if (token && token.startsWith('Bearer ')) {
        token = token.slice(7, token.length);
    }

    // Check if no token
    if (!token) {
        console.log('❌ No token provided');
        return res.status(401).json({ 
            message: 'Aucun token fourni, accès refusé' 
        });
    }

    try {
        // For demo purposes, handle demo tokens
        if (token === 'admin-demo-token') {
            req.user = {
                id: 'admin-1',
                role: 'admin',
                email: 'pharmaciegaher@gmail.com',
                prenom: 'Admin',
                nom: 'Shifa'
            };
            console.log('✅ Demo admin token accepted');
            next();
            return;
        }

        if (token === 'user-demo-token') {
            req.user = {
                id: 'user-demo',
                role: 'user',
                email: 'user@demo.com',
                prenom: 'User',
                nom: 'Demo'
            };
            console.log('✅ Demo user token accepted');
            next();
            return;
        }

        // Verify JWT token
        const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_key_for_development';
        const decoded = jwt.verify(token, jwtSecret);
        
        console.log('🔐 Token decoded:', decoded);

        // Try to get user from database if User model is available
        try {
            const User = require('../models/User');
            const user = await User.findById(decoded.id).select('-password');
            
            if (!user) {
                console.log('❌ User not found for token');
                return res.status(401).json({ 
                    message: 'Token invalide - utilisateur non trouvé' 
                });
            }

            req.user = {
                id: user._id,
                role: user.role || 'user',
                email: user.email,
                prenom: user.prenom,
                nom: user.nom
            };
            
            console.log('✅ User authenticated:', req.user.email);
        } catch (modelError) {
            // If User model doesn't exist or database is not connected, use decoded token
            console.log('⚠️ User model not available, using token data only');
            req.user = {
                id: decoded.id,
                role: decoded.role || 'user',
                email: decoded.email,
                prenom: decoded.prenom || 'User',
                nom: decoded.nom || 'Demo'
            };
        }
        
        next();
        
    } catch (error) {
        console.error('❌ Token verification error:', error.message);
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                message: 'Token expiré' 
            });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                message: 'Token invalide' 
            });
        } else {
            return res.status(500).json({ 
                message: 'Erreur de vérification du token' 
            });
        }
    }
};

// Export the middleware function
module.exports = auth;
