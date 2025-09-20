const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    prenom: {
        type: String,
        required: [true, 'Le prénom est requis'],
        trim: true,
        maxlength: [50, 'Le prénom ne peut pas dépasser 50 caractères']
    },
    nom: {
        type: String,
        required: [true, 'Le nom est requis'],
        trim: true,
        maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères']
    },
    email: {
        type: String,
        required: [true, 'L\'email est requis'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Format d\'email invalide']
    },
    telephone: {
        type: String,
        required: [true, 'Le téléphone est requis'],
        trim: true
    },
    password: {
        type: String,
        required: [true, 'Le mot de passe est requis'],
        minlength: [6, 'Le mot de passe doit contenir au moins 6 caractères'],
        select: false
    },
    adresse: {
        type: String,
        required: [true, 'L\'adresse est requise'],
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
        trim: true
    },
    dateNaissance: {
        type: Date,
        validate: {
            validator: function(date) {
                return !date || date <= new Date();
            },
            message: 'La date de naissance ne peut pas être dans le futur'
        }
    },
    genre: {
        type: String,
        enum: ['homme', 'femme', 'autre'],
        default: null
    },
    role: {
        type: String,
        enum: ['client', 'admin', 'moderateur'],
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
    },
    avatar: {
        type: String,
        default: ''
    },
    tokenReset: {
        token: String,
        expiration: Date
    },
    tokenVerification: {
        token: String,
        expiration: Date
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
        dernierAchat: {
            type: Date,
            default: null
        }
    }
}, {
    timestamps: true
});

// Index pour optimiser les recherches
UserSchema.index({ email: 1 });
UserSchema.index({ telephone: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ actif: 1 });

// Virtual pour le nom complet
UserSchema.virtual('nomComplet').get(function() {
    return `${this.prenom} ${this.nom}`;
});

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

// Méthode pour comparer les mots de passe
UserSchema.methods.comparerMotDePasse = async function(motDePasseCandidat) {
    try {
        return await bcrypt.compare(motDePasseCandidat, this.password);
    } catch (error) {
        throw new Error('Erreur lors de la comparaison du mot de passe');
    }
};

// Méthode pour mettre à jour les statistiques
UserSchema.methods.mettreAJourStatistiques = function(montantCommande) {
    this.statistiques.nombreCommandes += 1;
    this.statistiques.totalDepense += montantCommande;
    this.statistiques.dernierAchat = new Date();
    
    return this.save();
};

// Méthodes statiques
UserSchema.statics.trouverParEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

UserSchema.statics.trouverParTelephone = function(telephone) {
    return this.findOne({ telephone: telephone });
};

// Assurer que les virtuals sont inclus lors de la sérialisation
UserSchema.set('toJSON', { 
    virtuals: true,
    transform: function(doc, ret, options) {
        delete ret.password;
        delete ret.tokenReset;
        delete ret.tokenVerification;
        return ret;
    }
});

UserSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', UserSchema);
