const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    nom: {
        type: String,
        required: [true, 'Le nom est requis'],
        trim: true,
        maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères'],
        validate: {
            validator: function(v) {
                return /^[a-zA-ZÀ-ÿ\s\-']+$/.test(v);
            },
            message: 'Le nom ne peut contenir que des lettres, espaces, tirets et apostrophes'
        }
    },
    prenom: {
        type: String,
        required: [true, 'Le prénom est requis'],
        trim: true,
        maxlength: [50, 'Le prénom ne peut pas dépasser 50 caractères'],
        validate: {
            validator: function(v) {
                return /^[a-zA-ZÀ-ÿ\s\-']+$/.test(v);
            },
            message: 'Le prénom ne peut contenir que des lettres, espaces, tirets et apostrophes'
        }
    },
    email: {
        type: String,
        required: [true, 'L\'email est requis'],
        unique: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: function(v) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: 'Format d\'email invalide'
        },
        index: true
    },
    password: {
        type: String,
        required: [true, 'Le mot de passe est requis'],
        minlength: [6, 'Le mot de passe doit contenir au moins 6 caractères'],
        select: false // Don't include password in queries by default
    },
    telephone: {
        type: String,
        required: [true, 'Le numéro de téléphone est requis'],
        unique: true,
        trim: true,
        validate: {
            validator: function(v) {
                // Algerian phone number format
                return /^(\+213|0)[5-9]\d{8}$/.test(v.replace(/\s+/g, ''));
            },
            message: 'Format de téléphone invalide (numéro algérien requis)'
        },
        set: function(v) {
            // Remove spaces and format
            return v.replace(/\s+/g, '');
        },
        index: true
    },
    adresse: {
        type: String,
        required: [true, 'L\'adresse est requise'],
        trim: true,
        maxlength: [200, 'L\'adresse ne peut pas dépasser 200 caractères']
    },
    ville: {
        type: String,
        trim: true,
        maxlength: [50, 'La ville ne peut pas dépasser 50 caractères'],
        default: ''
    },
    wilaya: {
        type: String,
        required: [true, 'La wilaya est requise'],
        enum: [
            'Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi', 'Batna', 'Béjaïa',
            'Biskra', 'Béchar', 'Blida', 'Bouira', 'Tamanrasset', 'Tébessa',
            'Tlemcen', 'Tiaret', 'Tizi Ouzou', 'Alger', 'Djelfa', 'Jijel',
            'Sétif', 'Saïda', 'Skikda', 'Sidi Bel Abbès', 'Annaba', 'Guelma',
            'Constantine', 'Médéa', 'Mostaganem', 'M\'Sila', 'Mascara', 'Ouargla',
            'Oran', 'El Bayadh', 'Illizi', 'Bordj Bou Arréridj', 'Boumerdès',
            'El Tarf', 'Tindouf', 'Tissemsilt', 'El Oued', 'Khenchela',
            'Souk Ahras', 'Tipaza', 'Mila', 'Aïn Defla', 'Naâma', 'Aïn Témouchent',
            'Ghardaïa', 'Relizane'
        ]
    },
    codePostal: {
        type: String,
        trim: true,
        validate: {
            validator: function(v) {
                return !v || /^\d{5}$/.test(v);
            },
            message: 'Le code postal doit contenir 5 chiffres'
        },
        default: ''
    },
    role: {
        type: String,
        enum: ['client', 'admin'],
        default: 'client',
        index: true
    },
    actif: {
        type: Boolean,
        default: true,
        index: true
    },
    dateInscription: {
        type: Date,
        default: Date.now,
        index: true
    },
    dernierConnexion: {
        type: Date,
        default: Date.now
    },
    preferences: {
        notifications: {
            email: {
                type: Boolean,
                default: true
            },
            sms: {
                type: Boolean,
                default: false
            },
            promotions: {
                type: Boolean,
                default: true
            },
            nouveautes: {
                type: Boolean,
                default: true
            }
        },
        livraison: {
            adresseDefaut: {
                type: String,
                default: ''
            },
            instructionsSpeciales: {
                type: String,
                default: '',
                maxlength: 500
            }
        },
        categories: [{
            type: String,
            enum: [
                'Vitalité', 'Sport', 'Visage', 'Cheveux', 'Solaire', 
                'Intime', 'Soins', 'Bébé', 'Homme', 'Dentaire'
            ]
        }]
    },
    statistiques: {
        totalCommandes: {
            type: Number,
            default: 0,
            min: 0
        },
        totalDepense: {
            type: Number,
            default: 0,
            min: 0
        },
        commandeMoyenne: {
            type: Number,
            default: 0,
            min: 0
        },
        derniereCommande: {
            type: Date,
            default: null
        }
    },
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
            required: true
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
        },
        dateAjout: {
            type: Date,
            default: Date.now
        }
    }],
    historiqueConnexions: [{
        date: {
            type: Date,
            default: Date.now
        },
        ip: {
            type: String,
            default: ''
        },
        userAgent: {
            type: String,
            default: ''
        }
    }],
    tokenResetPassword: {
        type: String,
        default: null
    },
    tokenResetPasswordExpire: {
        type: Date,
        default: null
    },
    emailVerifie: {
        type: Boolean,
        default: false
    },
    telephoneVerifie: {
        type: Boolean,
        default: false
    },
    tokenVerificationEmail: {
        type: String,
        default: null
    },
    codeVerificationTelephone: {
        type: String,
        default: null
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
UserSchema.index({ email: 1, actif: 1 });
UserSchema.index({ telephone: 1, actif: 1 });
UserSchema.index({ role: 1, actif: 1 });
UserSchema.index({ dateInscription: -1 });
UserSchema.index({ 'preferences.categories': 1 });

// Virtual for full name
UserSchema.virtual('nomComplet').get(function() {
    return `${this.prenom} ${this.nom}`;
});

// Virtual for initials
UserSchema.virtual('initiales').get(function() {
    return `${this.prenom.charAt(0)}${this.nom.charAt(0)}`.toUpperCase();
});

// Virtual to check if user is admin
UserSchema.virtual('estAdmin').get(function() {
    return this.role === 'admin';
});

// Virtual to check if user is active
UserSchema.virtual('estActif').get(function() {
    return this.actif === true;
});

// Virtual for age of account
UserSchema.virtual('ancienneteCompte').get(function() {
    const now = new Date();
    const diff = now - this.dateInscription;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days < 30) {
        return `${days} jour${days > 1 ? 's' : ''}`;
    } else if (days < 365) {
        const months = Math.floor(days / 30);
        return `${months} mois`;
    } else {
        const years = Math.floor(days / 365);
        return `${years} an${years > 1 ? 's' : ''}`;
    }
});

