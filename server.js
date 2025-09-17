const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// CORS configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Simple User Schema
const UserSchema = new mongoose.Schema({
    nom: { type: String, required: true },
    prenom: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },
    telephone: { type: String, required: true },
    adresse: String,
    ville: String,
    wilaya: { type: String, required: true },
    codePostal: String,
    role: { type: String, enum: ['client', 'admin'], default: 'client' },
    actif: { type: Boolean, default: true },
    dateInscription: { type: Date, default: Date.now },
    dernierConnexion: Date
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Compare password method
UserSchema.methods.comparePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
};

const User = mongoose.model('User', UserSchema);

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024', {
        expiresIn: '30d'
    });
};

// Auth middleware
const auth = async (req, res, next) => {
    try {
        const token = req.header('x-auth-token');
        if (!token) {
            return res.status(401).json({ message: 'Token manquant' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024');
        const user = await User.findById(decoded.id);
        
        if (!user) {
            return res.status(401).json({ message: 'Utilisateur non trouvé' });
        }

        req.user = { id: user._id, role: user.role };
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token invalide' });
    }
};

// ROOT ROUTE
app.get('/', (req, res) => {
    res.json({
        message: 'Shifa Parapharmacie API',
        status: 'running',
        timestamp: new Date().toISOString()
    });
});

// HEALTH CHECK
app.get('/api/health', (req, res) => {
    res.json({
        message: 'API is healthy',
        status: 'running',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// AUTH ROUTES - DIRECTLY IN SERVER FILE
// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        console.log('📝 Registration attempt:', req.body.email);
        
        const { nom, prenom, email, password, telephone, wilaya, adresse, ville, codePostal } = req.body;
        
        if (!nom || !prenom || !email || !password || !telephone || !wilaya) {
            return res.status(400).json({ message: 'Tous les champs requis doivent être remplis' });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ message: 'Un utilisateur avec cet email existe déjà' });
        }

        const existingPhone = await User.findOne({ telephone });
        if (existingPhone) {
            return res.status(400).json({ message: 'Ce numéro de téléphone est déjà utilisé' });
        }

        const user = new User({
            nom: nom.trim(),
            prenom: prenom.trim(),
            email: email.toLowerCase().trim(),
            password,
            telephone: telephone.replace(/\s+/g, ''),
            adresse: adresse || '',
            ville: ville || '',
            wilaya,
            codePostal: codePostal || ''
        });

        await user.save();
        console.log('✅ User registered:', user.email);

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
                role: user.role
            }
        });

    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'inscription' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        console.log('🔐 Login attempt:', req.body.email);
        
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ message: 'Email et mot de passe requis' });
        }

        const user = await User.findOne({ 
            email: email.toLowerCase(),
            actif: true 
        }).select('+password');

        if (!user) {
            console.log('❌ User not found:', email);
            return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log('❌ Password mismatch for:', email);
            return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
        }

        console.log('✅ Login successful:', user.email, 'Role:', user.role);

        const token = generateToken(user._id);
        
        // Update last connection
        user.dernierConnexion = new Date();
        await user.save();

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
            }
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la connexion' });
    }
});

// Get Profile
app.get('/api/auth/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
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

// ADMIN ROUTES
// Admin middleware
const adminAuth = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Accès refusé - droits administrateur requis' });
    }
};

// Admin Dashboard
app.get('/api/admin/dashboard', auth, adminAuth, async (req, res) => {
    try {
        console.log('📊 Admin dashboard request');
        
        // Get basic stats
        const totalUsers = await User.countDocuments();
        const adminUsers = await User.countDocuments({ role: 'admin' });
        const clientUsers = await User.countDocuments({ role: 'client' });
        const activeUsers = await User.countDocuments({ actif: true });
        
        // Get recent users (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentUsers = await User.countDocuments({ 
            dateInscription: { $gte: thirtyDaysAgo } 
        });

        // Get users by wilaya
        const usersByWilaya = await User.aggregate([
            { $group: { _id: '$wilaya', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        const stats = {
            users: {
                total: totalUsers,
                admins: adminUsers,
                clients: clientUsers,
                active: activeUsers,
                recent: recentUsers
            },
            products: {
                total: 0, // Will be added when product model is created
                categories: 0,
                featured: 0,
                outOfStock: 0
            },
            orders: {
                total: 0, // Will be added when order model is created
                pending: 0,
                completed: 0,
                revenue: 0
            },
            analytics: {
                usersByWilaya: usersByWilaya,
                recentActivity: []
            }
        };

        console.log('✅ Dashboard stats generated');
        res.json(stats);

    } catch (error) {
        console.error('❌ Dashboard error:', error);
        res.status(500).json({ message: 'Erreur lors du chargement du dashboard' });
    }
});

// Get All Users (Admin)
app.get('/api/admin/users', auth, adminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const users = await User.find()
            .select('-password')
            .sort({ dateInscription: -1 })
            .skip(skip)
            .limit(limit);

        const totalUsers = await User.countDocuments();

        res.json({
            users,
            totalUsers,
            currentPage: page,
            totalPages: Math.ceil(totalUsers / limit)
        });

    } catch (error) {
        console.error('❌ Get users error:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération des utilisateurs' });
    }
});

// Update User Status (Admin)
app.put('/api/admin/users/:id/status', auth, adminAuth, async (req, res) => {
    try {
        const { actif } = req.body;
        
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { actif },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        res.json({
            message: `Utilisateur ${actif ? 'activé' : 'désactivé'} avec succès`,
            user
        });

    } catch (error) {
        console.error('❌ Update user status error:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour' });
    }
});

// Create Admin User Function
async function createAdminUser() {
    try {
        const adminExists = await User.findOne({ role: 'admin' });
        if (adminExists) {
            console.log('✅ Admin user already exists');
            return;
        }

        const admin = new User({
            nom: 'Gaher',
            prenom: 'Parapharmacie',
            email: 'pharmaciegaher@gmail.com',
            password: 'anesaya75',
            telephone: '+213123456789',
            adresse: 'Tipaza, Algérie',
            wilaya: 'Tipaza',
            role: 'admin'
        });

        await admin.save();
        console.log('✅ Admin user created successfully');

    } catch (error) {
        console.error('❌ Admin creation error:', error);
    }
}

// MongoDB Connection
const connectDB = async () => {
    try {
        console.log('🔄 Connecting to MongoDB...');
        
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ MongoDB connected');
        await createAdminUser();
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        setTimeout(connectDB, 10000);
    }
};

// Error handler
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
});

// 404 handler
app.use('*', (req, res) => {
    console.log(`❓ 404 - Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        message: 'Route non trouvée',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});

// Start server
connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Health: http://localhost:${PORT}/api/health`);
    console.log(`🔐 Login: http://localhost:${PORT}/api/auth/login`);
});
