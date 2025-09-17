const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

const router = express.Router();

// Debug route to check admin user exists
router.get('/debug/admin', async (req, res) => {
    try {
        console.log('🔍 Checking admin user...');
        
        const admin = await User.findOne({ email: 'pharmaciegaher@gmail.com' });
        
        if (!admin) {
            console.log('❌ Admin user not found, creating...');
            
            const salt = await bcrypt.genSalt(12);
            const hashedPassword = await bcrypt.hash('anesaya75', salt);
            
            const newAdmin = new User({
                nom: 'Gaher',
                prenom: 'Parapharmacie',
                email: 'pharmaciegaher@gmail.com',
                telephone: '+213123456789',
                adresse: 'Tipaza, Algérie',
                wilaya: 'Tipaza',
                password: hashedPassword,
                role: 'admin',
                actif: true,
                emailVerifie: true,
                telephoneVerifie: true,
                dateInscription: new Date()
            });
            
            await newAdmin.save();
            console.log('✅ Admin user created');
            
            res.json({
                message: 'Admin user created',
                email: 'pharmaciegaher@gmail.com',
                password: 'anesaya75',
                role: 'admin'
            });
        } else {
            console.log('✅ Admin user found');
            res.json({
                message: 'Admin user exists',
                email: admin.email,
                role: admin.role,
                actif: admin.actif,
                dateInscription: admin.dateInscription
            });
        }
        
    } catch (error) {
        console.error('❌ Debug admin error:', error);
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
});

// Debug route to test password comparison
router.post('/debug/password', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log('🔍 Testing password for:', email);
        
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        
        if (!user) {
            return res.json({
                found: false,
                message: 'User not found'
            });
        }
        
        console.log('User found, testing password...');
        console.log('Stored password hash:', user.password.substring(0, 20) + '...');
        console.log('Input password:', password);
        
        const isMatch = await bcrypt.compare(password, user.password);
        console.log('Password match:', isMatch);
        
        res.json({
            found: true,
            email: user.email,
            role: user.role,
            actif: user.actif,
            passwordMatch: isMatch,
            hashedPassword: user.password.substring(0, 20) + '...'
        });
        
    } catch (error) {
        console.error('❌ Debug password error:', error);
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
});

// Debug route to reset admin password
router.post('/debug/reset-admin', async (req, res) => {
    try {
        console.log('🔧 Resetting admin password...');
        
        const admin = await User.findOne({ email: 'pharmaciegaher@gmail.com' });
        
        if (!admin) {
            return res.status(404).json({
                message: 'Admin user not found'
            });
        }
        
        // Reset password
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash('anesaya75', salt);
        
        admin.password = hashedPassword;
        admin.actif = true;
        admin.role = 'admin';
        
        await admin.save();
        
        console.log('✅ Admin password reset');
        
        res.json({
            message: 'Admin password reset successfully',
            email: 'pharmaciegaher@gmail.com',
            password: 'anesaya75'
        });
        
    } catch (error) {
        console.error('❌ Reset admin error:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

// Debug route to test JWT
router.post('/debug/jwt', async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.json({
                message: 'No token provided'
            });
        }
        
        console.log('🔍 Testing JWT token...');
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shifa_parapharmacie_secret_key_2024');
            console.log('Token decoded:', decoded);
            
            const user = await User.findById(decoded.id);
            
            res.json({
                valid: true,
                decoded,
                user: user ? {
                    id: user._id,
                    email: user.email,
                    role: user.role,
                    actif: user.actif
                } : null
            });
            
        } catch (jwtError) {
            console.log('JWT error:', jwtError.message);
            res.json({
                valid: false,
                error: jwtError.message
            });
        }
        
    } catch (error) {
        console.error('❌ Debug JWT error:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

// Debug route to list all users
router.get('/debug/users', async (req, res) => {
    try {
        const users = await User.find().select('-password');
        
        res.json({
            count: users.length,
            users: users.map(user => ({
                id: user._id,
                email: user.email,
                role: user.role,
                actif: user.actif,
                dateInscription: user.dateInscription
            }))
        });
        
    } catch (error) {
        console.error('❌ Debug users error:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

module.exports = router;
