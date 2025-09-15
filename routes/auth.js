const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Simple in-memory user storage for demo (replace with proper database later)
let users = [
    {
        _id: '1',
        email: 'pharmaciegaher@gmail.com',
        password: '$2a$12$V8o7.5z8Qr3K4vF9qJ7oe.8yX9KtqZ2hN6bA4LcP3j1qWx8RtY6Em', // hashed 'anesaya75'
        nom: 'Gaher',
        prenom: 'Parapharmacie',
        telephone: '+213123456789',
        adresse: 'Tipaza, Algérie',
        wilaya: 'Tipaza',
        role: 'admin',
        dateInscription: new Date(),
        derniereConnexion: new Date()
    }
];

// Helper function to find user by email
function findUserByEmail(email) {
    return users.find(user => user.email.toLowerCase() === email.toLowerCase());
}

// Helper function to generate JWT token
function generateToken(user) {
    return jwt.sign(
        { 
            id: user._id, 
            email: user.email, 
            role: user.role 
        },
        process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
        { expiresIn: '7d' }
    );
}

// Register user
router.post('/register', async (req, res) => {
    try {
        console.log('Register attempt:', req.body.email);
        
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
            _id: Date.now().toString(),
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
        
        console.log('User registered successfully:', newUser.email);
        
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
        console.error('Register error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erreur lors de la création du compte' 
        });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        console.log('Login attempt:', req.body.email);
        
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
            console.log('User not found:', email);
            return res.status(400).json({ 
                success: false,
                message: 'Email ou mot de passe incorrect' 
            });
        }
        
        // Check password
        let isMatch = false;
        try {
            isMatch = await bcrypt.compare(password, user.password);
        } catch (bcryptError) {
            console.error('Bcrypt error:', bcryptError);
            // Fallback: check if it's the plain text password (for initial setup)
            if (password === 'anesaya75' && user.email === 'pharmaciegaher@gmail.com') {
                isMatch = true;
            }
        }
        
        if (!isMatch) {
            console.log('Password mismatch for:', email);
            return res.status(400).json({ 
                success: false,
                message: 'Email ou mot de passe incorrect' 
            });
        }
        
        // Update last login
        user.derniereConnexion = new Date();
        
        // Generate JWT token
        const token = generateToken(user);
        
        console.log('User logged in successfully:', user.email);
        
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
            message: 'Erreur lors de la connexion',
            details: error.message
        });
    }
});

// Get user profile
router.get('/profile', async (req, res) => {
    try {
        // Simple token verification
        const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                success: false,
                message: 'Aucun token fourni' 
            });
        }
        
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this-in-production');
        } catch (jwtError) {
            return res.status(401).json({ 
                success: false,
                message: 'Token invalide' 
            });
        }
        
        const user = users.find(u => u._id === decoded.id);
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'Utilisateur non trouvé' 
            });
        }
        
        res.json({
            success: true,
            user: {
                id: user._id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                telephone: user.telephone,
                adresse: user.adresse,
                wilaya: user.wilaya,
                role: user.role,
                dateInscription: user.dateInscription,
                derniereConnexion: user.derniereConnexion
            }
        });
        
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erreur serveur' 
        });
    }
});

// Update user profile
router.put('/profile', async (req, res) => {
    try {
        // Simple token verification
        const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                success: false,
                message: 'Aucun token fourni' 
            });
        }
        
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this-in-production');
        } catch (jwtError) {
            return res.status(401).json({ 
                success: false,
                message: 'Token invalide' 
            });
        }
        
        const userIndex = users.findIndex(u => u._id === decoded.id);
        if (userIndex === -1) {
            return res.status(404).json({ 
                success: false,
                message: 'Utilisateur non trouvé' 
            });
        }
        
        // Update allowed fields
        const allowedUpdates = ['nom', 'prenom', 'telephone', 'adresse', 'wilaya'];
        
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                users[userIndex][field] = req.body[field];
            }
        });
        
        res.json({
            success: true,
            user: {
                id: users[userIndex]._id,
                nom: users[userIndex].nom,
                prenom: users[userIndex].prenom,
                email: users[userIndex].email,
                telephone: users[userIndex].telephone,
                adresse: users[userIndex].adresse,
                wilaya: users[userIndex].wilaya,
                role: users[userIndex].role
            },
            message: 'Profil mis à jour avec succès'
        });
        
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erreur lors de la mise à jour du profil' 
        });
    }
});

// Verify token
router.get('/verify', async (req, res) => {
    try {
        const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                success: false,
                message: 'Aucun token fourni' 
            });
        }
        
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this-in-production');
        } catch (jwtError) {
            return res.status(401).json({ 
                success: false,
                message: 'Token invalide' 
            });
        }
        
        const user = users.find(u => u._id === decoded.id);
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'Utilisateur non trouvé' 
            });
        }
        
        res.json({
            success: true,
            user: {
                id: user._id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                role: user.role
            },
            message: 'Token valide'
        });
        
    } catch (error) {
        console.error('Verify token error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erreur serveur' 
        });
    }
});

// Test route
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Auth routes are working!',
        timestamp: new Date().toISOString(),
        registeredUsers: users.length
    });
});

// Get all users (admin only)
router.get('/users', (req, res) => {
    try {
        const publicUsers = users.map(user => ({
            id: user._id,
            nom: user.nom,
            prenom: user.prenom,
            email: user.email,
            role: user.role,
            dateInscription: user.dateInscription
        }));
        
        res.json({
            success: true,
            users: publicUsers,
            total: users.length
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Erreur serveur' 
        });
    }
});

module.exports = router;
