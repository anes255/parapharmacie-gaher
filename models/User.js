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
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Format d\'email invalide']
    },
    password: {
        type: String,
        required: [true, 'Le mot de passe est requis'],
        minlength: [6, 'Le mot de passe doit contenir au moins 6 caractères'],
        select: false // Don't include password in queries by default
    },
    telephone: {
        type: String,
        required: [true, 'Le téléphone est requis'],
        unique: true,
        match: [/^(\+213|0)[5-9]\d{8}$/, 'Format de téléphone algérien invalide']
    },
    adresse: {
        type: String,
        trim: true,
        default: ''
    },
    ville: {
        type: String,
        trim: true,
        default: ''
    },
    wilaya: {
        type: String,
        required: [true, 'La wilaya est requise'],
        enum: [
            'Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi', 'Batna', 'Béjaïa', 'Biskra', 'Béchar',
            'Blida', 'Bouira', 'Tamanrasset', 'Tébessa', 'Tlemcen', 'Tiaret', 'Tizi Ouzou', 'Alger',
            'Djelfa', 'Jijel', 'Sétif', 'Saïda', 'Skikda', 'Sidi Bel Abbès', 'Annaba', 'Guelma',
            'Constantine', 'Médéa', 'Mostaganem', 'M\'Sila', 'Mascara', 'Ouargla', 'Oran', 'El Bayadh',
            'Illizi', 'Bordj Bou Arréridj', 'Boumerdès', 'El Tarf', 'Tindouf', 'Tissemsilt', 'El Oued',
            'Khenchela', 'Souk Ahras', 'Tipaza', 'Mila', 'Aïn Defla', 'Naâma', 'Aïn Témouchent',
            'Ghardaïa', 'Relizane'
        ]
    },
    codePostal: {
        type: String,
        trim: true,
        default: '',
        match: [/^\d{5}$|^$/, 'Code postal invalide (5 chiffres requis)']
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
        language: {
            type: String,
            enum: ['fr', 'ar'],
            default: 'fr'
        }
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    emailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: String
}, {
    timestamps: true,
    toJSON: {
        transform: function(doc, ret) {
            delete ret.password;
            delete ret.resetPasswordToken;
            delete ret.resetPasswordExpires;
            delete ret.emailVerificationToken;
            return ret;
        }
    }
});

// Index for performance
UserSchema.index({ email: 1 });
UserSchema.index({ telephone: 1 });
UserSchema.index({ role: 1, actif: 1 });

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
UserSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error('Erreur lors de la vérification du mot de passe');
    }
};

// Instance method to update last connection
UserSchema.methods.updateLastConnection = async function() {
    try {
        this.dernierConnexion = new Date();
        await this.save({ validateBeforeSave: false });
    } catch (error) {
        console.log('Error updating last connection:', error);
    }
};

// Static method to find by email with password
UserSchema.statics.findByEmailWithPassword = function(email) {
    return this.findOne({ email: email.toLowerCase(), actif: true }).select('+password');
};

// Static method to check if email exists
UserSchema.statics.emailExists = function(email, excludeId = null) {
    const query = { email: email.toLowerCase() };
    if (excludeId) {
        query._id = { $ne: excludeId };
    }
    return this.findOne(query);
};

// Static method to check if phone exists
UserSchema.statics.phoneExists = function(telephone, excludeId = null) {
    const query = { telephone };
    if (excludeId) {
        query._id = { $ne: excludeId };
    }
    return this.findOne(query);
};

// Virtual for full name
UserSchema.virtual('nomComplet').get(function() {
    return `${this.prenom} ${this.nom}`;
});

// Ensure virtual fields are serialized
UserSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('User', UserSchema);
