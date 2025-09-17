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
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            'Veuillez entrer un email valide'
        ]
    },
    password: {
        type: String,
        required: [true, 'Le mot de passe est requis'],
        minlength: [6, 'Le mot de passe doit contenir au moins 6 caractères'],
        select: false // Don't return password by default
    },
    telephone: {
        type: String,
        required: [true, 'Le numéro de téléphone est requis'],
        unique: true,
        trim: true,
        match: [
            /^(\+213|0)[5-9]\d{8}$/,
            'Veuillez entrer un numéro de téléphone algérien valide'
        ]
    },
    adresse: {
        type: String,
        trim: true,
        maxlength: [200, 'L\'adresse ne peut pas dépasser 200 caractères']
    },
    ville: {
        type: String,
        trim: true,
        maxlength: [50, 'Le nom de la ville ne peut pas dépasser 50 caractères']
    },
    wilaya: {
        type: String,
        required: [true, 'La wilaya est requise'],
        enum: [
            'Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi', 'Batna', 'Béjaïa', 'Biskra',
            'Béchar', 'Blida', 'Bouira', 'Tamanrasset', 'Tébessa', 'Tlemcen', 'Tiaret',
            'Tizi Ouzou', 'Alger', 'Djelfa', 'Jijel', 'Sétif', 'Saïda', 'Skikda',
            'Sidi Bel Abbès', 'Annaba', 'Guelma', 'Constantine', 'Médéa', 'Mostaganem',
            'M\'Sila', 'Mascara', 'Ouargla', 'Oran', 'El Bayadh', 'Illizi', 'Bordj Bou Arreridj',
            'Boumerdès', 'El Tarf', 'Tindouf', 'Tissemsilt', 'El Oued', 'Khenchela',
            'Souk Ahras', 'Tipaza', 'Mila', 'Aïn Defla', 'Naâma', 'Aïn Témouchent',
            'Ghardaïa', 'Relizane', 'Timimoun', 'Bordj Badji Mokhtar', 'Ouled Djellal',
            'Béni Abbès', 'In Salah', 'In Guezzam', 'Touggourt', 'Djanet', 'El M\'Ghair',
            'El Meniaa'
        ]
    },
    codePostal: {
        type: String,
        trim: true,
        match: [/^\d{5}$/, 'Le code postal doit contenir 5 chiffres']
    },
    role: {
        type: String,
        enum: ['client', 'admin'],
        default: 'client'
    },
    dateInscription: {
        type: Date,
        default: Date.now
    },
    dernierConnexion: {
        type: Date
    },
    actif: {
        type: Boolean,
        default: true
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
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date
}, {
    timestamps: true,
    toJSON: {
        transform: function(doc, ret) {
            delete ret.password;
            delete ret.__v;
            delete ret.resetPasswordToken;
            delete ret.resetPasswordExpires;
            return ret;
        }
    }
});

// Index for better query performance
UserSchema.index({ email: 1 });
UserSchema.index({ telephone: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ actif: 1 });

// Hash password before saving
UserSchema.pre('save', async function(next) {
    // Only hash password if it has been modified (or is new)
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
        if (!this.password) {
            return false;
        }
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        console.error('Password comparison error:', error);
        return false;
    }
};

// Update last connection
UserSchema.methods.updateLastConnection = async function() {
    try {
        this.dernierConnexion = new Date();
        await this.save({ validateBeforeSave: false });
    } catch (error) {
        console.error('Error updating last connection:', error);
    }
};

// Static method to find active users
UserSchema.statics.findActive = function() {
    return this.find({ actif: true });
};

// Static method to find by role
UserSchema.statics.findByRole = function(role) {
    return this.find({ role, actif: true });
};

// Static method for secure user lookup (without password)
UserSchema.statics.findSecure = function(query) {
    return this.findOne(query).select('-password -resetPasswordToken -resetPasswordExpires');
};

// Validate email uniqueness (case insensitive)
UserSchema.pre('save', async function(next) {
    if (this.isModified('email') || this.isNew) {
        try {
            const existingUser = await this.constructor.findOne({
                email: this.email.toLowerCase(),
                _id: { $ne: this._id }
            });
            
            if (existingUser) {
                const error = new Error('Cet email est déjà utilisé');
                error.name = 'ValidationError';
                return next(error);
            }
        } catch (error) {
            return next(error);
        }
    }
    next();
});

// Validate phone uniqueness
UserSchema.pre('save', async function(next) {
    if (this.isModified('telephone') || this.isNew) {
        try {
            const existingUser = await this.constructor.findOne({
                telephone: this.telephone,
                _id: { $ne: this._id }
            });
            
            if (existingUser) {
                const error = new Error('Ce numéro de téléphone est déjà utilisé');
                error.name = 'ValidationError';
                return next(error);
            }
        } catch (error) {
            return next(error);
        }
    }
    next();
});

// Virtual for full name
UserSchema.virtual('nomComplet').get(function() {
    return `${this.prenom} ${this.nom}`;
});

// Ensure virtual fields are serialized
UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', UserSchema);
