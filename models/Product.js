const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    nom: {
        type: String,
        required: [true, 'Le nom du produit est requis'],
        trim: true,
        maxlength: [200, 'Le nom ne peut pas dépasser 200 caractères']
    },
    description: {
        type: String,
        required: [true, 'La description est requise'],
        trim: true,
        maxlength: [2000, 'La description ne peut pas dépasser 2000 caractères']
    },
    marque: {
        type: String,
        trim: true,
        maxlength: [100, 'La marque ne peut pas dépasser 100 caractères'],
        default: ''
    },
    categorie: {
        type: String,
        required: [true, 'La catégorie est requise'],
        enum: {
            values: [
                'Vitalité', 'Sport', 'Visage', 'Cheveux', 'Solaire', 
                'Intime', 'Soins', 'Bébé', 'Homme', 'Dentaire',
                'Maman', 'Minceur'
            ],
            message: '{VALUE} n\'est pas une catégorie valide'
        }
    },
    prix: {
        type: Number,
        required: [true, 'Le prix est requis'],
        min: [0, 'Le prix ne peut pas être négatif'],
        validate: {
            validator: function(v) {
                return v > 0;
            },
            message: 'Le prix doit être supérieur à 0'
        }
    },
    prixOriginal: {
        type: Number,
        min: [0, 'Le prix original ne peut pas être négatif'],
        validate: {
            validator: function(v) {
                return !v || v >= this.prix;
            },
            message: 'Le prix original doit être supérieur ou égal au prix de vente'
        }
    },
    pourcentagePromotion: {
        type: Number,
        min: [0, 'Le pourcentage de promotion ne peut pas être négatif'],
        max: [100, 'Le pourcentage de promotion ne peut pas dépasser 100%'],
        default: 0
    },
    stock: {
        type: Number,
        required: [true, 'Le stock est requis'],
        min: [0, 'Le stock ne peut pas être négatif'],
        default: 0
    },
    stockMin: {
        type: Number,
        min: [0, 'Le stock minimum ne peut pas être négatif'],
        default: 5
    },
    unite: {
        type: String,
        enum: ['pièce', 'ml', 'g', 'kg', 'l', 'boîte', 'tube', 'flacon'],
        default: 'pièce'
    },
    image: {
        type: String,
        default: ''
    },
    images: [{
        type: String
    }],
    ingredients: {
        type: String,
        trim: true,
        maxlength: [1000, 'Les ingrédients ne peuvent pas dépasser 1000 caractères'],
        default: ''
    },
    modeEmploi: {
        type: String,
        trim: true,
        maxlength: [1000, 'Le mode d\'emploi ne peut pas dépasser 1000 caractères'],
        default: ''
    },
    precautions: {
        type: String,
        trim: true,
        maxlength: [1000, 'Les précautions ne peuvent pas dépasser 1000 caractères'],
        default: ''
    },
    conseils: {
        type: String,
        trim: true,
        maxlength: [1000, 'Les conseils ne peuvent pas dépasser 1000 caractères'],
        default: ''
    },
    proprietes: [{
        nom: {
            type: String,
            required: true,
            trim: true
        },
        valeur: {
            type: String,
            required: true,
            trim: true
        }
    }],
    tags: [{
        type: String,
        trim: true,
        lowercase: true
    }],
    actif: {
        type: Boolean,
        default: true
    },
    enVedette: {
        type: Boolean,
        default: false
    },
    enPromotion: {
        type: Boolean,
        default: false
    },
    nouveau: {
        type: Boolean,
        default: true
    },
    populaire: {
        type: Boolean,
        default: false
    },
    note: {
        moyenne: {
            type: Number,
            min: 0,
            max: 5,
            default: 0
        },
        nombreAvis: {
            type: Number,
            min: 0,
            default: 0
        }
    },
    ventes: {
        type: Number,
        min: 0,
        default: 0
    },
    vues: {
        type: Number,
        min: 0,
        default: 0
    },
    poids: {
        type: Number,
        min: 0,
        default: 0
    },
    dimensions: {
        longueur: {
            type: Number,
            min: 0,
            default: 0
        },
        largeur: {
            type: Number,
            min: 0,
            default: 0
        },
        hauteur: {
            type: Number,
            min: 0,
            default: 0
        }
    },
    codeBarres: {
        type: String,
        trim: true,
        unique: true,
        sparse: true
    },
    reference: {
        type: String,
        trim: true,
        unique: true,
        sparse: true
    },
    fournisseur: {
        nom: {
            type: String,
            trim: true,
            default: ''
        },
        contact: {
            type: String,
            trim: true,
            default: ''
        }
    },
    dateExpiration: {
        type: Date
    },
    datePeremption: {
        type: Date
    },
    conditionsStockage: {
        type: String,
        trim: true,
        default: ''
    },
    avertissements: [{
        type: String,
        trim: true
    }],
    certifications: [{
        nom: {
            type: String,
            required: true,
            trim: true
        },
        organisme: {
            type: String,
            trim: true
        },
        dateObtention: {
            type: Date
        },
        valide: {
            type: Boolean,
            default: true
        }
    }],
    seo: {
        metaTitle: {
            type: String,
            trim: true,
            maxlength: [60, 'Le meta title ne peut pas dépasser 60 caractères']
        },
        metaDescription: {
            type: String,
            trim: true,
            maxlength: [160, 'La meta description ne peut pas dépasser 160 caractères']
        },
        slug: {
            type: String,
            trim: true,
            lowercase: true,
            unique: true,
            sparse: true
        }
    },
    dateAjout: {
        type: Date,
        default: Date.now
    },
    dateModification: {
        type: Date,
        default: Date.now
    },
    ajoutePar: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    modifiePar: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Index pour améliorer les performances
