const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
    // Site Information
    siteName: {
        type: String,
        required: true,
        trim: true,
        default: 'Shifa - Parapharmacie'
    },
    siteDescription: {
        type: String,
        required: true,
        trim: true,
        default: 'Votre parapharmacie de confiance à Tipaza, Algérie'
    },
    siteKeywords: {
        type: String,
        default: 'parapharmacie, santé, beauté, Tipaza, Algérie, pharmacie, soins'
    },
    siteLogo: {
        type: String,
        default: ''
    },
    favicon: {
        type: String,
        default: ''
    },
    
    // Contact Information
    contact: {
        email: {
            type: String,
            required: true,
            default: 'pharmaciegaher@gmail.com',
            validate: {
                validator: function(v) {
                    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
                },
                message: 'Format d\'email invalide'
            }
        },
        telephone: {
            type: String,
            required: true,
            default: '+213 123 456 789'
        },
        fax: {
            type: String,
            default: ''
        },
        adresse: {
            type: String,
            required: true,
            default: 'Tipaza, Algérie'
        },
        ville: {
            type: String,
            default: 'Tipaza'
        },
        wilaya: {
            type: String,
            default: 'Tipaza'
        },
        codePostal: {
            type: String,
            default: '42000'
        },
        horaires: {
            type: String,
            default: 'Lun-Sam: 8h-20h, Dim: 9h-18h'
        },
        horaireRamadan: {
            type: String,
            default: 'Lun-Sam: 9h-17h, Dim: 10h-16h'
        }
    },
    
    // Social Media
    socialMedia: {
        facebook: {
            type: String,
            default: 'https://www.facebook.com/pharmaciegaher/?locale=mg_MG'
        },
        instagram: {
            type: String,
            default: 'https://www.instagram.com/pharmaciegaher/'
        },
        twitter: {
            type: String,
            default: ''
        },
        youtube: {
            type: String,
            default: ''
        },
        linkedin: {
            type: String,
            default: ''
        },
        tiktok: {
            type: String,
            default: ''
        },
        whatsapp: {
            type: String,
            default: '+213123456789'
        }
    },
    
    // E-commerce Settings
    shipping: {
        standardCost: {
            type: Number,
            default: 300,
            min: 0
        },
        expressCost: {
            type: Number,
            default: 500,
            min: 0
        },
        freeShippingThreshold: {
            type: Number,
            default: 5000,
            min: 0
        },
        estimatedDays: {
            type: String,
            default: '2-5 jours ouvrables'
        },
        expressEstimatedDays: {
            type: String,
            default: '1-2 jours ouvrables'
        },
        availableWilayas: [{
            type: String,
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
        }],
        shippingMethods: [{
            nom: {
                type: String,
                required: true
            },
            prix: {
                type: Number,
                required: true,
                min: 0
            },
            delai: {
                type: String,
                required: true
            },
            description: {
                type: String,
                default: ''
            },
            actif: {
                type: Boolean,
                default: true
            }
        }]
    },
    
    // Payment Settings
    payment: {
        currency: {
            type: String,
            default: 'DA',
            enum: ['DA', 'USD', 'EUR']
        },
        methods: [{
            nom: {
                type: String,
                required: true
            },
            actif: {
                type: Boolean,
                default: true
            },
            configuration: {
                type: Map,
                of: String,
                default: {}
            }
        }],
        defaultMethod: {
            type: String,
            default: 'Paiement à la livraison'
        },
        cashOnDelivery: {
            type: Boolean,
            default: true
        },
        bankTransfer: {
            type: Boolean,
            default: false
        },
        creditCard: {
            type: Boolean,
            default: false
        }
    },
    
    // Tax Settings
    tax: {
        enabled: {
            type: Boolean,
            default: false
        },
        rate: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        name: {
            type: String,
            default: 'TVA'
        }
    },
    
    // Localization
    localization: {
        language: {
            type: String,
            default: 'fr',
            enum: ['fr', 'ar', 'en']
        },
        timezone: {
            type: String,
            default: 'Africa/Algiers'
        },
        dateFormat: {
            type: String,
            default: 'DD/MM/YYYY'
        },
        numberFormat: {
            decimal: {
                type: String,
                default: ','
            },
            thousands: {
                type: String,
                default: ' '
            }
        }
    },
    
    // Email Settings
    email: {
        smtp: {
            host: {
                type: String,
                default: ''
            },
            port: {
                type: Number,
                default: 587
            },
            secure: {
                type: Boolean,
                default: false
            },
            username: {
                type: String,
                default: ''
            },
            password: {
                type: String,
                default: '',
                select: false
            }
        },
        from: {
            name: {
                type: String,
                default: 'Shifa Parapharmacie'
            },
            email: {
                type: String,
                default: 'pharmaciegaher@gmail.com'
            }
        },
        templates: {
            welcome: {
                subject: {
                    type: String,
                    default: 'Bienvenue chez Shifa Parapharmacie'
                },
                enabled: {
                    type: Boolean,
                    default: true
                }
            },
            orderConfirmation: {
                subject: {
                    type: String,
                    default: 'Confirmation de votre commande #{orderNumber}'
                },
                enabled: {
                    type: Boolean,
                    default: true
                }
            },
            orderShipped: {
                subject: {
                    type: String,
                    default: 'Votre commande #{orderNumber} a été expédiée'
                },
                enabled: {
                    type: Boolean,
                    default: true
                }
            },
            passwordReset: {
                subject: {
                    type: String,
                    default: 'Réinitialisation de votre mot de passe'
                },
                enabled: {
                    type: Boolean,
                    default: true
                }
            }
        }
    },
    
    // SMS Settings
    sms: {
        provider: {
            type: String,
            default: '',
            enum: ['', 'twilio', 'nexmo', 'local']
        },
        configuration: {
            type: Map,
            of: String,
            default: {}
        },
        templates: {
            orderConfirmation: {
                message: {
                    type: String,
                    default: 'Votre commande #{orderNumber} a été confirmée. Merci de votre confiance!'
                },
                enabled: {
                    type: Boolean,
                    default: false
                }
            },
            orderShipped: {
                message: {
                    type: String,
                    default: 'Votre commande #{orderNumber} a été expédiée!'
                },
                enabled: {
                    type: Boolean,
                    default: false
                }
            }
        }
    },
    
    // SEO Settings
    seo: {
        metaTitle: {
            type: String,
            default: 'Shifa - Parapharmacie | Tipaza, Algérie'
        },
        metaDescription: {
            type: String,
            default: 'Découvrez notre parapharmacie Shifa à Tipaza. Large choix de produits de santé et beauté. Livraison rapide en Algérie.'
        },
        metaKeywords: {
            type: String,
            default: 'parapharmacie, santé, beauté, cosmétiques, vitamines, Tipaza, Algérie'
        },
        canonicalUrl: {
            type: String,
            default: ''
        },
        robotsTxt: {
            type: String,
            default: 'User-agent: *\nAllow: /'
        },
        googleAnalyticsId: {
            type: String,
            default: ''
        },
        googleTagManagerId: {
            type: String,
            default: ''
        },
        facebookPixelId: {
            type: String,
            default: ''
        }
    },
    
    // Security Settings
    security: {
        allowRegistration: {
            type: Boolean,
            default: true
        },
        emailVerificationRequired: {
            type: Boolean,
            default: false
        },
        phoneVerificationRequired: {
            type: Boolean,
            default: false
        },
        maxLoginAttempts: {
            type: Number,
            default: 5,
            min: 3,
            max: 10
        },
        lockoutDuration: {
            type: Number,
            default: 15, // minutes
            min: 5,
            max: 60
        },
        sessionTimeout: {
            type: Number,
            default: 30, // days
            min: 1,
            max: 365
        }
    },
    
    // Notifications
    notifications: {
        newOrder: {
            email: {
                type: Boolean,
                default: true
            },
            sms: {
                type: Boolean,
                default: false
            }
        },
        lowStock: {
            email: {
                type: Boolean,
                default: true
            },
            threshold: {
                type: Number,
                default: 5,
                min: 0
            }
        },
        newUser: {
            email: {
                type: Boolean,
                default: true
            }
        }
    },
    
    // Maintenance
    maintenance: {
        enabled: {
            type: Boolean,
            default: false
        },
        message: {
            type: String,
            default: 'Site en maintenance. Nous serons bientôt de retour!'
        },
        allowedIPs: [{
            type: String
        }],
        scheduledStart: {
            type: Date,
            default: null
        },
        scheduledEnd: {
            type: Date,
            default: null
        }
    },
    
    // Advanced Settings
    advanced: {
        enableCache: {
            type: Boolean,
            default: true
        },
        cacheTimeout: {
            type: Number,
            default: 3600, // seconds
            min: 60,
            max: 86400
        },
        enableCompression: {
            type: Boolean,
            default: true
        },
        enableLogging: {
            type: Boolean,
            default: true
        },
        logLevel: {
            type: String,
            default: 'info',
            enum: ['error', 'warn', 'info', 'debug']
        },
        backupFrequency: {
            type: String,
            default: 'daily',
            enum: ['hourly', 'daily', 'weekly', 'monthly']
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Ensure only one settings document
SettingsSchema.index({ _id: 1 }, { unique: true });

// Virtual for complete contact info
SettingsSchema.virtual('contactComplet').get(function() {
    return {
        nom: this.siteName,
        email: this.contact.email,
        telephone: this.contact.telephone,
        adresse: this.contact.adresse,
        ville: this.contact.ville,
        wilaya: this.contact.wilaya,
        horaires: this.contact.horaires
    };
});

// Virtual for social media links array
SettingsSchema.virtual('reseauxSociaux').get(function() {
    const reseaux = [];
    
    if (this.socialMedia.facebook) {
        reseaux.push({ nom: 'Facebook', url: this.socialMedia.facebook, icon: 'fab fa-facebook' });
    }
    if (this.socialMedia.instagram) {
        reseaux.push({ nom: 'Instagram', url: this.socialMedia.instagram, icon: 'fab fa-instagram' });
    }
    if (this.socialMedia.twitter) {
        reseaux.push({ nom: 'Twitter', url: this.socialMedia.twitter, icon: 'fab fa-twitter' });
    }
    if (this.socialMedia.youtube) {
        reseaux.push({ nom: 'YouTube', url: this.socialMedia.youtube, icon: 'fab fa-youtube' });
    }
    if (this.socialMedia.linkedin) {
        reseaux.push({ nom: 'LinkedIn', url: this.socialMedia.linkedin, icon: 'fab fa-linkedin' });
    }
    
    return reseaux;
});

// Method to get shipping cost for a wilaya
SettingsSchema.methods.getShippingCost = function(wilaya, orderTotal = 0) {
    if (orderTotal >= this.shipping.freeShippingThreshold) {
        return 0;
    }
    
    // Check if wilaya is in available list
    if (this.shipping.availableWilayas.length > 0 && 
        !this.shipping.availableWilayas.includes(wilaya)) {
        return null; // Shipping not available
    }
    
    return this.shipping.standardCost;
};

// Method to check if feature is enabled
SettingsSchema.methods.isFeatureEnabled = function(feature) {
    switch (feature) {
        case 'registration':
            return this.security.allowRegistration;
        case 'emailVerification':
            return this.security.emailVerificationRequired;
        case 'phoneVerification':
            return this.security.phoneVerificationRequired;
        case 'maintenance':
            return this.maintenance.enabled;
        case 'cache':
            return this.advanced.enableCache;
        case 'compression':
            return this.advanced.enableCompression;
        default:
            return false;
    }
};

// Method to get email template
SettingsSchema.methods.getEmailTemplate = function(templateName) {
    const template = this.email.templates[templateName];
    return template && template.enabled ? template : null;
};

// Method to get SMS template
SettingsSchema.methods.getSMSTemplate = function(templateName) {
    const template = this.sms.templates[templateName];
    return template && template.enabled ? template : null;
};

// Static method to get current settings
SettingsSchema.statics.getCurrent = async function() {
    let settings = await this.findOne();
    
    // Create default settings if none exist
    if (!settings) {
        settings = new this({});
        await settings.save();
    }
    
    return settings;
};

// Pre-save middleware
SettingsSchema.pre('save', function(next) {
    // Ensure shipping methods have default values
    if (!this.shipping.shippingMethods || this.shipping.shippingMethods.length === 0) {
        this.shipping.shippingMethods = [
            {
                nom: 'Livraison standard',
                prix: this.shipping.standardCost,
                delai: this.shipping.estimatedDays,
                description: 'Livraison normale',
                actif: true
            }
        ];
    }
    
    // Ensure payment methods have default values
    if (!this.payment.methods || this.payment.methods.length === 0) {
        this.payment.methods = [
            {
                nom: 'Paiement à la livraison',
                actif: true,
                configuration: {}
            }
        ];
    }
    
    next();
});

module.exports = mongoose.model('Settings', SettingsSchema);
