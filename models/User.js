const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    nom: {
        type: String,
        required: true,
        trim: true
    },
    prenom: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Format d\'email invalide']
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
        select: false  // Don't return password by default
    },
    telephone: {
        type: String,
        required: true,
        unique: true,
        match: [/^(\+213|0)[5-9]\d{8}$/, 'Format de téléphone invalide']
    },
    adresse: {
        type: String,
        default: ''
    },
    ville: {
        type: String,
        default: ''
    },
    wilaya: {
        type: String,
        required: true
    },
    codePostal: {
        type: String,
        default: ''
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    actif: {
        type: Boolean,
        default: true
    },
    dateInscription: {
        type: Date,
        default: Date.now
    },
    dernierConnexion: {
        type: Date,
        default: Date.now
    },
    preferences: {
        notifications: {
            type: Boolean,
            default: true
        },
        newsletter: {
            type: Boolean,
            default: false
        }
    }
}, {
    timestamps: true
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error('Erreur lors de la comparaison du mot de passe');
    }
};

// Update last connection method
UserSchema.methods.updateLastConnection = function() {
    this.dernierConnexion = new Date();
    return this.save({ validateBeforeSave: false });
};

// Index for search
UserSchema.index({ email: 1 });
UserSchema.index({ telephone: 1 });

module.exports = mongoose.model('User', UserSchema);
