const express = require('express');
const router = express.Router();

// Generate JWT Token
const generateToken = (id) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign({ id }, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024', {
        expiresIn: '30d'
    });
};

// @route   POST /api/auth/login
// @desc    Login user with comprehensive error handling
// @access  Public
router.post('/login', async (req, res) => {
    try {
        console.log('🔐 Login attempt started...');
        console.log('📧 Email received:', req.body.email);
        
        const { email, password } = req.body;
        
        // Step 1: Basic validation
        if (!email || !password) {
            console.log('❌ Missing email or password');
            return res.status(400).json({
                message: 'Email et mot de passe requis',
                step: 'validation'
            });
        }
        
        // Step 2: Check dependencies
        try {
            const bcrypt = require('bcryptjs');
            console.log('✅ bcryptjs dependency available');
        } catch (depError) {
            console.error('❌ bcryptjs dependency missing:', depError.message);
            return res.status(500).json({
                message: 'Erreur de configuration serveur - dépendance manquante',
                step: 'dependencies',
                error: 'bcryptjs not found'
            });
        }
        
        // Step 3: Check User model
        let User;
        try {
            User = require('../models/User');
            console.log('✅ User model loaded');
        } catch (modelError) {
            console.error('❌ User model not found:', modelError.message);
            
            // Emergency admin check for testing
            if (email.toLowerCase() === 'pharmaciegaher@gmail.com' && password === 'anesaya75') {
                console.log('🚨 Emergency admin login (no database)');
                const token = generateToken('emergency_admin');
                return res.json({
                    message: 'Connexion réussie (mode urgence)',
                    token,
                    user: {
                        id: 'emergency_admin',
                        nom: 'Gaher',
                        prenom: 'Admin',
                        email: 'pharmaciegaher@gmail.com',
                        role: 'admin'
                    },
                    mode: 'emergency'
                });
            }
            
            return res.status(500).json({
                message: 'Erreur de configuration serveur - modèle utilisateur manquant',
                step: 'model',
                error: modelError.message
            });
        }
        
        // Step 4: Database query
        let user;
        try {
            console.log('🔍 Searching for user in database...');
            user = await User.findOne({ 
                email: email.toLowerCase(),
                actif: true 
            }).select('+password');
            
            if (!user) {
                console.log('❌ User not found in database');
                return res.status(401).json({
                    message: 'Email ou mot de passe incorrect',
                    step: 'user_lookup'
                });
            }
            
            console.log('✅ User found:', user.email, 'Role:', user.role);
            
        } catch (dbError) {
            console.error('❌ Database query failed:', dbError.message);
            
            // Emergency admin check for database errors
            if (email.toLowerCase() === 'pharmaciegaher@gmail.com' && password === 'anesaya75') {
                console.log('🚨 Emergency admin login (database error)');
                const token = generateToken('emergency_admin');
                return res.json({
                    message: 'Connexion réussie (mode urgence - erreur base de données)',
                    token,
                    user: {
                        id: 'emergency_admin',
                        nom: 'Gaher',
                        prenom: 'Admin',
                        email: 'pharmaciegaher@gmail.com',
                        role: 'admin'
                    },
                    mode: 'emergency_db_error'
                });
            }
            
            return res.status(500).json({
                message: 'Erreur de base de données lors de la connexion',
                step: 'database',
                error: dbError.message
            });
        }
        
        // Step 5: Password verification
        try {
            const bcrypt = require('bcryptjs');
            const isMatch = await bcrypt.compare(password, user.password);
            
            if (!isMatch) {
                console.log('❌ Password mismatch for user:', user.email);
                return res.status(401).json({
                    message: 'Email ou mot de passe incorrect',
                    step: 'password_verification'
                });
            }
            
            console.log('✅ Password verified for user:', user.email);
            
        } catch (bcryptError) {
            console.error('❌ Password verification failed:', bcryptError.message);
            return res.status(500).json({
                message: 'Erreur lors de la vérification du mot de passe',
                step: 'password_check',
                error: bcryptError.message
            });
        }
        
        // Step 6: Generate token
        let token;
        try {
            token = generateToken(user._id);
            console.log('✅ Token generated successfully');
        } catch (tokenError) {
            console.error('❌ Token generation failed:', tokenError.message);
            return res.status(500).json({
                message: 'Erreur lors de la génération du token',
                step: 'token_generation',
                error: tokenError.message
            });
        }
        
        // Step 7: Update last connection
        try {
            if (user.updateLastConnection) {
                await user.updateLastConnection();
            } else {
                user.dernierConnexion = new Date();
                await user.save();
            }
            console.log('✅ Last connection updated');
        } catch (updateError) {
            console.log('⚠️ Could not update last connection:', updateError.message);
            // Don't fail login for this
        }
        
        // Step 8: Success response
        console.log('✅ Login successful for:', user.email, 'Role:', user.role);
        
        res.json({
            message: 'Connexion réussie',
            token,
            user: {
                id: user._id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                telephone: user.telephone,
                adresse: user.adresse,
                ville: user.ville,
                wilaya: user.wilaya,
                role: user.role,
                dateInscription: user.dateInscription,
                dernierConnexion: user.dernierConnexion
            },
            step: 'success'
        });
        
    } catch (error) {
        console.error('❌ Unexpected login error:', error);
        console.error('❌ Error stack:', error.stack);
        
        // Emergency admin check for any unexpected errors
        if (req.body.email?.toLowerCase() === 'pharmaciegaher@gmail.com' && req.body.password === 'anesaya75') {
            console.log('🚨 Emergency admin login (unexpected error)');
            const token = generateToken('emergency_admin');
            return res.json({
                message: 'Connexion réussie (mode urgence - erreur inattendue)',
                token,
                user: {
                    id: 'emergency_admin',
                    nom: 'Gaher',
                    prenom: 'Admin',
                    email: 'pharmaciegaher@gmail.com',
                    role: 'admin'
                },
                mode: 'emergency_unexpected'
            });
        }
        
        res.status(500).json({
            message: 'Erreur serveur lors de la connexion',
            step: 'unexpected_error',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// @route   POST /api/auth/register
// @desc    Register user
// @access  Public
router.post('/register', async (req, res) => {
    try {
        console.log('📝 Registration attempt:', req.body.email);
        
        const { nom, prenom, email, password, telephone, adresse, ville, wilaya, codePostal } = req.body;
        
        // Validation
        if (!nom || !prenom || !email || !password || !telephone || !wilaya) {
            return res.status(400).json({
                message: 'Veuillez remplir tous les champs obligatoires'
            });
        }
        
        // Try to use User model
        let User;
        try {
            User = require('../models/User');
        } catch (error) {
            return res.status(500).json({
                message: 'Erreur de configuration serveur - modèle utilisateur manquant'
            });
        }
        
        // Check if user exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                message: 'Un utilisateur avec cet email existe déjà'
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                message: 'Format d\'email invalide'
            });
        }
        
        // Validate password strength
        if (password.length < 6) {
            return res.status(400).json({
                message: 'Le mot de passe doit contenir au moins 6 caractères'
            });
        }
        
        // Create user
        const user = new User({
            nom: nom.trim(),
            prenom: prenom.trim(),
            email: email.toLowerCase().trim(),
            password, // Will be hashed by pre-save hook
            telephone: telephone.replace(/\s+/g, ''),
            adresse: adresse ? adresse.trim() : '',
            ville: ville ? ville.trim() : '',
            wilaya,
            codePostal: codePostal ? codePostal.trim() : '',
            dateInscription: new Date()
        });
        
        await user.save();
        console.log('✅ User registered successfully:', user.email);
        
        // Generate token
        const token = generateToken(user._id);
        
        res.status(201).json({
            message: 'Inscription réussie',
            token,
            user: {
                id: user._id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                telephone: user.telephone,
                adresse: user.adresse,
                ville: user.ville,
                wilaya: user.wilaya,
                role: user.role,
                dateInscription: user.dateInscription
            }
        });
        
    } catch (error) {
        console.error('❌ Registration error:', error);
        
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({
                message: `${field === 'email' ? 'Email' : 'Téléphone'} déjà utilisé`
            });
        }
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: messages[0] || 'Données invalides'
            });
        }
        
        res.status(500).json({
            message: 'Erreur serveur lors de l\'inscription'
        });
    }
});

