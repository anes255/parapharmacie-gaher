const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

// In-memory users storage (will persist during server session)
let users = [];

// Initialize admin user on startup
async function initializeAdmin() {
    try {
        // Check if admin already exists
        const adminExists = users.find(u => u.email === 'pharmaciegaher@gmail.com');
        if (!adminExists) {
            console.log('Creating admin user...');
            
            // Hash the admin password properly
            const salt = await bcrypt.genSalt(12);
            const hashedPassword = await bcrypt.hash('anesaya75', salt);
            
            const adminUser = {
                _id: 'admin_' + Date.now(),
                email: 'pharmaciegaher@gmail.com',
                password: hashedPassword,
                nom: 'Gaher',
                prenom: 'Parapharmacie',
                telephone: '+213123456789',
                adresse: 'Tipaza, Algérie',
                wilaya: 'Tipaza',
                role: 'admin',
                dateInscription: new Date(),
                derniereConnexion: new Date()
            };
            
            users.push(adminUser);
            console.log('✅ Admin user created successfully');
        }
    } catch (error) {
        console.error('Error creating admin user:', error);
    }
}

// Initialize admin user when module loads
initializeAdmin();

// Helper functions
function findUserByEmail(email) {
    return users.find(user => user.email.toLowerCase() === email.toLowerCase());
}

function generateToken(user) {
    return jwt.sign(
        { 
            id: user._id, 
            email: user.email, 
            role: user.role 
        },
        process.env.JWT_SECRET || 'shifa-parapharmacie-secret-key-2024',
        { expiresIn: '7d' }
    );
}

// Register user
router.post('/register', async (req, res) => {
    try {
        console.log('Registration attempt for:', req.body.email);
        
        const { nom, prenom, email, password, telephone, adresse, wilaya } = req.body;
        
        // Validation
        if (!nom || !prenom || !email || !password || !telephone || !adresse || !wilaya) {
            return res.status(400).json({ 
                success: false,
                message: 'Tous les champs sont obligatoires' 
            });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ 
                success: false,
                message: 'Le mot de passe doit contenir au moins 6 caractères' 
            });
        }
        
        // Check if user already exists
        const existingUser = findUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ 
                success: false,
                message: 'Un utilisateur avec cet email existe déjà' 
            });
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Create user
        const newUser = {
            _id: 'user_' + Date.now(),
            nom: nom.trim(),
            prenom: prenom.trim(),
            email: email.trim().toLowerCase(),
            password: hashedPassword,
            telephone: telephone.trim(),
            adresse: adresse.trim(),
            wilaya: wilaya.trim(),
            role: 'user',
            dateInscription: new Date(),
            derniereConnexion: new Date()
        };
        
        users.push(newUser);
        
        // Generate JWT token
        const token = generateToken(newUser);
        
        console.log('✅ User registered successfully:', newUser.email);
        
        res.status(201).json({
            success: true,
            token,
            user: {
                id: newUser._id,
                nom: newUser.nom,
                prenom: newUser.prenom,
                email: newUser.email,
                telephone: newUser.telephone,
                adresse: newUser.adresse,
                wilaya: newUser.wilaya,
                role: newUser.role
            },
            message: 'Compte créé avec succès'
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erreur lors de la création du compte' 
        });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        console.log('Login attempt for:', req.body.email);
        
        const { email, password } = req.body;
        
        // Validation
        if (!email || !password) {
            return res.status(400).json({ 
                success: false,
                message: 'Email et mot de passe requis' 
            });
        }
        
        // Find user
        const user = findUserByEmail(email);
        if (!user) {
            console.log('❌ User not found:', email);
            return res.status(400).json({ 
                success: false,
                message: 'Email ou mot de passe incorrect' 
            });
        }
        
        // Check password
        let isMatch = false;
        try {
            isMatch = await bcrypt.compare(password, user.password);
            console.log('Password comparison result:', isMatch);
        } catch (bcryptError) {
            console.error('Bcrypt comparison error:', bcryptError);
            return res.status(500).json({ 
                success: false,
                message: 'Erreur de vérification du mot de passe' 
            });
        }
        
        if (!isMatch) {
            console.log('❌ Password mismatch for:', email);
            return res.status(400).json({ 
                success: false,
                message: 'Email ou mot de passe incorrect' 
            });
        }
        
        // Update last login
        user.derniereConnexion = new Date();
        
        // Generate JWT token
        const token = generateToken(user);
        
        console.log('✅ User logged in successfully:', user.email);
        
        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                telephone: user.telephone,
                adresse: user.adresse,
                wilaya: user.wilaya,
                role: user.role
            },
            message: 'Connexion réussie'
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erreur lors de la connexion' 
        });
    }
});

// Verify token middleware
function verifyToken(req, res, next) {
    const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ 
            success: false,
            message: 'Aucun token fourni' 
        });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shifa-parapharmacie-secret-key-2024');
        const user = users.find(u => u._id === decoded.id);
        
        if (!user) {
            return res.status(401).json({ 
                success: false,
                message: 'Token invalide - utilisateur non trouvé' 
            });
        }
        
        req.user = user;
        next();
    } catch (jwtError) {
        console.error('JWT verification error:', jwtError);
        return res.status(401).json({ 
            success: false,
            message: 'Token invalide' 
        });
    }
}

// Get user profile
router.get('/profile', verifyToken, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user._id,
            nom: req.user.nom,
            prenom: req.user.prenom,
            email: req.user.email,
            telephone: req.user.telephone,
            adresse: req.user.adresse,
            wilaya: req.user.wilaya,
            role: req.user.role,
            dateInscription: req.user.dateInscription,
            derniereConnexion: req.user.derniereConnexion
        }
    });
});

// Verify token endpoint
router.get('/verify', verifyToken, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user._id,
            nom: req.user.nom,
            prenom: req.user.prenom,
            email: req.user.email,
            role: req.user.role
        },
        message: 'Token valide'
    });
});

// Test endpoint
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Auth system is working!',
        timestamp: new Date().toISOString(),
        totalUsers: users.length,
        adminExists: !!users.find(u => u.role === 'admin')
    });
});

// Debug endpoint (remove in production)
router.get('/debug', (req, res) => {
    const publicUsers = users.map(user => ({
        id: user._id,
        email: user.email,
        role: user.role,
        hasPassword: !!user.password
    }));
    
    res.json({
        success: true,
        users: publicUsers,
        message: 'Debug info - remove in production!'
    });
});

module.exports = router;