// Pre-save middleware to hash password
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

// Pre-save middleware to update statistics
UserSchema.pre('save', function(next) {
    if (this.adressesLivraison && this.adressesLivraison.length > 0) {
        // Ensure only one default address
        let defaultCount = this.adressesLivraison.filter(addr => addr.parDefaut).length;
        if (defaultCount > 1) {
            // Keep only the first default
            let foundFirst = false;
            this.adressesLivraison.forEach(addr => {
                if (addr.parDefaut && foundFirst) {
                    addr.parDefaut = false;
                } else if (addr.parDefaut) {
                    foundFirst = true;
                }
            });
        } else if (defaultCount === 0 && this.adressesLivraison.length > 0) {
            // Set first address as default if none is set
            this.adressesLivraison[0].parDefaut = true;
        }
    }
    
    next();
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

// Method to update last connection
UserSchema.methods.updateLastConnection = async function(ip = '', userAgent = '') {
    this.dernierConnexion = new Date();
    
    // Add to connection history (keep last 10 connections)
    this.historiqueConnexions.unshift({
        date: new Date(),
        ip: ip,
        userAgent: userAgent
    });
    
    if (this.historiqueConnexions.length > 10) {
        this.historiqueConnexions = this.historiqueConnexions.slice(0, 10);
    }
    
    return await this.save();
};

// Method to generate password reset token
UserSchema.methods.generatePasswordResetToken = function() {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    
    this.tokenResetPassword = token;
    this.tokenResetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    
    return token;
};

// Method to add delivery address
UserSchema.methods.ajouterAdresseLivraison = function(adresseData) {
    // If this is set as default, unset others
    if (adresseData.parDefaut) {
        this.adressesLivraison.forEach(addr => {
            addr.parDefaut = false;
        });
    }
    
    // If this is the first address, make it default
    if (this.adressesLivraison.length === 0) {
        adresseData.parDefaut = true;
    }
    
    this.adressesLivraison.push(adresseData);
    return this;
};

// Method to update user statistics
UserSchema.methods.updateStatistics = function(commandeData) {
    this.statistiques.totalCommandes += 1;
    this.statistiques.totalDepense += commandeData.total || 0;
    this.statistiques.commandeMoyenne = this.statistiques.totalCommandes > 0 
        ? this.statistiques.totalDepense / this.statistiques.totalCommandes 
        : 0;
    this.statistiques.derniereCommande = new Date();
    
    return this;
};

// Static method to find users by wilaya
UserSchema.statics.findByWilaya = function(wilaya) {
    return this.find({ wilaya: wilaya, actif: true });
};

// Static method to find recent users
UserSchema.statics.findRecentUsers = function(days = 30) {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);
    
    return this.find({
        dateInscription: { $gte: dateLimit },
        actif: true
    }).sort({ dateInscription: -1 });
};

// Static method to get user statistics
UserSchema.statics.getUserStatistics = function() {
    return this.aggregate([
        {
            $match: { actif: true }
        },
        {
            $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                totalAdmins: { 
                    $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } 
                },
                totalClients: { 
                    $sum: { $cond: [{ $eq: ['$role', 'client'] }, 1, 0] } 
                },
                avgCommandesPerUser: { $avg: '$statistiques.totalCommandes' },
                totalRevenue: { $sum: '$statistiques.totalDepense' }
            }
        }
    ]);
};

module.exports = mongoose.model('User', UserSchema);
