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
        trim: true,
        match: [/^(\+213|0)[5-7][0-9]{8}$/, 'Format de téléphone invalide']
    },
    password: {
        type: String,
        required: [true, 'Le mot de passe est requis'],
        minlength: [6, 'Le mot de passe doit contenir au moins 6 caractères'],
        select: false // Ne pas inclure le mot de passe dans les requêtes par défaut
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
        trim: true,
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
        match: [/^[0-9]{5}$/, 'Le code postal doit contenir 5 chiffres']
    },
    dateNaissance: {
        type: Date,
        validate: {
            validator: function(date) {
                return date <= new Date();
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
    historiqueConnexions: [{
        date: {
            type: Date,
            default: Date.now
        },
        ip: String,
        userAgent: String,
        success: {
            type: Boolean,
            default: true
        }
    }],
    adressesLivraison: [{
        nom: {
            type: String,
            required: true,
            trim: true
        },
        adresse: {
            type: String,
            required: true,
            trim: true
        },
        ville: {
            type: String,
            trim: true
        },
        wilaya: {
            type: String,
            required: true,
            trim: true
        },
        codePostal: {
            type: String,
            trim: true
        },
        telephone: {
            type: String,
            trim: true
        },
        parDefaut: {
            type: Boolean,
            default: false
        }
    }],
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
        },
        produitsFavoris: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product'
        }]
    }
}, {
    timestamps: true
});

// Index pour optimiser les recherches
UserSchema.index({ email: 1 });
UserSchema.index({ telephone: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ actif: 1 });
UserSchema.index({ emailVerifie: 1 });

// Virtual pour le nom complet
UserSchema.virtual('nomComplet').get(function() {
    return `${this.prenom} ${this.nom}`;
});

// Virtual pour vérifier si l'utilisateur est vérifié
UserSchema.virtual('estVerifie').get(function() {
    return this.emailVerifie && this.telephoneVerifie;
});

// Pre-save middleware pour hasher le mot de passe
UserSchema.pre('save', async function(next) {
    // Seulement hasher le mot de passe s'il a été modifié
    if (!this.isModified('password')) return next();
    
    try {
        // Hasher le mot de passe avec un salt de 12
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Pre-save middleware pour s'assurer qu'une seule adresse est par défaut
UserSchema.pre('save', function(next) {
    if (this.adressesLivraison && this.adressesLivraison.length > 0) {
        const adressesParDefaut = this.adressesLivraison.filter(addr => addr.parDefaut);
        
        if (adressesParDefaut.length > 1) {
            // Si plusieurs adresses sont marquées par défaut, garder seulement la première
            this.adressesLivraison.forEach((addr, index) => {
                if (index > 0 && addr.parDefaut) {
                    addr.parDefaut = false;
                }
            });
        } else if (adressesParDefaut.length === 0 && this.adressesLivraison.length === 1) {
            // Si aucune adresse n'est par défaut et qu'il n'y en a qu'une, la marquer par défaut
            this.adressesLivraison[0].parDefaut = true;
        }
    }
    next();
});

// Méthode pour comparer les mots de passe
UserSchema.methods.comparerMotDePasse = async function(motDePasseCandidat) {
    try {
        return await bcrypt.compare(motDePasseCandidat, this.password);
    } catch (error) {
        throw new Error('Erreur lors de la comparaison du mot de passe');
    }
};

// Méthode pour générer un token de reset
UserSchema.methods.genererTokenReset = function() {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    
    this.tokenReset = {
        token: token,
        expiration: new Date(Date.now() + 3600000) // 1 heure
    };
    
    return token;
};

// Méthode pour générer un token de vérification
UserSchema.methods.genererTokenVerification = function() {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    
    this.tokenVerification = {
        token: token,
        expiration: new Date(Date.now() + 86400000) // 24 heures
    };
    
    return token;
};

// Méthode pour ajouter une connexion à l'historique
UserSchema.methods.ajouterConnexion = function(ip, userAgent, success = true) {
    this.historiqueConnexions.unshift({
        date: new Date(),
        ip: ip,
        userAgent: userAgent,
        success: success
    });
    
    // Garder seulement les 10 dernières connexions
    if (this.historiqueConnexions.length > 10) {
        this.historiqueConnexions = this.historiqueConnexions.slice(0, 10);
    }
    
    if (success) {
        this.dernierConnexion = new Date();
    }
    
    return this.save();
};

// Méthode pour mettre à jour les statistiques
UserSchema.methods.mettreAJourStatistiques = function(montantCommande) {
    this.statistiques.nombreCommandes += 1;
    this.statistiques.totalDepense += montantCommande;
    this.statistiques.dernierAchat = new Date();
    
    return this.save();
};

// Méthode pour ajouter une adresse de livraison
UserSchema.methods.ajouterAdresseLivraison = function(adresse, parDefaut = false) {
    // Si cette adresse doit être par défaut, désactiver les autres
    if (parDefaut) {
        this.adressesLivraison.forEach(addr => {
            addr.parDefaut = false;
        });
    }
    
    this.adressesLivraison.push({
        ...adresse,
        parDefaut: parDefaut || this.adressesLivraison.length === 0
    });
    
    return this.save();
};

// Méthodes statiques
UserSchema.statics.trouverParEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

UserSchema.statics.trouverParTelephone = function(telephone) {
    return this.findOne({ telephone: telephone });
};

UserSchema.statics.obtenirStatistiquesUtilisateurs = function() {
    return this.aggregate([
        {
            $group: {
                _id: '$role',
                count: { $sum: 1 },
                actifs: {
                    $sum: {
                        $cond: ['$actif', 1, 0]
                    }
                },
                totalDepenses: { $sum: '$statistiques.totalDepense' }
            }
        }
    ]);
};

// Assurer que les virtuals sont inclus lors de la sérialisation
UserSchema.set('toJSON', { 
    virtuals: true,
    transform: function(doc, ret, options) {
        // Supprimer le mot de passe des réponses JSON
        delete ret.password;
        delete ret.tokenReset;
        delete ret.tokenVerification;
        return ret;
    }
});

UserSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', UserSchema);
