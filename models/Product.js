const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    nom: {
        type: String,
        required: [true, 'Le nom du produit est requis'],
        trim: true,
        minlength: [2, 'Le nom doit contenir au moins 2 caractères'],
        maxlength: [200, 'Le nom ne peut pas dépasser 200 caractères'],
        index: true
    },
    description: {
        type: String,
        required: [true, 'La description est requise'],
        trim: true,
        minlength: [10, 'La description doit contenir au moins 10 caractères'],
        maxlength: [2000, 'La description ne peut pas dépasser 2000 caractères']
    },
    prix: {
        type: Number,
        required: [true, 'Le prix est requis'],
        min: [0, 'Le prix ne peut pas être négatif'],
        validate: {
            validator: function(v) {
                return v > 0;
            },
            message: 'Le prix doit être supérieur à zéro'
        }
    },
    prixOriginal: {
        type: Number,
        default: null,
        min: [0, 'Le prix original ne peut pas être négatif'],
        validate: {
            validator: function(v) {
                if (v !== null && v !== undefined) {
                    return v >= this.prix;
                }
                return true;
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
                'Homme',
                'Dentaire'
            ],
            message: 'Catégorie invalide'
        },
        index: true
    },
    sousCategorie: {
        type: String,
        default: '',
        trim: true,
        maxlength: [100, 'La sous-catégorie ne peut pas dépasser 100 caractères']
    },
    image: {
        type: String,
        default: '',
        trim: true
    },
    images: [{
        url: {
            type: String,
            trim: true
        },
        alt: {
            type: String,
            default: '',
            trim: true
        },
        principal: {
            type: Boolean,
            default: false
        }
    }],
    stock: {
        type: Number,
        required: [true, 'Le stock est requis'],
        min: [0, 'Le stock ne peut pas être négatif'],
        default: 0
    },
    stockMinimum: {
        type: Number,
        default: 5,
        min: [0, 'Le stock minimum ne peut pas être négatif']
    },
    enPromotion: {
        type: Boolean,
        default: false,
        index: true
    },
    pourcentagePromotion: {
        type: Number,
        min: [0, 'Le pourcentage de promotion ne peut pas être négatif'],
        max: [100, 'Le pourcentage de promotion ne peut pas dépasser 100%'],
        default: 0,
        validate: {
            validator: function(v) {
                if (this.enPromotion && (!v || v === 0)) {
                    return false;
                }
                return true;
            },
            message: 'Le pourcentage de promotion est requis si le produit est en promotion'
        }
    },
    marque: {
        type: String,
        default: '',
        trim: true,
        maxlength: [100, 'La marque ne peut pas dépasser 100 caractères'],
        index: true
    },
    reference: {
        type: String,
        default: '',
        trim: true,
        unique: true,
        sparse: true,
        maxlength: [50, 'La référence ne peut pas dépasser 50 caractères']
    },
    codeBarres: {
        type: String,
        default: '',
        trim: true,
        unique: true,
        sparse: true,
        maxlength: [20, 'Le code-barres ne peut pas dépasser 20 caractères']
    },
    ingredients: {
        type: String,
        default: '',
        trim: true,
        maxlength: [1000, 'Les ingrédients ne peuvent pas dépasser 1000 caractères']
    },
    modeEmploi: {
        type: String,
        default: '',
        trim: true,
        maxlength: [1000, 'Le mode d\'emploi ne peut pas dépasser 1000 caractères']
    },
    precautions: {
        type: String,
        default: '',
        trim: true,
        maxlength: [1000, 'Les précautions ne peuvent pas dépasser 1000 caractères']
    },
    contenance: {
        valeur: {
            type: Number,
            default: null,
            min: [0, 'La contenance ne peut pas être négative']
        },
        unite: {
            type: String,
            enum: ['ml', 'g', 'l', 'kg', 'comprimés', 'gélules', 'doses', 'sachets', 'tubes', 'flacons'],
            default: null
        }
    },
    informationsNutritionnelles: [{
        nom: {
            type: String,
            required: true,
            trim: true
        },
        valeur: {
            type: String,
            required: true,
            trim: true
        },
        unite: {
            type: String,
            default: '',
            trim: true
        }
    }],
    enVedette: {
        type: Boolean,
        default: false,
        index: true
    },
    actif: {
        type: Boolean,
        default: true,
        index: true
    },
    dateAjout: {
        type: Date,
        default: Date.now,
        index: true
    },
    dateModification: {
        type: Date,
        default: Date.now
    },
    ajoutePar: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    modifiePar: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    tags: [{
        type: String,
        trim: true,
        lowercase: true
    }],
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
    certifications: [{
        type: String,
        enum: ['bio', 'halal', 'vegan', 'sans-gluten', 'sans-lactose', 'cruelty-free', 'naturel']
    }],
    ageMinimum: {
        type: Number,
        default: null,
        min: [0, 'L\'âge minimum ne peut pas être négatif']
    },
    conditionsStockage: {
        type: String,
        default: '',
        trim: true,
        maxlength: [200, 'Les conditions de stockage ne peuvent pas dépasser 200 caractères']
    },
    dureeValidite: {
        valeur: {
            type: Number,
            default: null,
            min: [1, 'La durée de validité doit être supérieure à 0']
        },
        unite: {
            type: String,
            enum: ['jours', 'mois', 'années'],
            default: null
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
            lowercase: true
        }
    },
    dimensionsEmballage: {
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
        },
        poids: {
            type: Number,
            default: null,
            min: [0, 'Le poids ne peut pas être négatif']
        }
    },
    statistiques: {
        vues: {
            type: Number,
            default: 0,
            min: [0, 'Le nombre de vues ne peut pas être négatif']
        },
        ventesTotales: {
            type: Number,
            default: 0,
            min: [0, 'Le nombre de ventes ne peut pas être négatif']
        },
        notemoyenne: {
            type: Number,
            default: 0,
            min: [0, 'La note moyenne ne peut pas être négative'],
            max: [5, 'La note moyenne ne peut pas dépasser 5']
        },
        nombreAvis: {
            type: Number,
            default: 0,
            min: [0, 'Le nombre d\'avis ne peut pas être négatif']
        }
    },
    seo: {
        titre: {
            type: String,
            default: '',
            trim: true,
            maxlength: [60, 'Le titre SEO ne peut pas dépasser 60 caractères']
        },
        description: {
            type: String,
            default: '',
            trim: true,
            maxlength: [160, 'La description SEO ne peut pas dépasser 160 caractères']
        },
        motsCles: [{
            type: String,
            trim: true,
            lowercase: true
        }]
    }
}, {
    timestamps: true
});

