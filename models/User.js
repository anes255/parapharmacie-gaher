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
        select: false // Ne pas inclure le mot de passe dans les requêtes par défaut
    },
    telephone: {
        type: String,
        required: [true, 'Le téléphone est requis'],
        unique: true,
        trim: true,
        match: [
            /^(\+213|0)[5-9]\d{8}$/,
            'Format de téléphone algérien invalide'
        ]
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
        default: '',
        trim: true,
        maxlength: [10, 'Le code postal ne peut pas dépasser 10 caractères']
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
            enum: ['fr', 'ar'],
            default: 'fr'
        }
    },
    adressesLivraison: [{
        nom: String,
        adresse: String,
        ville: String,
        wilaya: String,
        codePostal: String,
        telephone: String,
        parDefaut: {
            type: Boolean,
            default: false
        }
    }],
    historiqueConnexions: [{
        date: {
            type: Date,
            default: Date.now
        },
        ip: String,
        userAgent: String
    }]
}, {
    timestamps: true
});

// Index pour optimiser les requêtes
UserSchema.index({ email: 1 });
UserSchema.index({ telephone: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ actif: 1 });
UserSchema.index({ dateInscription: -1 });

// Virtual pour le nom complet
UserSchema.virtual('nomComplet').get(function() {
    return `${this.prenom} ${this.nom}`;
});

// Méthode pour hasher le mot de passe avant sauvegarde
UserSchema.pre('save', async function(next) {
    // Ne hasher que si le mot de passe a été modifié
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

// Méthode pour comparer les mots de passe
UserSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error('Erreur lors de la vérification du mot de passe');
    }
};

// Méthode pour mettre à jour la dernière connexion
UserSchema.methods.updateLastConnection = async function(ip = null, userAgent = null) {
    this.dernierConnexion = new Date();
    
    // Ajouter à l'historique des connexions
    if (ip || userAgent) {
        this.historiqueConnexions.push({
            date: new Date(),
            ip,
            userAgent
        });
        
        // Garder seulement les 10 dernières connexions
        if (this.historiqueConnexions.length > 10) {
            this.historiqueConnexions = this.historiqueConnexions.slice(-10);
        }
    }
    
    return this.save();
};

// Méthode pour ajouter une adresse de livraison
UserSchema.methods.addAdresseLivraison = function(adresse) {
    // Si c'est la première adresse ou marquée par défaut, la définir comme défaut
    if (this.adressesLivraison.length === 0 || adresse.parDefaut) {
        // Retirer le statut par défaut des autres adresses
        this.adressesLivraison.forEach(addr => {
            addr.parDefaut = false;
        });
        adresse.parDefaut = true;
    }
    
    this.adressesLivraison.push(adresse);
    return this.save();
};

// Méthode pour définir une adresse par défaut
UserSchema.methods.setAdresseDefaut = function(adresseId) {
    let found = false;
    
    this.adressesLivraison.forEach(addr => {
        if (addr._id.toString() === adresseId.toString()) {
            addr.parDefaut = true;
            found = true;
        } else {
            addr.parDefaut = false;
        }
    });
    
    if (!found) {
        throw new Error('Adresse non trouvée');
    }
    
    return this.save();
};

// Méthode pour obtenir l'adresse par défaut
UserSchema.methods.getAdresseDefaut = function() {
    return this.adressesLivraison.find(addr => addr.parDefaut) || this.adressesLivraison[0] || null;
};

// Méthode pour vérifier si l'utilisateur est admin
UserSchema.methods.isAdmin = function() {
    return this.role === 'admin';
};

// Méthode pour anonymiser les données (RGPD)
UserSchema.methods.anonymize = function() {
    this.nom = 'Utilisateur';
    this.prenom = 'Supprimé';
    this.email = `deleted_${this._id}@example.com`;
    this.telephone = '0000000000';
    this.adresse = '';
    this.ville = '';
    this.codePostal = '';
    this.actif = false;
    this.adressesLivraison = [];
    this.historiqueConnexions = [];
    
    return this.save();
};

// Méthode statique pour trouver par email ou téléphone
UserSchema.statics.findByEmailOrPhone = function(identifier) {
    return this.findOne({
        $or: [
            { email: identifier.toLowerCase() },
            { telephone: identifier }
        ],
        actif: true
    });
};

// Méthode statique pour obtenir les statistiques des utilisateurs
UserSchema.statics.getStats = async function() {
    const stats = await this.aggregate([
        {
            $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                activeUsers: {
                    $sum: { $cond: [{ $eq: ['$actif', true] }, 1, 0] }
                },
                adminUsers: {
                    $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] }
                },
                verifiedEmails: {
                    $sum: { $cond: [{ $eq: ['$emailVerifie', true] }, 1, 0] }
                }
            }
        }
    ]);
    
    const monthlyRegistrations = await this.aggregate([
        {
            $match: {
                dateInscription: {
                    $gte: new Date(new Date().setMonth(new Date().getMonth() - 12))
                }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$dateInscription' },
                    month: { $month: '$dateInscription' }
                },
                count: { $sum: 1 }
            }
        },
        {
            $sort: { '_id.year': 1, '_id.month': 1 }
        }
    ]);
    
    return {
        general: stats[0] || {
            totalUsers: 0,
            activeUsers: 0,
            adminUsers: 0,
            verifiedEmails: 0
        },
        monthlyRegistrations
    };
};

// Hook pre-remove pour nettoyer les données associées
UserSchema.pre('remove', async function(next) {
    try {
        // Supprimer les commandes associées ou les anonymiser
        const Order = mongoose.model('Order');
        await Order.updateMany(
            { 'client.userId': this._id },
            { 
                $set: { 
                    'client.nom': 'Utilisateur supprimé',
                    'client.prenom': '',
                    'client.email': 'deleted@example.com'
                } 
            }
        );
        
        next();
    } catch (error) {
        next(error);
    }
});

// Méthode pour nettoyer les données sensibles lors de la sérialisation
UserSchema.methods.toJSON = function() {
    const userObject = this.toObject();
    
    // Supprimer les champs sensibles
    delete userObject.password;
    delete userObject.historiqueConnexions;
    
    return userObject;
};

// Export du modèle
module.exports = mongoose.model('User', UserSchema);
