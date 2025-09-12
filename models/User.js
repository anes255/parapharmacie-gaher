const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    nom: {
        type: String,
        required: [true, 'Le nom est requis'],
        trim: true,
        maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères']
    },
    prenom: {
        type: String,
        required: [true, 'Le prénom est requis'],
        trim: true,
        maxlength: [50, 'Le prénom ne peut pas dépasser 50 caractères']
    },
    email: {
        type: String,
        required: [true, 'L\'email est requis'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [
            /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
            'Veuillez entrer un email valide'
        ]
    },
    telephone: {
        type: String,
        required: [true, 'Le téléphone est requis'],
        trim: true,
        match: [
            /^(\+213|0)[1-9][0-9]{8}$/,
            'Veuillez entrer un numéro de téléphone algérien valide'
        ]
    },
    password: {
        type: String,
        required: [true, 'Le mot de passe est requis'],
        minlength: [6, 'Le mot de passe doit contenir au moins 6 caractères']
    },
    adresse: {
        type: String,
        required: [true, 'L\'adresse est requise'],
        trim: true,
        maxlength: [200, 'L\'adresse ne peut pas dépasser 200 caractères']
    },
    wilaya: {
        type: String,
        required: [true, 'La wilaya est requise'],
        trim: true,
        enum: [
            'Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi', 'Batna', 'Béjaïa', 'Biskra',
            'Béchar', 'Blida', 'Bouira', 'Tamanrasset', 'Tébessa', 'Tlemcen', 'Tiaret',
            'Tizi Ouzou', 'Alger', 'Djelfa', 'Jijel', 'Sétif', 'Saïda', 'Skikda',
            'Sidi Bel Abbès', 'Annaba', 'Guelma', 'Constantine', 'Médéa', 'Mostaganem',
            'M\'Sila', 'Mascara', 'Ouargla', 'Oran', 'El Bayadh', 'Illizi', 'Bordj Bou Arréridj',
            'Boumerdès', 'El Tarf', 'Tindouf', 'Tissemsilt', 'El Oued', 'Khenchela',
            'Souk Ahras', 'Tipaza', 'Mila', 'Aïn Defla', 'Naâma', 'Aïn Témouchent',
            'Ghardaïa', 'Relizane'
        ]
    },
    codePostal: {
        type: String,
        default: '',
        trim: true,
        match: [/^\d{5}$/, 'Le code postal doit contenir 5 chiffres']
    },
    role: {
        type: String,
        enum: ['client', 'admin'],
        default: 'client'
    },
    actif: {
        type: Boolean,
        default: true
    },
    emailVerifie: {
        type: Boolean,
        default: false
    },
    telephoneVerifie: {
        type: Boolean,
        default: false
    },
    dateNaissance: {
        type: Date,
        default: null
    },
    genre: {
        type: String,
        enum: ['homme', 'femme', 'autre', ''],
        default: ''
    },
    preferences: {
        newsletter: {
            type: Boolean,
            default: true
        },
        notifications: {
            email: {
                type: Boolean,
                default: true
            },
            sms: {
                type: Boolean,
                default: false
            }
        },
        categoriesPreferees: [{
            type: String,
            enum: [
                'Vitalité', 'Sport', 'Visage', 'Cheveux', 'Solaire',
                'Intime', 'Soins', 'Bébé', 'Homme', 'Dentaire'
            ]
        }]
    },
    historiqueConnexions: [{
        date: {
            type: Date,
            default: Date.now
        },
        ip: String,
        userAgent: String
    }],
    derniereConnexion: {
        type: Date,
        default: Date.now
    },
    // Reset password fields
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    // Email verification fields
    emailVerificationToken: String,
    emailVerificationExpire: Date
}, {
    timestamps: true
});

// Indexes for better performance
UserSchema.index({ email: 1 });
UserSchema.index({ telephone: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ actif: 1 });

// Virtual for full name
UserSchema.virtual('nomComplet').get(function() {
    return `${this.prenom} ${this.nom}`;
});

// Pre-save middleware to hash password
UserSchema.pre('save', async function(next) {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) return next();
    
    try {
        // Hash password with cost of 12
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Instance method to check password
UserSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Instance method to generate JWT token
UserSchema.methods.getSignedJwtToken = function() {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
        { userId: this._id },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: process.env.JWT_EXPIRE || '30d' }
    );
};

// Instance method to generate password reset token
UserSchema.methods.getResetPasswordToken = function() {
    const crypto = require('crypto');
    
    // Generate token
    const resetToken = crypto.randomBytes(20).toString('hex');
    
    // Hash token and set to resetPasswordToken field
    this.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
    
    // Set expire (10 minutes)
    this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    
    return resetToken;
};

// Instance method to generate email verification token
UserSchema.methods.getEmailVerificationToken = function() {
    const crypto = require('crypto');
    
    // Generate token
    const verificationToken = crypto.randomBytes(20).toString('hex');
    
    // Hash token and set to emailVerificationToken field
    this.emailVerificationToken = crypto
        .createHash('sha256')
        .update(verificationToken)
        .digest('hex');
    
    // Set expire (24 hours)
    this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000;
    
    return verificationToken;
};

// Instance method to record login
UserSchema.methods.recordLogin = function(ip, userAgent) {
    this.derniereConnexion = new Date();
    this.historiqueConnexions.unshift({
        date: new Date(),
        ip: ip,
        userAgent: userAgent
    });
    
    // Keep only last 10 connections
    if (this.historiqueConnexions.length > 10) {
        this.historiqueConnexions = this.historiqueConnexions.slice(0, 10);
    }
};

// Static method to find by email
UserSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

// Static method to find active users
UserSchema.statics.findActive = function() {
    return this.find({ actif: true });
};

// Static method to find by role
UserSchema.statics.findByRole = function(role) {
    return this.find({ role: role, actif: true });
};

// Pre-remove middleware to handle cascade deletions
UserSchema.pre('remove', async function(next) {
    try {
        // Here you could add logic to handle related data
        // For example, anonymize orders instead of deleting them
        console.log(`User ${this.email} is being removed`);
        next();
    } catch (error) {
        next(error);
    }
});

module.exports = mongoose.model('User', UserSchema);
