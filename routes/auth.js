const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// Inscription
router.post('/register', async (req, res) => {
    try {
        const { nom, prenom, email, telephone, adresse, wilaya, password } = req.body;

        // Validation des données
        if (!nom || !prenom || !email || !password) {
            return res.status(400).json({ message: 'Tous les champs requis doivent être remplis' });
        }

        // Vérifier si l'utilisateur existe déjà  
        let user = await User.findOne({ email: email.toLowerCase() });
        if (user) {
            return res.status(400).json({ message: 'Un utilisateur avec cet email existe déjà' });
        }

        // Hashage du mot de passe
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Créer l'utilisateur
        user = new User({
            nom,
            prenom,
            email: email.toLowerCase(),
            telephone,
            adresse,
            wilaya,
            password: hashedPassword
        });

        await user.save();
        console.log('✅ Utilisateur créé:', user.email, 'Role:', user.role);

        // Créer le token JWT
        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
            if (err) throw err;
            res.json({
                token,
                user: {
                    id: user.id,
                    nom: user.nom,
                    prenom: user.prenom,
                    email: user.email,
                    telephone: user.telephone,
                    adresse: user.adresse,
                    wilaya: user.wilaya,
                    role: user.role
                }
            });
        });

    } catch (error) {
        console.error('❌ Erreur inscription:', error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'inscription' });
    }
});

// Connexion
router.post('/login', async (req, res) => {
    try {
        console.log('🔐 Tentative de connexion pour:', req.body.email);
        const { email, password } = req.body;

        // Validation des données
        if (!email || !password) {
            console.log('❌ Email ou mot de passe manquant');
            return res.status(400).json({ message: 'Email et mot de passe requis' });
        }

        console.log('🔍 Recherche de l\'utilisateur:', email.toLowerCase());

        // Vérifier si l'utilisateur existe - INCLURE LE MOT DE PASSE
        let user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        if (!user) {
            console.log('❌ Utilisateur non trouvé:', email);
            return res.status(400).json({ message: 'Email ou mot de passe incorrect' });
        }

        console.log('✅ Utilisateur trouvé:', user.email);
        console.log('👑 Rôle:', user.role);
        console.log('🔐 Password hash présent:', !!user.password);
        console.log('📏 Longueur du hash:', user.password ? user.password.length : 0);

        // Vérifier que le mot de passe existe
        if (!user.password) {
            console.log('❌ Mot de passe manquant dans la base de données pour:', email);
            return res.status(500).json({ message: 'Erreur de configuration du compte. Veuillez contacter l\'administrateur.' });
        }

        // Vérifier le mot de passe
        console.log('🔍 Vérification du mot de passe...');
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log('❌ Mot de passe incorrect pour:', email);
            return res.status(400).json({ message: 'Email ou mot de passe incorrect' });
        }

        console.log('✅ Authentification réussie pour:', user.email, 'Role:', user.role);

        // Vérifier que JWT_SECRET existe
        if (!process.env.JWT_SECRET) {
            console.error('❌ JWT_SECRET non défini');
            return res.status(500).json({ message: 'Configuration serveur incorrecte' });
        }

        // Créer le token JWT
        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        console.log('🎫 Token créé avec succès pour:', user.email);

        res.json({
            token,
            user: {
                id: user.id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                telephone: user.telephone,
                adresse: user.adresse,
                wilaya: user.wilaya,
                role: user.role
            }
        });

    } catch (error) {
        console.error('❌ Erreur connexion détaillée:', error);
        res.status(500).json({ 
            message: 'Erreur serveur lors de la connexion',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Middleware d'authentification
const auth = (req, res, next) => {
    const token = req.header('x-auth-token');

    if (!token) {
        return res.status(401).json({ message: 'Accès refusé - Token manquant' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (error) {
        console.error('❌ Erreur vérification token:', error);
        res.status(401).json({ message: 'Token invalide' });
    }
};

// Profil utilisateur
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        res.json(user);
    } catch (error) {
        console.error('❌ Erreur récupération profil:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Mettre à jour le profil
router.put('/profile', auth, async (req, res) => {
    try {
        const { nom, prenom, telephone, adresse, wilaya } = req.body;
        
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { nom, prenom, telephone, adresse, wilaya },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        res.json(user);
    } catch (error) {
        console.error('❌ Erreur mise à jour profil:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Route de test pour vérifier l'état des utilisateurs
router.get('/test-users', async (req, res) => {
    try {
        const users = await User.find({}).select('+password');
        const userInfo = users.map(user => ({
            email: user.email,
            role: user.role,
            hasPassword: !!user.password,
            passwordLength: user.password ? user.password.length : 0
        }));
        
        res.json({
            message: 'État des utilisateurs',
            users: userInfo,
            totalUsers: users.length
        });
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la récupération des utilisateurs' });
    }
});

module.exports = router;