ProductSchema.index({ nom: 'text', description: 'text', marque: 'text' });
ProductSchema.index({ categorie: 1 });
ProductSchema.index({ prix: 1 });
ProductSchema.index({ actif: 1 });
ProductSchema.index({ enVedette: 1 });
ProductSchema.index({ enPromotion: 1 });
ProductSchema.index({ stock: 1 });
ProductSchema.index({ dateAjout: -1 });
ProductSchema.index({ 'note.moyenne': -1 });
ProductSchema.index({ ventes: -1 });

// Index composé pour les recherches communes
ProductSchema.index({ actif: 1, categorie: 1, prix: 1 });
ProductSchema.index({ actif: 1, enVedette: 1 });
ProductSchema.index({ actif: 1, enPromotion: 1 });

// Virtual pour vérifier si le produit est en rupture de stock
ProductSchema.virtual('enRuptureStock').get(function() {
    return this.stock === 0;
});

// Virtual pour vérifier si le stock est faible
ProductSchema.virtual('stockFaible').get(function() {
    return this.stock > 0 && this.stock <= this.stockMin;
});

// Virtual pour calculer le pourcentage de promotion automatiquement
ProductSchema.virtual('pourcentagePromotionCalcule').get(function() {
    if (this.prixOriginal && this.prixOriginal > this.prix) {
        return Math.round((this.prixOriginal - this.prix) / this.prixOriginal * 100);
    }
    return 0;
});

// Virtual pour l'URL de l'image principale
ProductSchema.virtual('imageUrl').get(function() {
    if (this.image) {
        return this.image.startsWith('http') ? this.image : `/images/products/${this.image}`;
    }
    return '/images/products/default.jpg';
});

// Virtual pour le slug automatique
ProductSchema.virtual('slugAuto').get(function() {
    return this.nom
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
});

// Middleware pour calculer automatiquement certains champs
ProductSchema.pre('save', function(next) {
    // Mettre à jour la date de modification
    this.dateModification = new Date();
    
    // Calculer le pourcentage de promotion si pas défini
    if (this.enPromotion && this.prixOriginal && !this.pourcentagePromotion) {
        this.pourcentagePromotion = this.pourcentagePromotionCalcule;
    }
    
    // Générer le slug si pas défini
    if (!this.seo.slug) {
        this.seo.slug = this.slugAuto;
    }
    
    // Générer les meta tags SEO si pas définis
    if (!this.seo.metaTitle) {
        this.seo.metaTitle = this.nom.substring(0, 60);
    }
    
    if (!this.seo.metaDescription) {
        this.seo.metaDescription = this.description.substring(0, 160);
    }
    
    // Marquer comme plus nouveau si récemment ajouté (moins de 30 jours)
    const maintenant = new Date();
    const dateAjout = this.dateAjout || maintenant;
    const diffJours = (maintenant - dateAjout) / (1000 * 60 * 60 * 24);
    this.nouveau = diffJours <= 30;
    
    next();
});

