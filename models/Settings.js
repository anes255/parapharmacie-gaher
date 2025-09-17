const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
    // Site settings
    siteName: {
        type: String,
        default: 'Shifa Parapharmacie'
    },
    siteDescription: {
        type: String,
        default: 'Votre parapharmacie en ligne de confiance'
    },
    siteUrl: {
        type: String,
        default: 'https://parapharmacieshifa.com'
    },
    siteLogo: {
        type: String,
        default: ''
    },
    
    // Contact information
    contact: {
        email: {
            type: String,
            default: 'pharmaciegaher@gmail.com'
        },
        telephone: {
            type: String,
            default: '+213123456789'
        },
        adresse: {
            type: String,
            default: 'Tipaza, Algérie'
        },
        horaires: {
            type: String,
            default: 'Lun-Sam: 9h-18h, Dim: 9h-13h'
        }
    },
    
    // Shipping settings
    shipping: {
        fraisLivraisonDefaut: {
            type: Number,
            default: 500,
            min: 0
        },
        livraisonGratuiteSeuil: {
            type: Number,
            default: 5000,
            min: 0
        },
        delaiLivraisonMin: {
            type: Number,
            default: 2,
            min: 1
        },
        delaiLivraisonMax: {
            type: Number,
            default: 7,
            min: 1
        },
        wilayasDisponibles: [{
            nom: String,
            fraisLivraison: {
                type: Number,
                default: 500
            },
            delaiLivraison: {
                type: String,
                default: '2-7 jours'
            }
        }]
    },
    
    // Payment settings
    payment: {
        modesDisponibles: [{
            nom: {
                type: String,
                enum: ['Paiement à la livraison', 'Carte bancaire', 'Virement bancaire', 'PayPal']
            },
            actif: {
                type: Boolean,
                default: true
            },
            description: String
        }],
        taxe: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        }
    },
    
    // Email settings
    email: {
        smtp: {
            host: String,
            port: Number,
            secure: Boolean,
            user: String,
            password: String
        },
        templates: {
            welcome: {
                subject: {
                    type: String,
                    default: 'Bienvenue chez Shifa Parapharmacie'
                },
                body: String
            },
            orderConfirmation: {
                subject: {
                    type: String,
                    default: 'Confirmation de votre commande'
                },
                body: String
            },
            orderStatusUpdate: {
                subject: {
                    type: String,
                    default: 'Mise à jour de votre commande'
                },
                body: String
            }
        }
    },
    
    // SEO settings
    seo: {
        metaTitle: {
            type: String,
            default: 'Shifa Parapharmacie - Votre santé, notre priorité'
        },
        metaDescription: {
            type: String,
            default: 'Découvrez notre large gamme de produits de parapharmacie en ligne. Livraison rapide partout en Algérie.'
        },
        metaKeywords: {
            type: String,
            default: 'parapharmacie, santé, beauté, cosmétiques, médicaments, Algérie'
        },
        googleAnalytics: String,
        facebookPixel: String
    },
    
    // Social media
    socialMedia: {
        facebook: String,
        instagram: String,
        twitter: String,
        youtube: String,
        linkedin: String
    },
    
    // Security settings
    security: {
        maxLoginAttempts: {
            type: Number,
            default: 5,
            min: 3,
            max: 10
        },
        lockoutDuration: {
            type: Number,
            default: 15,
            min: 5,
            max: 60
        },
        sessionTimeout: {
            type: Number,
            default: 24,
            min: 1,
            max: 168
        },
        requireEmailVerification: {
            type: Boolean,
            default: false
        }
    },
    
    // Notification settings
    notifications: {
        newOrderAdmin: {
            type: Boolean,
            default: true
        },
        lowStockAlert: {
            type: Boolean,
            default: true
        },
        lowStockThreshold: {
            type: Number,
            default: 10,
            min: 1
        }
    },
    
    // Business settings
    business: {
        devise: {
            type: String,
            default: 'DA'
        },
        langue: {
            type: String,
            enum: ['fr', 'ar', 'en'],
            default: 'fr'
        },
        timezone: {
            type: String,
            default: 'Africa/Algiers'
        },
        numeroRC: String,
        numeroNIF: String,
        numeroNIS: String
    },
    
    // Maintenance mode
    maintenance: {
        actif: {
            type: Boolean,
            default: false
        },
        message: {
            type: String,
            default: 'Site en maintenance. Nous revenons bientôt!'
        },
        dateDebut: Date,
        dateFin: Date
    },
    
    // Feature flags
    features: {
        wishlist: {
            type: Boolean,
            default: true
        },
        reviews: {
            type: Boolean,
            default: true
        },
        loyaltyProgram: {
            type: Boolean,
            default: false
        },
        multiLanguage: {
            type: Boolean,
            default: false
        },
        chatSupport: {
            type: Boolean,
            default: true
        }
    },
    
    // Theme settings
    theme: {
        primaryColor: {
            type: String,
            default: '#10b981'
        },
        secondaryColor: {
            type: String,
            default: '#059669'
        },
        accentColor: {
            type: String,
            default: '#34d399'
        },
        fontFamily: {
            type: String,
            default: 'Inter'
        }
    },
    
    // Cache settings
    cache: {
        productsCacheTimeout: {
            type: Number,
            default: 300,
            min: 60
        },
        categoriesCacheTimeout: {
            type: Number,
            default: 3600,
            min: 300
        }
    }
}, {
    timestamps: true
});

