const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    prenom: {
        type: String,
        required: [true, 'Le prénom est requis'],
        trim: true,
        minlength: [2, 'Le prénom doit contenir au moins 2 caractères'],
        maxlength: [50, 'Le prénom ne peut pas dépasser 50 caractères']
    },
    nom: {
        type: String,
        required: [true, 'Le nom est requis'],
        trim: true,
        minlength: [2, 'Le nom doit contenir au moins 2 caractères'],
        maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères']
    },
    email: {
        type: String,
        required: [true, 'L\'email est requis'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [
            /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
            'Veuillez entrer un email valide'
        ]
    },
    telephone: {
        type: String,
        required: [true, 'Le téléphone est requis'],
        match: [
            /^(\+213|0)[5-9]\d{8}$/,
            'Veuillez entrer un numéro de téléphone algérien valide'
        ]
    },
    password: {
        type: String,
        required: [true, 'Le mot de passe est requis'],
        minlength: [6, 'Le mot de passe doit contenir au moins 6 caractères']
    },
    adresse: {
        type: String,
        required: [true, 'L\'adresse est requise'],
        trim: true,
        minlength: [10, 'L\'adresse doit contenir au moins 10 caractères'],
        maxlength: [200, 'L\'adresse ne peut pas dépasser 200 caractères']
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
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    dateInscription: {
        type: Date,
        default: Date.now
    },
    actif: {
        type: Boolean,
        default: true
    },
    derniereConnexion: {
        type: Date
    },
    preferences: {
        newsletter: {
            type: Boolean,
            default: false
        },
        notifications: {
            type: Boolean,
            default: true
        }
    }
}, {
    timestamps: true
});

// Index pour optimiser les recherches
UserSchema.index({ email: 1 });
UserSchema.index({ telephone: 1 });
UserSchema.index({ role: 1 });

// Méthode pour obtenir le nom complet
UserSchema.virtual('nomComplet').get(function() {
    return `${this.prenom} ${this.nom}`;
});

// Méthode pour obtenir les initiales
UserSchema.virtual('initiales').get(function() {
    return `${this.prenom[0]}${this.nom[0]}`.toUpperCase();
});

// Masquer le mot de passe lors de la sérialisation JSON
UserSchema.methods.toJSON = function() {
    const user = this.toObject();
    delete user.password;
    return user;
};

// Méthode pour mettre à jour la dernière connexion
UserSchema.methods.updateLastLogin = function() {
    this.derniereConnexion = new Date();
    return this.save();
};

// Méthode pour vérifier si l'utilisateur est admin
UserSchema.methods.isAdmin = function() {
    return this.role === 'admin';
};

// Middleware pour nettoyer les données avant sauvegarde
UserSchema.pre('save', function(next) {
    // Nettoyer le numéro de téléphone
    if (this.telephone) {
        this.telephone = this.telephone.replace(/\s+/g, '');
    }
    
    // Capitaliser le prénom et le nom
    if (this.prenom) {
        this.prenom = this.prenom.charAt(0).toUpperCase() + this.prenom.slice(1).toLowerCase();
    }
    
    if (this.nom) {
        this.nom = this.nom.toUpperCase();
    }
    
    next();
});

// Middleware pour gérer les erreurs de validation
UserSchema.post('save', function(error, doc, next) {
    if (error.name === 'MongoServerError' && error.code === 11000) {
        if (error.keyPattern.email) {
            next(new Error('Cette adresse email est déjà utilisée'));
        } else if (error.keyPattern.telephone) {
            next(new Error('Ce numéro de téléphone est déjà utilisé'));
        } else {
            next(error);
        }
    } else {
        next(error);
    }
});

module.exports = mongoose.model('User', UserSchema);