// Méthode pour incrémenter les vues
ProductSchema.methods.incrementerVues = function() {
    this.vues += 1;
    return this.save();
};

// Méthode pour incrémenter les ventes
ProductSchema.methods.incrementerVentes = function(quantite = 1) {
    this.ventes += quantite;
    this.stock = Math.max(0, this.stock - quantite);
    return this.save();
};

// Méthode pour mettre à jour la note
ProductSchema.methods.mettreAJourNote = function(nouvelleNote) {
    const nombreTotal = this.note.nombreAvis + 1;
    const sommeTotal = (this.note.moyenne * this.note.nombreAvis) + nouvelleNote;
    
    this.note.moyenne = Math.round((sommeTotal / nombreTotal) * 10) / 10;
    this.note.nombreAvis = nombreTotal;
    
    return this.save();
};

// Méthode pour vérifier la disponibilité
ProductSchema.methods.estDisponible = function(quantiteDemandee = 1) {
    return this.actif && this.stock >= quantiteDemandee;
};

// Méthode statique pour rechercher des produits
ProductSchema.statics.rechercher = function(criteres = {}) {
    let query = this.find({ actif: true });
    
    // Recherche textuelle
    if (criteres.texte) {
        query = query.find({ $text: { $search: criteres.texte } });
    }
    
    // Filtrage par catégorie
    if (criteres.categorie) {
        query = query.where('categorie').equals(criteres.categorie);
    }
    
    // Filtrage par prix
    if (criteres.prixMin) {
        query = query.where('prix').gte(criteres.prixMin);
    }
    
    if (criteres.prixMax) {
        query = query.where('prix').lte(criteres.prixMax);
    }
    
    // Filtres booléens
    if (criteres.enVedette) {
        query = query.where('enVedette').equals(true);
    }
    
    if (criteres.enPromotion) {
        query = query.where('enPromotion').equals(true);
    }
    
    if (criteres.nouveau) {
        query = query.where('nouveau').equals(true);
    }
    
    if (criteres.disponible) {
        query = query.where('stock').gt(0);
    }
    
    // Tri
    if (criteres.tri) {
        const tris = {
            'prix-asc': { prix: 1 },
            'prix-desc': { prix: -1 },
            'nom-asc': { nom: 1 },
            'nom-desc': { nom: -1 },
            'date-asc': { dateAjout: 1 },
            'date-desc': { dateAjout: -1 },
            'note': { 'note.moyenne': -1 },
            'ventes': { ventes: -1 }
        };
        
        query = query.sort(tris[criteres.tri] || { dateAjout: -1 });
    }
    
    return query;
};

// Méthode statique pour obtenir les produits similaires
ProductSchema.statics.obtenirSimilaires = function(productId, categorie, limite = 4) {
    return this.find({
        _id: { $ne: productId },
        categorie: categorie,
        actif: true,
        stock: { $gt: 0 }
    })
    .sort({ ventes: -1, 'note.moyenne': -1 })
    .limit(limite);
};

// Méthode statique pour obtenir les statistiques
ProductSchema.statics.obtenirStatistiques = async function() {
    const pipeline = [
        {
            $match: { actif: true }
        },
        {
            $group: {
                _id: null,
                totalProduits: { $sum: 1 },
                produitsEnStock: { $sum: { $cond: [{ $gt: ['$stock', 0] }, 1, 0] } },
                produitsEnVedette: { $sum: { $cond: ['$enVedette', 1, 0] } },
                produitsEnPromotion: { $sum: { $cond: ['$enPromotion', 1, 0] } },
                prixMoyen: { $avg: '$prix' },
                stockTotal: { $sum: '$stock' },
                ventesTotales: { $sum: '$ventes' }
            }
        }
    ];
    
    const result = await this.aggregate(pipeline);
    return result[0] || {};
};

module.exports = mongoose.model('Product', ProductSchema);
