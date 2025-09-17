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
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Format d\'email invalide']
    },
    password: {
        type: String,
        required: [true, 'Le mot de passe est requis'],
        minlength: [6, 'Le mot de passe doit contenir au moins 6 caractères'],
        select: false  // Don't return password by default
    },
    telephone: {
        type: String,
        required: [true, 'Le téléphone est requis'],
        unique: true,
        trim: true,
        match: [/^(\+213|0)[5-9]\d{8}$/, 'Format de téléphone invalide (numéro algérien requis)']
    },
    adresse: {
        type: String,
        default: '',
        trim: true,
        maxlength: [200, 'L\'adresse ne peut pas dépasser 200 caractères']
    },
    ville: {
        type: String,
        default: '',
        trim: true,
        maxlength: [50, 'La ville ne peut pas dépasser 50 caractères']
    },
    wilaya: {
        type: String,
        required: [true, 'La wilaya est requise'],
        trim: true
    },
    codePostal: {
        type: String,
        default: '',
        trim: true,
        maxlength: [10, 'Le code postal ne peut pas dépasser 10 caractères']
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
        },
        langue: {
            type: String,
            default: 'fr',
            enum: ['fr', 'ar', 'en']
        }
    },
    statistiques: {
        nombreCommandes: {
            type: Number,
            default: 0
        },
        totalDepense: {
            type: Number,
            default: 0
        },
        derniereCommande: {
            type: Date,
            default: null
        }
    }
}, {
    timestamps: true,
    toJSON: {
        transform: function(doc, ret) {
            delete ret.password;
            return ret;
        }
    }
});

// Index pour les recherches fréquentes
UserSchema.index({ email: 1 });
UserSchema.index({ telephone: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ actif: 1 });

// Hash password before saving
UserSchema.pre('save', async function(next) {
    // Only hash password if it has been modified (or is new)
    if (!this.isModified('password')) return next();
    
    try {
        console.log('🔐 Hashing password for user:', this.email);
        
        // Generate salt and hash password
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        
        console.log('✅ Password hashed successfully');
        next();
    } catch (error) {
        console.error('❌ Password hashing failed:', error);
        next(error);
    }
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        if (!candidatePassword || !this.password) {
            return false;
        }
        
        console.log('🔍 Comparing passwords for user:', this.email);
        const isMatch = await bcrypt.compare(candidatePassword, this.password);
        console.log('🔍 Password comparison result:', isMatch);
        
        return isMatch;
    } catch (error) {
        console.error('❌ Password comparison error:', error);
        return false;
    }
};

// Method to update last connection
UserSchema.methods.updateLastConnection = function() {
    this.dernierConnexion = new Date();
    return this.save({ validateBeforeSave: false });
};

// Method to get public profile (without sensitive data)
UserSchema.methods.getPublicProfile = function() {
    return {
        _id: this._id,
        nom: this.nom,
        prenom: this.prenom,
        email: this.email,
        telephone: this.telephone,
        adresse: this.adresse,
        ville: this.ville,
        wilaya: this.wilaya,
        role: this.role,
        dateInscription: this.dateInscription,
        dernierConnexion: this.dernierConnexion,
        preferences: this.preferences,
        statistiques: this.statistiques
    };
};

// Static method to find user by email with password
UserSchema.statics.findByEmailWithPassword = function(email) {
    return this.findOne({ email: email.toLowerCase(), actif: true }).select('+password');
};

// Static method to validate password strength
UserSchema.statics.validatePassword = function(password) {
    const errors = [];
    
    if (!password || password.length < 6) {
        errors.push('Le mot de passe doit contenir au moins 6 caractères');
    }
    
    if (!/[A-Za-z]/.test(password)) {
        errors.push('Le mot de passe doit contenir au moins une lettre');
    }
    
    if (!/[0-9]/.test(password)) {
        errors.push('Le mot de passe doit contenir au moins un chiffre');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

// Virtual for full name
UserSchema.virtual('nomComplet').get(function() {
    return `${this.prenom} ${this.nom}`;
});

// Virtual to check if user is admin
UserSchema.virtual('estAdmin').get(function() {
    return this.role === 'admin';
});

// Method to update user statistics after order
UserSchema.methods.updateStatistiquesCommande = async function(montantCommande) {
    this.statistiques.nombreCommandes += 1;
    this.statistiques.totalDepense += montantCommande;
    this.statistiques.derniereCommande = new Date();
    
    return this.save({ validateBeforeSave: false });
};

// Pre-remove middleware to handle user deletion
UserSchema.pre('remove', async function(next) {
    try {
        // Here you could add logic to handle orders when user is deleted
        // For example, anonymize orders instead of deleting them
        console.log('🗑️ User being removed:', this.email);
        next();
    } catch (error) {
        next(error);
    }
});

// Export model
const User = mongoose.model('User', UserSchema);

module.exports = User;
