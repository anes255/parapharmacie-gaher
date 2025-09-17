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
        select: false // Ne pas inclure le mot de passe par défaut dans les requêtes
    },
    telephone: {
        type: String,
        required: [true, 'Le numéro de téléphone est requis'],
        unique: true,
        trim: true,
        match: [/^(\+213|0)[5-9]\d{8}$/, 'Format de téléphone algérien invalide']
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
        maxlength: [50, 'Le nom de ville ne peut pas dépasser 50 caractères']
    },
    wilaya: {
        type: String,
        required: [true, 'La wilaya est requise'],
        enum: [
            'Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi', 'Batna', 'Béjaïa', 'Biskra', 'Béchar',
            'Blida', 'Bouira', 'Tamanrasset', 'Tébessa', 'Tlemcen', 'Tiaret', 'Tizi Ouzou',
            'Alger', 'Djelfa', 'Jijel', 'Sétif', 'Saïda', 'Skikda', 'Sidi Bel Abbès', 'Annaba',
            'Guelma', 'Constantine', 'Médéa', 'Mostaganem', 'M\'Sila', 'Mascara', 'Ouargla',
            'Oran', 'El Bayadh', 'Illizi', 'Bordj Bou Arréridj', 'Boumerdès', 'El Tarf',
            'Tindouf', 'Tissemsilt', 'El Oued', 'Khenchela', 'Souk Ahras', 'Tipaza',
            'Mila', 'Aïn Defla', 'Naâma', 'Aïn Témouchent', 'Ghardaïa', 'Relizane'
        ]
    },
    codePostal: {
        type: String,
        default: '',
        trim: true,
        match: [/^\d{5}$/, 'Code postal doit contenir 5 chiffres']
    },
    dateNaissance: {
        type: Date,
        default: null
    },
    genre: {
        type: String,
        enum: ['homme', 'femme', 'autre'],
        default: null
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
        default: null
    },
    tentativesConnexion: {
        type: Number,
        default: 0
    },
    compteBloque: {
        type: Boolean,
        default: false
    },
    dateBlocage: {
        type: Date,
        default: null
    },
    preferences: {
        newsletter: {
            type: Boolean,
            default: true
        },
        notifications: {
            type: Boolean,
            default: true
        },
        langue: {
            type: String,
            enum: ['fr', 'ar', 'en'],
            default: 'fr'
        }
    },
    resetPasswordToken: {
        type: String,
        default: null
    },
    resetPasswordExpires: {
        type: Date,
        default: null
    },
    emailVerificationToken: {
        type: String,
        default: null
    },
    emailVerificationExpires: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Index pour les recherches fréquentes
UserSchema.index({ email: 1 });
UserSchema.index({ telephone: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ actif: 1 });
UserSchema.index({ wilaya: 1 });

// Virtual pour le nom complet
UserSchema.virtual('nomComplet').get(function() {
    return `${this.prenom} ${this.nom}`;
});

// Virtual pour vérifier si l'utilisateur est majeur
UserSchema.virtual('estMajeur').get(function() {
    if (!this.dateNaissance) return null;
    const age = Math.floor((Date.now() - this.dateNaissance.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return age >= 18;
});

// Pre-save hook pour hasher le mot de passe
UserSchema.pre('save', async function(next) {
    // Ne hasher que si le mot de passe a été modifié ou est nouveau
    if (!this.isModified('password')) {
        return next();
    }
    
    try {
        // Générer le salt et hasher le mot de passe
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Pre-save hook pour normaliser les données
UserSchema.pre('save', function(next) {
    // Normaliser l'email
    if (this.email) {
        this.email = this.email.toLowerCase().trim();
    }
    
    // Normaliser le téléphone
    if (this.telephone) {
        this.telephone = this.telephone.replace(/\s+/g, '');
    }
    
    // Nettoyer les espaces
    if (this.nom) this.nom = this.nom.trim();
    if (this.prenom) this.prenom = this.prenom.trim();
    if (this.adresse) this.adresse = this.adresse.trim();
    if (this.ville) this.ville = this.ville.trim();
    
    next();
});

// Méthode pour comparer les mots de passe
UserSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error('Erreur lors de la vérification du mot de passe');
    }
};

// Méthode pour mettre à jour la dernière connexion
UserSchema.methods.updateLastConnection = async function() {
    this.dernierConnexion = new Date();
    this.tentativesConnexion = 0; // Reset failed attempts
    return this.save({ validateBeforeSave: false });
};

// Méthode pour incrémenter les tentatives de connexion
UserSchema.methods.incrementLoginAttempts = async function() {
    this.tentativesConnexion += 1;
    
    // Bloquer le compte après 5 tentatives échouées
    if (this.tentativesConnexion >= 5) {
        this.compteBloque = true;
        this.dateBlocage = new Date();
    }
    
    return this.save({ validateBeforeSave: false });
};

// Méthode pour débloquer le compte
UserSchema.methods.unblockAccount = async function() {
    this.compteBloque = false;
    this.dateBlocage = null;
    this.tentativesConnexion = 0;
    return this.save({ validateBeforeSave: false });
};

// Méthode pour générer un token de réinitialisation
UserSchema.methods.generateResetToken = function() {
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    this.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    
    return resetToken;
};

// Méthode pour générer un token de vérification email
UserSchema.methods.generateEmailVerificationToken = function() {
    const crypto = require('crypto');
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    this.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 heures
    
    return verificationToken;
};

// Méthode pour obtenir les statistiques utilisateur
UserSchema.statics.getStatistics = async function() {
    try {
        const stats = await this.aggregate([
            {
                $group: {
                    _id: null,
                    totalUsers: { $sum: 1 },
                    activeUsers: {
                        $sum: {
                            $cond: [{ $eq: ['$actif', true] }, 1, 0]
                        }
                    },
                    verifiedEmails: {
                        $sum: {
                            $cond: [{ $eq: ['$emailVerifie', true] }, 1, 0]
                        }
                    },
                    adminUsers: {
                        $sum: {
                            $cond: [{ $eq: ['$role', 'admin'] }, 1, 0]
                        }
                    }
                }
            }
        ]);
        
        return stats[0] || {
            totalUsers: 0,
            activeUsers: 0,
            verifiedEmails: 0,
            adminUsers: 0
        };
    } catch (error) {
        throw new Error('Erreur lors de la récupération des statistiques');
    }
};

// Méthode pour obtenir les utilisateurs par wilaya
UserSchema.statics.getUsersByWilaya = async function() {
    try {
        return await this.aggregate([
            {
                $match: { actif: true }
            },
            {
                $group: {
                    _id: '$wilaya',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);
    } catch (error) {
        throw new Error('Erreur lors de la récupération des statistiques par wilaya');
    }
};

// Assurer que les virtuals sont inclus lors de la sérialisation
UserSchema.set('toJSON', { 
    virtuals: true,
    transform: function(doc, ret) {
        delete ret.password;
        delete ret.resetPasswordToken;
        delete ret.emailVerificationToken;
        return ret;
    }
});

UserSchema.set('toObject', { 
    virtuals: true,
    transform: function(doc, ret) {
        delete ret.password;
        delete ret.resetPasswordToken;
        delete ret.emailVerificationToken;
        return ret;
    }
});

module.exports = mongoose.model('User', UserSchema);