// Ensure only one settings document exists
SettingsSchema.statics.getSettings = async function() {
    let settings = await this.findOne();
    
    if (!settings) {
        // Create default settings if none exist
        settings = new this({});
        await settings.save();
    }
    
    return settings;
};

// Update settings method
SettingsSchema.statics.updateSettings = async function(updates) {
    let settings = await this.findOne();
    
    if (!settings) {
        settings = new this(updates);
    } else {
        // Deep merge updates
        Object.keys(updates).forEach(key => {
            if (typeof updates[key] === 'object' && updates[key] !== null && !Array.isArray(updates[key])) {
                settings[key] = { ...settings[key].toObject(), ...updates[key] };
            } else {
                settings[key] = updates[key];
            }
        });
    }
    
    await settings.save();
    return settings;
};

// Get specific setting
SettingsSchema.statics.getSetting = async function(path) {
    const settings = await this.getSettings();
    
    // Handle nested paths like 'shipping.fraisLivraisonDefaut'
    const keys = path.split('.');
    let value = settings;
    
    for (const key of keys) {
        value = value[key];
        if (value === undefined) break;
    }
    
    return value;
};

// Set specific setting
SettingsSchema.statics.setSetting = async function(path, value) {
    const keys = path.split('.');
    const updateObj = {};
    
    // Build nested update object
    let current = updateObj;
    for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = {};
        current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    
    return await this.updateSettings(updateObj);
};

