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
            'Format d\'email invalide'
        ]
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
        trim: true
    },
    adresse: {
        type: String,
        trim: true,
        maxlength: [200, 'L\'adresse ne peut pas dépasser 200 caractères']
    },
    ville: {
        type: String,
        trim: true,
        maxlength: [50, 'La ville ne peut pas dépasser 50 caractères']
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
            'Ghardaïa', 'Relizane', 'Timimoun', 'Bordj Badji Mokhtar', 'Ouled Djellal', 'Béni Abbès',
            'In Salah', 'In Guezzam', 'Touggourt', 'Djanet', 'El M\'Ghair', 'El Meniaa'
        ]
    },
    codePostal: {
        type: String,
        trim: true
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
            enum: ['fr', 'ar'],
            default: 'fr'
        }
    },
    tentativesConnexion: {
        count: {
            type: Number,
            default: 0
        },
        lastAttempt: Date,
        blocked: {
            type: Boolean,
            default: false
        },
        blockedUntil: Date
    }
}, {
    timestamps: true
});

// Index for search and performance
UserSchema.index({ email: 1 });
UserSchema.index({ telephone: 1 });

// Hash password before saving
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

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

// Update last connection
UserSchema.methods.updateLastConnection = async function() {
    this.dernierConnexion = new Date();
    this.tentativesConnexion.count = 0;
    this.tentativesConnexion.blocked = false;
    this.tentativesConnexion.blockedUntil = undefined;
    return this.save();
};

// Handle failed login attempts
UserSchema.methods.handleFailedLogin = async function() {
    this.tentativesConnexion.count += 1;
    this.tentativesConnexion.lastAttempt = new Date();
    
    // Block account after 5 failed attempts
    if (this.tentativesConnexion.count >= 5) {
        this.tentativesConnexion.blocked = true;
        this.tentativesConnexion.blockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    }
    
    return this.save();
};

// Check if account is blocked
UserSchema.methods.isBlocked = function() {
    if (this.tentativesConnexion.blocked) {
        if (this.tentativesConnexion.blockedUntil && new Date() > this.tentativesConnexion.blockedUntil) {
            // Unblock account
            this.tentativesConnexion.blocked = false;
            this.tentativesConnexion.count = 0;
            this.tentativesConnexion.blockedUntil = undefined;
            this.save();
            return false;
        }
        return true;
    }
    return false;
};

// Get full name
UserSchema.virtual('nomComplet').get(function() {
    return `${this.prenom} ${this.nom}`;
});

// Transform output to hide sensitive data
UserSchema.methods.toJSON = function() {
    const user = this.toObject();
    delete user.password;
    delete user.tentativesConnexion;
    return user;
};

// Static methods
UserSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

UserSchema.statics.findActive = function() {
    return this.find({ actif: true });
};

UserSchema.statics.findAdmins = function() {
    return this.find({ role: 'admin', actif: true });
};

module.exports = mongoose.model('User', UserSchema);
