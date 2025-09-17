const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    nom: {
        type: String,
        required: [true, 'Le nom du produit est requis'],
        trim: true,
        maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères']
    },
    description: {
        type: String,
        required: [true, 'La description est requise'],
        trim: true,
        maxlength: [1000, 'La description ne peut pas dépasser 1000 caractères']
    },
    prix: {
        type: Number,
        required: [true, 'Le prix est requis'],
        min: [0, 'Le prix ne peut pas être négatif']
    },
    prixOriginal: {
        type: Number,
        default: null,
        min: [0, 'Le prix original ne peut pas être négatif'],
        validate: {
            validator: function(value) {
                // If prixOriginal is set, it should be higher than prix for promotions
                return value === null || value === undefined || value >= this.prix;
            },
            message: 'Le prix original doit être supérieur ou égal au prix actuel'
        }
    },
    categorie: {
        type: String,
        required: [true, 'La catégorie est requise'],
        enum: {
            values: [
                'Vitalité',
                'Sport', 
                'Visage',
                'Cheveux',
                'Solaire',
                'Intime',
                'Soins',
                'Bébé',
                'Maman',
                'Minceur',
                'Homme',
                'Dentaire'
            ],
            message: 'Catégorie invalide'
        }
    },
    sousCategorie: {
        type: String,
        default: '',
        trim: true,
        maxlength: [50, 'La sous-catégorie ne peut pas dépasser 50 caractères']
    },
    image: {
        type: String,
        default: '',
        validate: {
            validator: function(value) {
                if (!value) return true;
                // Basic URL validation or base64 validation
                return /^(https?:\/\/|data:image\/)/.test(value);
            },
            message: 'Format d\'image invalide'
        }
    },
    images: [{
        type: String,
        validate: {
            validator: function(value) {
                return /^(https?:\/\/|data:image\/)/.test(value);
            },
            message: 'Format d\'image invalide'
        }
    }],
    stock: {
        type: Number,
        required: [true, 'Le stock est requis'],
        min: [0, 'Le stock ne peut pas être négatif'],
        default: 0,
        validate: {
            validator: Number.isInteger,
            message: 'Le stock doit être un nombre entier'
        }
    },
    seuilStockBas: {
        type: Number,
        default: 5,
        min: [0, 'Le seuil ne peut pas être négatif']
    },
    enPromotion: {
        type: Boolean,
        default: false
    },
    pourcentagePromotion: {
        type: Number,
        min: [0, 'Le pourcentage ne peut pas être négatif'],
        max: [100, 'Le pourcentage ne peut pas dépasser 100'],
        default: 0,
        validate: {
            validator: function(value) {
                // If enPromotion is true, pourcentagePromotion should be > 0
                if (this.enPromotion && value <= 0) {
                    return false;
                }
                return true;
            },
            message: 'Le pourcentage de promotion doit être supérieur à 0 si le produit est en promotion'
        }
    },
    dateDebutPromotion: {
        type: Date,
        default: null
    },
    dateFinPromotion: {
        type: Date,
        default: null,
        validate: {
            validator: function(value) {
                if (value && this.dateDebutPromotion) {
                    return value > this.dateDebutPromotion;
                }
                return true;
            },
            message: 'La date de fin de promotion doit être postérieure à la date de début'
        }
    },
    marque: {
        type: String,
        default: '',
        trim: true,
        maxlength: [50, 'La marque ne peut pas dépasser 50 caractères']
    },
    ingredients: {
        type: String,
        default: '',
        trim: true,
        maxlength: [500, 'Les ingrédients ne peuvent pas dépasser 500 caractères']
    },
    modeEmploi: {
        type: String,
        default: '',
        trim: true,
        maxlength: [500, 'Le mode d\'emploi ne peut pas dépasser 500 caractères']
    },
    precautions: {
        type: String,
        default: '',
        trim: true,
        maxlength: [500, 'Les précautions ne peuvent pas dépasser 500 caractères']
    },
    enVedette: {
        type: Boolean,
        default: false
    },
    actif: {
        type: Boolean,
        default: true
    },
    dateAjout: {
        type: Date,
        default: Date.now
    },
    dateModification: {
        type: Date,
        default: Date.now
    },
    poids: {
        type: Number,
        default: null,
        min: [0, 'Le poids ne peut pas être négatif']
    },
    dimensions: {
        longueur: {
            type: Number,
            default: null,
            min: [0, 'La longueur ne peut pas être négative']
        },
        largeur: {
            type: Number,
            default: null,
            min: [0, 'La largeur ne peut pas être négative']
        },
        hauteur: {
            type: Number,
            default: null,
            min: [0, 'La hauteur ne peut pas être négative']
        }
    },
    codeBarres: {
        type: String,
        default: '',
        trim: true,
        unique: true,
        sparse: true, // Allows multiple empty strings
        validate: {
            validator: function(value) {
                if (!value) return true;
                // Basic barcode validation (digits only)
                return /^\d+$/.test(value);
            },
            message: 'Le code-barres doit contenir uniquement des chiffres'
        }
    },
    numeroLot: {
        type: String,
        default: '',
        trim: true
    },
    dateExpiration: {
        type: Date,
        default: null,
        validate: {
            validator: function(value) {
                if (!value) return true;
                return value > new Date();
            },
            message: 'La date d\'expiration doit être dans le futur'
        }
    },
    fournisseur: {
        nom: {
            type: String,
            default: '',
            trim: true
        },
        contact: {
            type: String,
            default: '',
            trim: true
        },
        email: {
            type: String,
            default: '',
            trim: true,
            validate: {
                validator: function(value) {
                    if (!value) return true;
                    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
                },
                message: 'Format d\'email invalide'
            }
        }
    },
    statistiques: {
        vuesTotal: {
            type: Number,
            default: 0,
            min: [0, 'Les vues ne peuvent pas être négatives']
        },
        ventesTotal: {
            type: Number,
            default: 0,
            min: [0, 'Les ventes ne peuvent pas être négatives']
        },
        derniereVente: {
            type: Date,
            default: null
        },
        notesMoyenne: {
            type: Number,
            default: 0,
            min: [0, 'La note ne peut pas être négative'],
            max: [5, 'La note ne peut pas dépasser 5']
        },
        nombreAvis: {
            type: Number,
            default: 0,
            min: [0, 'Le nombre d\'avis ne peut pas être négatif']
        }
    },
    motsClefs: [{
        type: String,
        trim: true,
        lowercase: true
    }],
    conditions: {
        temperatureStockage: {
            type: String,
            enum: ['ambiant', 'frais', 'froid'],
            default: 'ambiant'
        },
        sensibleLumiere: {
            type: Boolean,
            default: false
        },
        fragile: {
            type: Boolean,
            default: false
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Index pour les recherches fréquentes
ProductSchema.index({ nom: 'text', description: 'text', marque: 'text', motsClefs: 'text' });
ProductSchema.index({ categorie: 1 });
ProductSchema.index({ prix: 1 });
ProductSchema.index({ enVedette: 1 });
ProductSchema.index({ enPromotion: 1 });
ProductSchema.index({ actif: 1 });
ProductSchema.index({ stock: 1 });
ProductSchema.index({ dateAjout: -1 });
ProductSchema.index({ 'statistiques.vuesTotal': -1 });
ProductSchema.index({ 'statistiques.ventesTotal': -1 });

// Virtual pour vérifier si le stock est bas
ProductSchema.virtual('stockBas').get(function() {
    return this.stock <= this.seuilStockBas;
});

// Virtual pour calculer le prix avec promotion
ProductSchema.virtual('prixPromotion').get(function() {
    if (this.enPromotion && this.prixOriginal && this.pourcentagePromotion > 0) {
        return this.prixOriginal - (this.prixOriginal * this.pourcentagePromotion / 100);
    }
    return this.prix;
});

// Virtual pour vérifier si la promotion est active
ProductSchema.virtual('promotionActive').get(function() {
    if (!this.enPromotion) return false;
    
    const now = new Date();
    
    if (this.dateDebutPromotion && this.dateDebutPromotion > now) {
        return false;
    }
    
    if (this.dateFinPromotion && this.dateFinPromotion < now) {
        return false;
    }
    
    return true;
});

// Virtual pour le statut du stock
ProductSchema.virtual('statutStock').get(function() {
    if (this.stock === 0) return 'rupture';
    if (this.stock <= this.seuilStockBas) return 'bas';
    return 'normal';
});

// Middleware pre-save pour mettre à jour dateModification
ProductSchema.pre('save', function(next) {
    this.dateModification = new Date();
    
    // Calculer automatiquement le pourcentage de promotion si nécessaire
    if (this.enPromotion && this.prixOriginal && this.prix && !this.pourcentagePromotion) {
        this.pourcentagePromotion = Math.round((this.prixOriginal - this.prix) / this.prixOriginal * 100);
    }
    
    // Réinitialiser la promotion si elle n'est plus valide
    if (this.enPromotion && this.dateFinPromotion && this.dateFinPromotion < new Date()) {
        this.enPromotion = false;
        this.pourcentagePromotion = 0;
    }
    
    next();
});

// Middleware pre-save pour générer des mots-clés automatiquement
ProductSchema.pre('save', function(next) {
    const motsGeneres = [];
    
    // Ajouter le nom (mots séparés)
    if (this.nom) {
        motsGeneres.push(...this.nom.toLowerCase().split(' ').filter(mot => mot.length > 2));
    }
    
    // Ajouter la marque
    if (this.marque) {
        motsGeneres.push(this.marque.toLowerCase());
    }
    
    // Ajouter la catégorie
    if (this.categorie) {
        motsGeneres.push(this.categorie.toLowerCase());
    }
    
    // Fusionner avec les mots-clés existants
    this.motsClefs = [...new Set([...this.motsClefs, ...motsGeneres])];
    
    next();
});

// Méthodes d'instance
ProductSchema.methods.ajouterVue = function() {
    this.statistiques.vuesTotal += 1;
    return this.save({ validateBeforeSave: false });
};

ProductSchema.methods.ajouterVente = function(quantite = 1) {
    this.statistiques.ventesTotal += quantite;
    this.statistiques.derniereVente = new Date();
    this.stock = Math.max(0, this.stock - quantite);
    return this.save();
};

ProductSchema.methods.ajouterAvis = function(note) {
    const totalPoints = this.statistiques.notesMoyenne * this.statistiques.nombreAvis + note;
    this.statistiques.nombreAvis += 1;
    this.statistiques.notesMoyenne = totalPoints / this.statistiques.nombreAvis;
    return this.save({ validateBeforeSave: false });
};

ProductSchema.methods.mettreEnPromotion = function(pourcentage, dateDebut = null, dateFin = null) {
    this.enPromotion = true;
    this.pourcentagePromotion = pourcentage;
    
    if (!this.prixOriginal) {
        this.prixOriginal = this.prix;
    }
    
    this.prix = this.prixOriginal - (this.prixOriginal * pourcentage / 100);
    
    if (dateDebut) this.dateDebutPromotion = dateDebut;
    if (dateFin) this.dateFinPromotion = dateFin;
    
    return this.save();
};

ProductSchema.methods.arreterPromotion = function() {
    if (this.prixOriginal) {
        this.prix = this.prixOriginal;
        this.prixOriginal = null;
    }
    
    this.enPromotion = false;
    this.pourcentagePromotion = 0;
    this.dateDebutPromotion = null;
    this.dateFinPromotion = null;
    
    return this.save();
};

ProductSchema.methods.ajusterStock = function(quantite, operation = 'add') {
    if (operation === 'add') {
        this.stock += quantite;
    } else if (operation === 'subtract') {
        this.stock = Math.max(0, this.stock - quantite);
    } else if (operation === 'set') {
        this.stock = Math.max(0, quantite);
    }
    
    return this.save();
};

// Méthodes statiques
ProductSchema.statics.rechercheTexte = function(texte, options = {}) {
    const query = this.find(
        { $text: { $search: texte }, actif: true },
        { score: { $meta: 'textScore' } }
    ).sort({ score: { $meta: 'textScore' } });
    
    if (options.limite) query.limit(options.limite);
    if (options.categorie) query.where('categorie', options.categorie);
    
    return query;
};

ProductSchema.statics.obtenirProduitsVedette = function(limite = 8) {
    return this.find({ enVedette: true, actif: true })
        .sort({ 'statistiques.vuesTotal': -1 })
        .limit(limite);
};

ProductSchema.statics.obtenirProduitsPromotion = function(limite = 8) {
    return this.find({ enPromotion: true, actif: true })
        .sort({ pourcentagePromotion: -1 })
        .limit(limite);
};

ProductSchema.statics.obtenirProduitsPopulaires = function(limite = 8) {
    return this.find({ actif: true })
        .sort({ 'statistiques.ventesTotal': -1, 'statistiques.vuesTotal': -1 })
        .limit(limite);
};

ProductSchema.statics.obtenirStockBas = function(seuil = null) {
    const query = { actif: true };
    
    if (seuil) {
        query.stock = { $lte: seuil };
    } else {
        query.$expr = { $lte: ['$stock', '$seuilStockBas'] };
    }
    
    return this.find(query).sort({ stock: 1 });
};

ProductSchema.statics.statistiquesGenerales = function() {
    return this.aggregate([
        {
            $group: {
                _id: null,
                totalProduits: { $sum: 1 },
                produitsActifs: { $sum: { $cond: ['$actif', 1, 0] } },
                produitsEnVedette: { $sum: { $cond: ['$enVedette', 1, 0] } },
                produitsEnPromotion: { $sum: { $cond: ['$enPromotion', 1, 0] } },
                stockTotal: { $sum: '$stock' },
                prixMoyen: { $avg: '$prix' },
                vuesTotal: { $sum: '$statistiques.vuesTotal' },
                ventesTotal: { $sum: '$statistiques.ventesTotal' }
            }
        }
    ]);
};

module.exports = mongoose.model('Product', ProductSchema);