// Index pour les recherches fréquentes
ProductSchema.index({ nom: 'text', description: 'text', marque: 'text', tags: 'text' });
ProductSchema.index({ categorie: 1, actif: 1 });
ProductSchema.index({ enVedette: 1, actif: 1 });
ProductSchema.index({ enPromotion: 1, actif: 1 });
ProductSchema.index({ prix: 1 });
ProductSchema.index({ stock: 1 });
ProductSchema.index({ marque: 1, actif: 1 });
ProductSchema.index({ dateAjout: -1 });

// Index composé pour les recherches avancées
ProductSchema.index({ actif: 1, categorie: 1, prix: 1 });
ProductSchema.index({ actif: 1, enVedette: 1, dateAjout: -1 });

// Virtual pour vérifier si le produit est en rupture de stock
ProductSchema.virtual('enRuptureStock').get(function() {
    return this.stock === 0;
});

// Virtual pour vérifier si le stock est faible
ProductSchema.virtual('stockFaible').get(function() {
    return this.stock > 0 && this.stock <= this.stockMinimum;
});

// Virtual pour calculer le pourcentage d'économie
ProductSchema.virtual('economie').get(function() {
    if (this.prixOriginal && this.prixOriginal > this.prix) {
        return Math.round(((this.prixOriginal - this.prix) / this.prixOriginal) * 100);
    }
    return 0;
});

// Virtual pour générer l'URL de l'image principale
ProductSchema.virtual('imagePrincipale').get(function() {
    if (this.image) {
        return this.image;
    }
    
    const imagePrincipale = this.images.find(img => img.principal);
    if (imagePrincipale) {
        return imagePrincipale.url;
    }
    
    if (this.images.length > 0) {
        return this.images[0].url;
    }
    
    return '/images/placeholder.jpg';
});

// Virtual pour le statut du stock
ProductSchema.virtual('statutStock').get(function() {
    if (this.stock === 0) {
        return 'rupture';
    } else if (this.stock <= this.stockMinimum) {
        return 'faible';
    } else if (this.stock <= this.stockMinimum * 2) {
        return 'moyen';
    }
    return 'bon';
});