// @route   GET /api/auth/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', async (req, res) => {
    try {
        // Simple auth check for profile
        const token = req.header('x-auth-token');
        if (!token) {
            return res.status(401).json({ message: 'Token requis' });
        }
        
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024');
        
        // Handle emergency admin
        if (decoded.id === 'emergency_admin') {
            return res.json({
                id: 'emergency_admin',
                nom: 'Gaher',
                prenom: 'Admin',
                email: 'pharmaciegaher@gmail.com',
                role: 'admin'
            });
        }
        
        const User = require('../models/User');
        const user = await User.findById(decoded.id);
        
        if (!user || !user.actif) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        
        res.json({
            id: user._id,
            nom: user.nom,
            prenom: user.prenom,
            email: user.email,
            telephone: user.telephone,
            adresse: user.adresse,
            ville: user.ville,
            wilaya: user.wilaya,
            codePostal: user.codePostal,
            role: user.role,
            dateInscription: user.dateInscription,
            dernierConnexion: user.dernierConnexion
        });
        
    } catch (error) {
        console.error('❌ Profile error:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// @route   GET /api/auth/test
// @desc    Test auth route
// @access  Public
router.get('/test', (req, res) => {
    res.json({
        message: 'Auth routes are working!',
        timestamp: new Date().toISOString(),
        endpoints: [
            'POST /api/auth/login',
            'POST /api/auth/register', 
            'GET /api/auth/profile'
        ],
        testCredentials: {
            email: 'pharmaciegaher@gmail.com',
            password: 'anesaya75'
        }
    });
});

// @route   GET /api/auth/debug
// @desc    Debug auth system
// @access  Public
router.get('/debug', async (req, res) => {
    try {
        const debug = {
            timestamp: new Date().toISOString(),
            dependencies: {},
            models: {},
            database: {},
            environment: {}
        };
        
        // Check dependencies
        try {
            require('bcryptjs');
            debug.dependencies.bcryptjs = 'available';
        } catch (error) {
            debug.dependencies.bcryptjs = 'missing';
        }
        
        try {
            require('jsonwebtoken');
            debug.dependencies.jsonwebtoken = 'available';
        } catch (error) {
            debug.dependencies.jsonwebtoken = 'missing';
        }
        
        // Check User model
        try {
            const User = require('../models/User');
            debug.models.User = 'available';
            
            // Check database connection
            try {
                const userCount = await User.countDocuments();
                debug.database.connection = 'connected';
                debug.database.userCount = userCount;
                
                // Check admin user
                const admin = await User.findOne({ email: 'pharmaciegaher@gmail.com' });
                debug.database.adminExists = !!admin;
                
            } catch (dbError) {
                debug.database.connection = 'error';
                debug.database.error = dbError.message;
            }
            
        } catch (modelError) {
            debug.models.User = 'missing';
            debug.models.error = modelError.message;
        }
        
        // Environment variables
        debug.environment.hasJWTSecret = !!process.env.JWT_SECRET;
        debug.environment.hasMongoURI = !!process.env.MONGODB_URI;
        debug.environment.nodeEnv = process.env.NODE_ENV;
        
        res.json(debug);
        
    } catch (error) {
        res.status(500).json({
            message: 'Error during debug',
            error: error.message
        });
    }
});

module.exports = router;
