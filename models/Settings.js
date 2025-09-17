const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
    siteName: {
        type: String,
        required: [true, 'Le nom du site est requis'],
        trim: true,
        maxlength: [100, 'Le nom du site ne peut pas dépasser 100 caractères']
    },
    siteDescription: {
        type: String,
        trim: true,
        maxlength: [500, 'La description ne peut pas dépasser 500 caractères']
    },
    contactEmail: {
        type: String,
        required: [true, 'L\'email de contact est requis'],
        lowercase: true,
        trim: true,
        match: [
            /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
            'Veuillez entrer un email valide'
        ]
    },
    contactPhone: {
        type: String,
        required: [true, 'Le téléphone de contact est requis'],
        trim: true
    },
    address: {
        type: String,
        required: [true, 'L\'adresse est requise'],
        trim: true,
        maxlength: [200, 'L\'adresse ne peut pas dépasser 200 caractères']
    },
    currency: {
        type: String,
        default: 'DA',
        enum: ['DA', 'EUR', 'USD'],
        uppercase: true
    },
    language: {
        type: String,
        default: 'fr',
        enum: ['fr', 'ar', 'en'],
        lowercase: true
    },
    timezone: {
        type: String,
        default: 'Africa/Algiers'
    },
    freeShippingThreshold: {
        type: Number,
        default: 5000,
        min: [0, 'Le seuil de livraison gratuite ne peut pas être négatif']
    },
    defaultShippingCost: {
        type: Number,
        default: 300,
        min: [0, 'Le coût de livraison ne peut pas être négatif']
    },
    taxRate: {
        type: Number,
        default: 0,
        min: [0, 'Le taux de taxe ne peut pas être négatif'],
        max: [100, 'Le taux de taxe ne peut pas dépasser 100%']
    },
    enableRegistration: {
        type: Boolean,
        default: true
    },
    enableReviews: {
        type: Boolean,
        default: true
    },
    enableNewsletter: {
        type: Boolean,
        default: true
    },
    enableSocialLogin: {
        type: Boolean,
        default: false
    },
    maintenanceMode: {
        type: Boolean,
        default: false
    },
    theme: {
        primaryColor: {
            type: String,
            default: '#10b981',
            match: [/^#[0-9A-F]{6}$/i, 'Veuillez entrer une couleur hexadécimale valide']
        },
        secondaryColor: {
            type: String,
            default: '#059669',
            match: [/^#[0-9A-F]{6}$/i, 'Veuillez entrer une couleur hexadécimale valide']
        },
        accentColor: {
            type: String,
            default: '#34d399',
            match: [/^#[0-9A-F]{6}$/i, 'Veuillez entrer une couleur hexadécimale valide']
        }
    },
    seo: {
        metaTitle: {
            type: String,
            trim: true,
            maxlength: [60, 'Le titre meta ne peut pas dépasser 60 caractères']
        },
        metaDescription: {
            type: String,
            trim: true,
            maxlength: [160, 'La description meta ne peut pas dépasser 160 caractères']
        },
        metaKeywords: {
            type: String,
            trim: true,
            maxlength: [255, 'Les mots-clés meta ne peuvent pas dépasser 255 caractères']
        }
    },
    social: {
        facebook: {
            type: String,
            trim: true,
            match: [/^https?:\/\/(www\.)?facebook\.com\/.*/, 'URL Facebook invalide']
        },
        instagram: {
            type: String,
            trim: true,
            match: [/^https?:\/\/(www\.)?instagram\.com\/.*/, 'URL Instagram invalide']
        },
        twitter: {
            type: String,
            trim: true,
            match: [/^https?:\/\/(www\.)?twitter\.com\/.*/, 'URL Twitter invalide']
        },
        linkedin: {
            type: String,
            trim: true,
            match: [/^https?:\/\/(www\.)?linkedin\.com\/.*/, 'URL LinkedIn invalide']
        }
    },
    smtp: {
        host: {
            type: String,
            trim: true
        },
        port: {
            type: Number,
            min: [1, 'Le port doit être supérieur à 0'],
            max: [65535, 'Le port ne peut pas dépasser 65535']
        },
        secure: {
            type: Boolean,
            default: false
        },
        username: {
            type: String,
            trim: true
        },
        password: {
            type: String,
            select: false // Ne pas inclure le mot de passe dans les requêtes par défaut
        }
    },
    analytics: {
        googleAnalyticsId: {
            type: String,
            trim: true,
            match: [/^(UA-|G-)?[0-9A-Z-]+$/, 'ID Google Analytics invalide']
        },
        facebookPixelId: {
            type: String,
            trim: true,
            match: [/^[0-9]+$/, 'ID Facebook Pixel invalide']
        }
    },
    backup: {
        enabled: {
            type: Boolean,
            default: false
        },
        frequency: {
            type: String,
            enum: ['daily', 'weekly', 'monthly'],
            default: 'weekly'
        },
        retention: {
            type: Number,
            default: 30,
            min: [1, 'La rétention doit être d\'au moins 1 jour']
        }
    }
}, {
    timestamps: true
});

// Index pour optimiser les recherches
SettingsSchema.index({ siteName: 1 });

// Méthode pour obtenir les paramètres publics (sans informations sensibles)
SettingsSchema.methods.getPublicSettings = function() {
    const settings = this.toObject();
    
    // Supprimer les informations sensibles
    delete settings.smtp;
    delete settings._id;
    delete settings.__v;
    delete settings.createdAt;
    delete settings.updatedAt;
    
    return settings;
};

// Méthode pour valider les couleurs hexadécimales
SettingsSchema.methods.validateHexColor = function(color) {
    return /^#[0-9A-F]{6}$/i.test(color);
};

// Méthode statique pour obtenir les paramètres ou créer des paramètres par défaut
SettingsSchema.statics.getSettings = async function() {
    let settings = await this.findOne({});
    
    if (!settings) {
        // Créer des paramètres par défaut
        const defaultSettings = {
            siteName: 'Shifa - Parapharmacie',
            siteDescription: 'Votre parapharmacie de confiance à Tipaza',
            contactEmail: 'pharmaciegaher@gmail.com',
            contactPhone: '+213 123 456 789',
            address: 'Tipaza, Algérie'
        };
        
        settings = new this(defaultSettings);
        await settings.save();
    }
    
    return settings;
};

// Middleware pour nettoyer les données avant sauvegarde
SettingsSchema.pre('save', function(next) {
    // Nettoyer les URLs sociales
    if (this.social) {
        Object.keys(this.social).forEach(key => {
            if (this.social[key] && !this.social[key].startsWith('http')) {
                this.social[key] = 'https://' + this.social[key];
            }
        });
    }
    
    // Nettoyer les couleurs (s'assurer qu'elles commencent par #)
    if (this.theme) {
        Object.keys(this.theme).forEach(key => {
            if (this.theme[key] && !this.theme[key].startsWith('#')) {
                this.theme[key] = '#' + this.theme[key];
            }
        });
    }
    
    next();
});

module.exports = mongoose.model('Settings', SettingsSchema);