// Virtual pour générer le slug du produit
ProductSchema.virtual('slug').get(function() {
    return this.nom
        .toLowerCase()
        .replace(/[àáâãäå]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõö]/g, 'o')
        .replace(/[ùúûü]/g, 'u')
        .replace(/[ç]/g, 'c')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .trim('-');
});

// Pre-save middleware
ProductSchema.pre('save', function(next) {
    // Mettre à jour la date de modification
    this.dateModification = new Date();
    
    // Calculer automatiquement le pourcentage de promotion
    if (this.enPromotion && this.prixOriginal && this.prixOriginal > this.prix) {
        this.pourcentagePromotion = Math.round(((this.prixOriginal - this.prix) / this.prixOriginal) * 100);
    } else if (!this.enPromotion) {
        this.pourcentagePromotion = 0;
    }
    
    // Générer une référence automatique si elle n'existe pas
    if (!this.reference) {
        const categoriePrefixe = this.categorie.substring(0, 3).toUpperCase();
        const timestamp = Date.now().toString().slice(-6);
        this.reference = `${categoriePrefixe}-${timestamp}`;
    }
    
    // Générer des tags automatiques basés sur le nom et la catégorie
    if (this.tags.length === 0) {
        const autoTags = [
            this.categorie.toLowerCase(),
            ...this.nom.toLowerCase().split(' ').filter(word => word.length > 2)
        ];
        
        if (this.marque) {
            autoTags.push(this.marque.toLowerCase());
        }
        
        this.tags = [...new Set(autoTags)]; // Supprimer les doublons
    }
    
    // Générer automatiquement le contenu SEO si vide
    if (!this.seo.titre) {
        this.seo.titre = this.nom.length > 60 ? this.nom.substring(0, 57) + '...' : this.nom;
    }
    
    if (!this.seo.description) {
        const descCourte = this.description.replace(/(<([^>]+)>)/gi, "").substring(0, 157);
        this.seo.description = descCourte + (this.description.length > 157 ? '...' : '');
    }
    
    if (this.seo.motsCles.length === 0) {
        this.seo.motsCles = this.tags.slice(0, 5); // Prendre les 5 premiers tags
    }
    
    next();
});

// Méthodes d'instance
ProductSchema.methods.ajouterVue = function() {
    this.statistiques.vues += 1;
    return this.save();
};

ProductSchema.methods.mettreAJourStock = function(nouvelleQuantite, operation = 'set') {
    switch(operation) {
        case 'add':
            this.stock += nouvelleQuantite;
            break;
        case 'subtract':
            this.stock = Math.max(0, this.stock - nouvelleQuantite);
            break;
        case 'set':
        default:
            this.stock = Math.max(0, nouvelleQuantite);
            break;
    }
    
    return this.save();
};

ProductSchema.methods.ajouterVente = function(quantite = 1) {
    this.statistiques.ventesTotales += quantite;
    this.stock = Math.max(0, this.stock - quantite);
    return this.save();
};

ProductSchema.methods.mettreAJourNote = function(nouvelleNote) {
    const ancienTotal = this.statistiques.notemoyenne * this.statistiques.nombreAvis;
    this.statistiques.nombreAvis += 1;
    this.statistiques.notemoyenne = (ancienTotal + nouvelleNote) / this.statistiques.nombreAvis;
    this.statistiques.notemoyenne = Math.round(this.statistiques.notemoyenne * 100) / 100; // 2 décimales
    
    return this.save();
};

ProductSchema.methods.toggleVedette = function() {
    this.enVedette = !this.enVedette;
    return this.save();
};

ProductSchema.methods.togglePromotion = function(prixOriginal = null) {
    this.enPromotion = !this.enPromotion;
    if (this.enPromotion && prixOriginal) {
        this.prixOriginal = prixOriginal;
    } else if (!this.enPromotion) {
        this.prixOriginal = null;
        this.pourcentagePromotion = 0;
    }
    return this.save();
};

ProductSchema.methods.dupliquer = function(nouveauNom) {
    const produitDuplique = new this.constructor(this.toObject());
    produitDuplique._id = new mongoose.Types.ObjectId();
    produitDuplique.nom = nouveauNom || `${this.nom} - Copie`;
    produitDuplique.reference = ''; // Sera généré automatiquement
    produitDuplique.codeBarres = ''; // Doit être unique
    produitDuplique.dateAjout = new Date();
    produitDuplique.statistiques = {
        vues: 0,
        ventesTotales: 0,
        notemoyenne: 0,
        nombreAvis: 0
    };
    
    return produitDuplique.save();
};