// Initialize default wilayas
SettingsSchema.statics.initializeDefaultWilayas = async function() {
    const settings = await this.getSettings();
    
    if (!settings.shipping.wilayasDisponibles || settings.shipping.wilayasDisponibles.length === 0) {
        const wilayasAlgerie = [
            { nom: 'Adrar', fraisLivraison: 800, delaiLivraison: '3-8 jours' },
            { nom: 'Chlef', fraisLivraison: 600, delaiLivraison: '2-5 jours' },
            { nom: 'Laghouat', fraisLivraison: 700, delaiLivraison: '3-6 jours' },
            { nom: 'Oum El Bouaghi', fraisLivraison: 650, delaiLivraison: '2-6 jours' },
            { nom: 'Batna', fraisLivraison: 650, delaiLivraison: '2-6 jours' },
            { nom: 'Béjaïa', fraisLivraison: 600, delaiLivraison: '2-5 jours' },
            { nom: 'Biskra', fraisLivraison: 700, delaiLivraison: '3-6 jours' },
            { nom: 'Béchar', fraisLivraison: 900, delaiLivraison: '4-8 jours' },
            { nom: 'Blida', fraisLivraison: 400, delaiLivraison: '1-3 jours' },
            { nom: 'Bouira', fraisLivraison: 550, delaiLivraison: '2-4 jours' },
            { nom: 'Tamanrasset', fraisLivraison: 1200, delaiLivraison: '5-10 jours' },
            { nom: 'Tébessa', fraisLivraison: 750, delaiLivraison: '3-7 jours' },
            { nom: 'Tlemcen', fraisLivraison: 700, delaiLivraison: '2-6 jours' },
            { nom: 'Tiaret', fraisLivraison: 650, delaiLivraison: '2-5 jours' },
            { nom: 'Tizi Ouzou', fraisLivraison: 500, delaiLivraison: '1-4 jours' },
            { nom: 'Alger', fraisLivraison: 300, delaiLivraison: '1-2 jours' },
            { nom: 'Djelfa', fraisLivraison: 650, delaiLivraison: '2-6 jours' },
            { nom: 'Jijel', fraisLivraison: 650, delaiLivraison: '2-5 jours' },
            { nom: 'Sétif', fraisLivraison: 600, delaiLivraison: '2-5 jours' },
            { nom: 'Saïda', fraisLivraison: 700, delaiLivraison: '2-6 jours' },
            { nom: 'Skikda', fraisLivraison: 650, delaiLivraison: '2-5 jours' },
            { nom: 'Sidi Bel Abbès', fraisLivraison: 700, delaiLivraison: '2-6 jours' },
            { nom: 'Annaba', fraisLivraison: 700, delaiLivraison: '2-6 jours' },
            { nom: 'Guelma', fraisLivraison: 700, delaiLivraison: '2-6 jours' },
            { nom: 'Constantine', fraisLivraison: 650, delaiLivraison: '2-5 jours' },
            { nom: 'Médéa', fraisLivraison: 550, delaiLivraison: '2-4 jours' },
            { nom: 'Mostaganem', fraisLivraison: 650, delaiLivraison: '2-5 jours' },
            { nom: 'M\'Sila', fraisLivraison: 600, delaiLivraison: '2-5 jours' },
            { nom: 'Mascara', fraisLivraison: 650, delaiLivraison: '2-5 jours' },
            { nom: 'Ouargla', fraisLivraison: 800, delaiLivraison: '3-7 jours' },
            { nom: 'Oran', fraisLivraison: 600, delaiLivraison: '2-5 jours' },
            { nom: 'El Bayadh', fraisLivraison: 750, delaiLivraison: '3-6 jours' },
            { nom: 'Illizi', fraisLivraison: 1000, delaiLivraison: '4-9 jours' },
            { nom: 'Bordj Bou Arréridj', fraisLivraison: 600, delaiLivraison: '2-5 jours' },
            { nom: 'Boumerdès', fraisLivraison: 400, delaiLivraison: '1-3 jours' },
            { nom: 'El Tarf', fraisLivraison: 750, delaiLivraison: '3-6 jours' },
            { nom: 'Tindouf', fraisLivraison: 1100, delaiLivraison: '5-9 jours' },
            { nom: 'Tissemsilt', fraisLivraison: 650, delaiLivraison: '2-5 jours' },
            { nom: 'El Oued', fraisLivraison: 750, delaiLivraison: '3-6 jours' },
            { nom: 'Khenchela', fraisLivraison: 700, delaiLivraison: '3-6 jours' },
            { nom: 'Souk Ahras', fraisLivraison: 750, delaiLivraison: '3-6 jours' },
            { nom: 'Tipaza', fraisLivraison: 400, delaiLivraison: '1-3 jours' },
            { nom: 'Mila', fraisLivraison: 650, delaiLivraison: '2-5 jours' },
            { nom: 'Aïn Defla', fraisLivraison: 550, delaiLivraison: '2-4 jours' },
            { nom: 'Naâma', fraisLivraison: 800, delaiLivraison: '3-7 jours' },
            { nom: 'Aïn Témouchent', fraisLivraison: 650, delaiLivraison: '2-5 jours' },
            { nom: 'Ghardaïa', fraisLivraison: 750, delaiLivraison: '3-6 jours' },
            { nom: 'Relizane', fraisLivraison: 650, delaiLivraison: '2-5 jours' }
        ];
        
        settings.shipping.wilayasDisponibles = wilayasAlgerie;
        await settings.save();
    }
    
    return settings;
};

module.exports = mongoose.model('Settings', SettingsSchema);
