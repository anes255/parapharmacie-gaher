const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

console.log('🚀 Starting minimal server for debugging...');

// CORS configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
}));

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Basic routes for testing
app.get('/', (req, res) => {
    res.json({
        message: 'Minimal Shifa Backend API',
        status: 'running',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        message: 'API is healthy',
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        environment: process.env.NODE_ENV || 'development'
    });
});

// Test MongoDB connection
const connectDB = async () => {
    try {
        console.log('🔗 Attempting MongoDB connection...');
        console.log('📍 MongoDB URI exists:', !!process.env.MONGODB_URI);
        
        if (!process.env.MONGODB_URI) {
            console.error('❌ MONGODB_URI not found in environment variables');
            return;
        }
        
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ MongoDB connected successfully');
        
        // Test creating admin user
        await createTestAdmin();
        
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
    }
};

// Create test admin
const createTestAdmin = async () => {
    try {
        const bcrypt = require('bcryptjs');
        
        // Simple user schema for testing
        const userSchema = new mongoose.Schema({
            nom: String,
            prenom: String,
            email: { type: String, unique: true },
            password: String,
            role: { type: String, default: 'user' },
            actif: { type: Boolean, default: true },
            telephone: String,
            wilaya: String,
            dateInscription: { type: Date, default: Date.now }
        });
        
        const User = mongoose.model('User', userSchema);
        
        let admin = await User.findOne({ email: 'pharmaciegaher@gmail.com' });
        
        if (!admin) {
            const hashedPassword = await bcrypt.hash('anesaya75', 12);
            
            admin = new User({
                nom: 'Gaher',
                prenom: 'Admin',
                email: 'pharmaciegaher@gmail.com',
                password: hashedPassword,
                role: 'admin',
                telephone: '+213123456789',
                wilaya: 'Tipaza'
            });
            
            await admin.save();
            console.log('✅ Test admin user created');
        } else {
            console.log('✅ Test admin user already exists');
        }
        
    } catch (error) {
        console.error('❌ Error creating test admin:', error.message);
    }
};

// Simple auth routes for testing
app.post('/api/auth/login', async (req, res) => {
    try {
        console.log('🔐 Login attempt:', req.body.email);
        
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                message: 'Email et mot de passe requis'
            });
        }
        
        // Check if we have the User model
        const User = mongoose.model('User');
        
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        
        if (!user) {
            return res.status(401).json({
                message: 'Email ou mot de passe incorrect'
            });
        }
        
        // Simple password check
        const bcrypt = require('bcryptjs');
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            return res.status(401).json({
                message: 'Email ou mot de passe incorrect'
            });
        }
        
        // Simple token generation
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            { id: user._id }, 
            process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024',
            { expiresIn: '30d' }
        );
        
        console.log('✅ Login successful for:', user.email);
        
        res.json({
            message: 'Connexion réussie',
            token,
            user: {
                id: user._id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                role: user.role
            }
        });
        
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            message: 'Erreur serveur lors de la connexion',
            error: error.message
        });
    }
});

app.get('/api/auth/test', (req, res) => {
    res.json({
        message: 'Auth route is working!',
        timestamp: new Date().toISOString()
    });
});

// List environment variables (safely)
app.get('/api/debug/env', (req, res) => {
    res.json({
        hasMongoURI: !!process.env.MONGODB_URI,
        hasJWTSecret: !!process.env.JWT_SECRET,
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT
    });
});

// Error handling
app.use((error, req, res, next) => {
    console.error('💥 Server error:', error);
    res.status(500).json({ 
        message: 'Erreur serveur',
        error: error.message
    });
});

// 404 handler
app.use('*', (req, res) => {
    console.log('❌ Route not found:', req.originalUrl);
    res.status(404).json({
        message: 'Route non trouvée',
        path: req.originalUrl
    });
});

// Connect to database
connectDB();

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Minimal server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Test endpoints:`);
    console.log(`   - Health: http://localhost:${PORT}/api/health`);
    console.log(`   - Auth test: http://localhost:${PORT}/api/auth/test`);
    console.log(`   - Debug env: http://localhost:${PORT}/api/debug/env`);
});