// Méthodes statiques
ProductSchema.statics.rechercheAvancee = function(criteres, options = {}) {
    const query = {};
    
    // Recherche textuelle
    if (criteres.texte) {
        query.$text = { $search: criteres.texte };
    }
    
    // Filtres
    if (criteres.categorie && criteres.categorie !== 'all') {
        query.categorie = criteres.categorie;
    }
    
    if (criteres.marque && criteres.marque !== 'all') {
        query.marque = criteres.marque;
    }
    
    if (criteres.prixMin || criteres.prixMax) {
        query.prix = {};
        if (criteres.prixMin) query.prix.$gte = criteres.prixMin;
        if (criteres.prixMax) query.prix.$lte = criteres.prixMax;
    }
    
    if (criteres.enPromotion === true) {
        query.enPromotion = true;
    }
    
    if (criteres.enVedette === true) {
        query.enVedette = true;
    }
    
    if (criteres.disponible === true) {
        query.stock = { $gt: 0 };
    }
    
    if (criteres.certifications && criteres.certifications.length > 0) {
        query.certifications = { $in: criteres.certifications };
    }
    
    // Toujours filtrer les produits actifs sauf indication contraire
    if (criteres.inclureInactifs !== true) {
        query.actif = true;
    }
    
    // Options de tri
    let sort = { dateAjout: -1 }; // Par défaut: plus récent d'abord
    
    if (options.tri === 'prix-asc') {
        sort = { prix: 1 };
    } else if (options.tri === 'prix-desc') {
        sort = { prix: -1 };
    } else if (options.tri === 'nom-asc') {
        sort = { nom: 1 };
    } else if (options.tri === 'nom-desc') {
        sort = { nom: -1 };
    } else if (options.tri === 'popularite') {
        sort = { 'statistiques.ventesTotales': -1 };
    } else if (options.tri === 'note') {
        sort = { 'statistiques.notemoyenne': -1 };
    }
    
    const queryBuilder = this.find(query).sort(sort);
    
    // Pagination
    if (options.page && options.limite) {
        const skip = (options.page - 1) * options.limite;
        queryBuilder.skip(skip).limit(options.limite);
    }
    
    return queryBuilder;
};

ProductSchema.statics.getProduitsPopulaires = function(limite = 10) {
    return this.find({ actif: true })
               .sort({ 'statistiques.ventesTotales': -1, 'statistiques.vues': -1 })
               .limit(limite);
};

ProductSchema.statics.getProduitsEnVedette = function(limite = 10) {
    return this.find({ actif: true, enVedette: true })
               .sort({ dateAjout: -1 })
               .limit(limite);
};

ProductSchema.statics.getProduitsEnPromotion = function(limite = 10) {
    return this.find({ actif: true, enPromotion: true })
               .sort({ pourcentagePromotion: -1, dateAjout: -1 })
               .limit(limite);
};

ProductSchema.statics.getProduitsStockFaible = function() {
    return this.find({
        actif: true,
        $expr: { $lte: ['$stock', '$stockMinimum'] },
        stock: { $gt: 0 }
    }).sort({ stock: 1 });
};

ProductSchema.statics.getProduitsRupture = function() {
    return this.find({ actif: true, stock: 0 })
               .sort({ dateModification: -1 });
};

ProductSchema.statics.getStatistiquesStock = function() {
    return this.aggregate([
        { $match: { actif: true } },
        {
            $group: {
                _id: null,
                totalProduits: { $sum: 1 },
                stockTotal: { $sum: '$stock' },
                produitsEnRupture: {
                    $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] }
                },
                produitsStockFaible: {
                    $sum: { $cond: [{ $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$stockMinimum'] }] }, 1, 0] }
                },
                valeurStock: { $sum: { $multiply: ['$prix', '$stock'] } }
            }
        }
    ]);
};

ProductSchema.statics.getMarques = function() {
    return this.distinct('marque', { actif: true, marque: { $ne: '' } });
};

ProductSchema.statics.getCertifications = function() {
    return this.distinct('certifications', { actif: true });
};

// Assurer que les virtuals sont inclus lors de la sérialisation
ProductSchema.set('toJSON', { virtuals: true });
ProductSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', ProductSchema);
