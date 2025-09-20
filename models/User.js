const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    prenom: {
        type: String,
        required: true,
        trim: true
    },
    nom: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    telephone: {
        type: String,
        required: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
        select: false
    },
    adresse: {
        type: String,
        required: true,
        trim: true
    },
    ville: {
        type: String,
        default: '',
        trim: true
    },
    wilaya: {
        type: String,
        required: true,
        trim: true
    },
    codePostal: {
        type: String,
        default: '',
        trim: true
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
    dateInscription: {
        type: Date,
        default: Date.now
    },
    dernierConnexion: {
        type: Date,
        default: Date.now
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
        langue: {
            type: String,
            enum: ['fr', 'ar', 'en'],
            default: 'fr'
        }
    }
}, {
    timestamps: true
});

// Index pour les recherches
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });

// Pre-save middleware pour hasher le mot de passe
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

// Méthode pour comparer les mots de passe (nom utilisé par auth.js)
UserSchema.methods.comparePassword = async function(motDePasseCandidat) {
    return await bcrypt.compare(motDePasseCandidat, this.password);
};

// Méthode pour mettre à jour la dernière connexion (utilisée par auth.js)
UserSchema.methods.updateLastConnection = async function() {
    this.dernierConnexion = new Date();
    return await this.save();
};

// Alternative method name for compatibility
UserSchema.methods.comparerMotDePasse = async function(motDePasseCandidat) {
    return await bcrypt.compare(motDePasseCandidat, this.password);
};

// JSON transformation to remove sensitive data
UserSchema.set('toJSON', {
    transform: function(doc, ret) {
        delete ret.password;
        return ret;
    }
});

module.exports = mongoose.model('User', UserSchema);
