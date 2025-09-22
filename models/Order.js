const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    numeroCommande: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    client: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        prenom: {
            type: String,
            required: true,
            trim: true
        },
        nom: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Format d\'email invalide']
        },
        telephone: {
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
            default: '',
            trim: true
        },
        wilaya: {
            type: String,
            required: true,
            trim: true
        },
        codePostal: {
            type: String,
            default: '',
            trim: true
        }
    },
    articles: [{
        productId: {
            type: String,
            required: true
        },
        nom: {
            type: String,
            required: true,
            trim: true
        },
        prix: {
            type: Number,
            required: true,
            min: 0
        },
        quantite: {
            type: Number,
            required: true,
            min: 1
        },
        image: {
            type: String,
            default: ''
        },
        categorie: {
            type: String,
            default: ''
        },
        sousTotal: {
            type: Number,
            default: function() {
                return this.prix * this.quantite;
            }
        }
    }],
    sousTotal: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    fraisLivraison: {
        type: Number,
        default: 0,
        min: 0
    },
    total: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    statut: {
        type: String,
        enum: [
            'en-attente',
            'confirmée', 
            'préparée',
            'expédiée',
            'livrée',
            'annulée'
        ],
        default: 'en-attente'
    },
    modePaiement: {
        type: String,
        enum: [
            'Paiement à la livraison',
            'Carte bancaire',
            'Virement bancaire',
            'PayPal'
        ],
        default: 'Paiement à la livraison'
    },
    statutPaiement: {
        type: String,
        enum: [
            'en-attente',
            'payé',
            'échec',
            'remboursé'
        ],
        default: 'en-attente'
    },
    dateCommande: {
        type: Date,
        default: Date.now,
        required: true
    },
    dateConfirmation: {
        type: Date,
        default: null
    },
    dateExpedition: {
        type: Date,
        default: null
    },
    dateLivraison: {
        type: Date,
        default: null
    },
    commentaires: {
        type: String,
        default: '',
        trim: true,
        maxlength: 500
    },
    notesAdmin: {
        type: String,
        default: '',
        trim: true,
        maxlength: 1000
    },
    historiqueStatut: [{
        statut: {
            type: String,
            required: true
        },
        date: {
            type: Date,
            default: Date.now
        },
        modifiePar: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        commentaire: {
            type: String,
            default: '',
            maxlength: 200
        }
    }],
    informationsLivraison: {
        transporteur: {
            type: String,
            default: 'Shifa Livraison',
            trim: true
        },
        numeroSuivi: {
            type: String,
            default: '',
            trim: true
        },
        fraisLivraisonReel: {
            type: Number,
            default: null,
            min: 0
        },
        delaiEstime: {
            type: String,
            default: '2-5 jours ouvrables',
            trim: true
        },
        adresseLivraison: {
            type: String,
            default: '',
            trim: true
        },
        instructionsLivraison: {
            type: String,
            default: '',
            trim: true,
            maxlength: 200
        }
    },
    remise: {
        type: {
            type: String,
            enum: ['pourcentage', 'montant'],
            default: null
        },
        valeur: {
            type: Number,
            default: 0,
            min: 0
        },
        codePromo: {
            type: String,
            default: '',
            trim: true
        },
        description: {
            type: String,
            default: '',
            trim: true
        }
    },
    evaluation: {
        note: {
            type: Number,
            min: 1,
            max: 5,
            default: null
        },
        commentaire: {
            type: String,
            default: '',
            trim: true,
            maxlength: 500
        },
        dateEvaluation: {
            type: Date,
            default: null
        }
    },
    source: {
        type: String,
        enum: ['site-web', 'telephone', 'whatsapp', 'facebook', 'instagram'],
        default: 'site-web'
    },
    metadata: {
        ipAddress: {
            type: String,
            default: ''
        },
        userAgent: {
            type: String,
            default: ''
        },
        referrer: {
            type: String,
            default: ''
        }
    }
}, {
    timestamps: true
});

// Index pour les recherches fréquentes
OrderSchema.index({ numeroCommande: 1 });
OrderSchema.index({ 'client.email': 1 });
OrderSchema.index({ 'client.userId': 1 });
OrderSchema.index({ 'client.telephone': 1 });
OrderSchema.index({ statut: 1 });
OrderSchema.index({ dateCommande: -1 });
OrderSchema.index({ 'client.wilaya': 1 });
OrderSchema.index({ total: -1 });

// Index composé pour les recherches admin
OrderSchema.index({ statut: 1, dateCommande: -1 });
OrderSchema.index({ 'client.email': 1, statut: 1 });

// Virtual pour calculer le nombre total d'articles
OrderSchema.virtual('totalArticles').get(function() {
    return this.articles.reduce((total, article) => total + article.quantite, 0);
});

// Virtual pour vérifier si la commande est modifiable
OrderSchema.virtual('estModifiable').get(function() {
    return ['en-attente', 'confirmée'].includes(this.statut);
});

// Virtual pour vérifier si la commande peut être annulée
OrderSchema.virtual('peutEtreAnnulee').get(function() {
    return ['en-attente', 'confirmée', 'préparée'].includes(this.statut);
});

// Virtual pour calculer les économies (si remise appliquée)
OrderSchema.virtual('economiesRealisees').get(function() {
    if (!this.remise || this.remise.valeur === 0) return 0;
    
    if (this.remise.type === 'pourcentage') {
        return Math.round(this.sousTotal * (this.remise.valeur / 100));
    } else if (this.remise.type === 'montant') {
        return this.remise.valeur;
    }
    
    return 0;
});

// Virtual pour le délai de livraison estimé
OrderSchema.virtual('delaiLivraisonEstime').get(function() {
    if (this.statut === 'livrée') {
        return 'Livré';
    } else if (this.statut === 'expédiée') {
        return this.informationsLivraison?.delaiEstime || '1-3 jours';
    } else if (this.statut === 'préparée') {
        return 'Prêt à expédier';
    } else if (this.statut === 'confirmée') {
        return '1-2 jours de préparation';
    }
    return 'En attente de confirmation';
});

// Pre-save middleware pour calculer automatiquement les totaux
OrderSchema.pre('save', function(next) {
    // Calculer le sous-total si ce n'est pas déjà fait
    if (this.articles && this.articles.length > 0) {
        this.sousTotal = this.articles.reduce((total, article) => {
            // S'assurer que le sousTotal de chaque article est correct
            article.sousTotal = article.prix * article.quantite;
            return total + article.sousTotal;
        }, 0);
        
        // Calculer le total avant remise
        let totalAvantRemise = this.sousTotal + (this.fraisLivraison || 0);
        
        // Appliquer la remise si applicable
        let montantRemise = 0;
        if (this.remise && this.remise.valeur > 0) {
            if (this.remise.type === 'pourcentage') {
                montantRemise = this.sousTotal * (this.remise.valeur / 100);
            } else if (this.remise.type === 'montant') {
                montantRemise = this.remise.valeur;
            }
        }
        
        // Calculer le total final
        this.total = Math.max(0, totalAvantRemise - montantRemise);
        
        // Arrondir à l'entier le plus proche (DA)
        this.sousTotal = Math.round(this.sousTotal);
        this.total = Math.round(this.total);
    }
    
    next();
});

// Pre-save middleware pour gérer l'historique des statuts
OrderSchema.pre('save', function(next) {
    if (this.isModified('statut')) {
        // Ajouter à l'historique seulement si c'est un nouveau statut
        const dernierStatut = this.historiqueStatut[this.historiqueStatut.length - 1];
        if (!dernierStatut || dernierStatut.statut !== this.statut) {
            this.historiqueStatut.push({
                statut: this.statut,
                date: new Date(),
                commentaire: `Commande ${this.statut}`
            });
        }
        
        // Mettre à jour les dates automatiquement
        switch (this.statut) {
            case 'confirmée':
                if (!this.dateConfirmation) {
                    this.dateConfirmation = new Date();
                }
                break;
            case 'expédiée':
                if (!this.dateExpedition) {
                    this.dateExpedition = new Date();
                }
                break;
            case 'livrée':
                if (!this.dateLivraison) {
                    this.dateLivraison = new Date();
                }
                // Automatiquement marquer comme payé si paiement à la livraison
                if (this.modePaiement === 'Paiement à la livraison') {
                    this.statutPaiement = 'payé';
                }
                break;
        }
    }
    
    next();
});

// Méthodes d'instance
OrderSchema.methods.changerStatut = function(nouveauStatut, utilisateur = null, commentaire = '') {
    const ancienStatut = this.statut;
    this.statut = nouveauStatut;
    
    // Ajouter une entrée personnalisée à l'historique
    this.historiqueStatut.push({
        statut: nouveauStatut,
        date: new Date(),
        modifiePar: utilisateur,
        commentaire: commentaire || `Statut changé de ${ancienStatut} vers ${nouveauStatut}`
    });
    
    return this.save();
};

OrderSchema.methods.calculerTotal = function() {
    this.sousTotal = this.articles.reduce((total, article) => {
        return total + (article.prix * article.quantite);
    }, 0);
    
    let totalAvantRemise = this.sousTotal + (this.fraisLivraison || 0);
    
    // Appliquer la remise
    let montantRemise = 0;
    if (this.remise && this.remise.valeur > 0) {
        if (this.remise.type === 'pourcentage') {
            montantRemise = this.sousTotal * (this.remise.valeur / 100);
        } else if (this.remise.type === 'montant') {
            montantRemise = this.remise.valeur;
        }
    }
    
    this.total = Math.max(0, totalAvantRemise - montantRemise);
    
    return this.total;
};

OrderSchema.methods.ajouterNote = function(note, commentaire = '') {
    this.evaluation = {
        note: note,
        commentaire: commentaire,
        dateEvaluation: new Date()
    };
    
    return this.save();
};

OrderSchema.methods.appliquerRemise = function(typeRemise, valeurRemise, codePromo = '', description = '') {
    this.remise = {
        type: typeRemise,
        valeur: valeurRemise,
        codePromo: codePromo,
        description: description
    };
    
    // Recalculer le total
    this.calculerTotal();
    
    return this.save();
};

// Méthodes statiques
OrderSchema.statics.genererNumeroCommande = function() {
    const prefix = 'SFA'; // Shifa
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}${timestamp.slice(-8)}${random}`;
};

OrderSchema.statics.getStatistiquesParPeriode = function(dateDebut, dateFin) {
    return this.aggregate([
        {
            $match: {
                dateCommande: {
                    $gte: dateDebut,
                    $lte: dateFin
                }
            }
        },
        {
            $group: {
                _id: '$statut',
                count: { $sum: 1 },
                totalMontant: { $sum: '$total' },
                moyennePanier: { $avg: '$total' }
            }
        }
    ]);
};

OrderSchema.statics.getVentesProduits = function(dateDebut, dateFin) {
    return this.aggregate([
        {
            $match: {
                dateCommande: {
                    $gte: dateDebut,
                    $lte: dateFin
                },
                statut: { $in: ['confirmée', 'préparée', 'expédiée', 'livrée'] }
            }
        },
        {
            $unwind: '$articles'
        },
        {
            $group: {
                _id: '$articles.productId',
                nom: { $first: '$articles.nom' },
                totalVendu: { $sum: '$articles.quantite' },
                chiffreAffaires: { $sum: '$articles.sousTotal' }
            }
        },
        {
            $sort: { totalVendu: -1 }
        }
    ]);
};

OrderSchema.statics.getStatistiquesWilaya = function(dateDebut, dateFin) {
    return this.aggregate([
        {
            $match: {
                dateCommande: {
                    $gte: dateDebut,
                    $lte: dateFin
                }
            }
        },
        {
            $group: {
                _id: '$client.wilaya',
                totalCommandes: { $sum: 1 },
                chiffreAffaires: { $sum: '$total' },
                moyennePanier: { $avg: '$total' }
            }
        },
        {
            $sort: { totalCommandes: -1 }
        }
    ]);
};

// Méthode pour recherche avancée
OrderSchema.statics.rechercheAvancee = function(criteres) {
    const query = {};
    
    if (criteres.numeroCommande) {
        query.numeroCommande = new RegExp(criteres.numeroCommande, 'i');
    }
    
    if (criteres.email) {
        query['client.email'] = new RegExp(criteres.email, 'i');
    }
    
    if (criteres.telephone) {
        query['client.telephone'] = new RegExp(criteres.telephone, 'i');
    }
    
    if (criteres.statut) {
        query.statut = criteres.statut;
    }
    
    if (criteres.wilaya) {
        query['client.wilaya'] = criteres.wilaya;
    }
    
    if (criteres.dateDebut || criteres.dateFin) {
        query.dateCommande = {};
        if (criteres.dateDebut) {
            query.dateCommande.$gte = criteres.dateDebut;
        }
        if (criteres.dateFin) {
            query.dateCommande.$lte = criteres.dateFin;
        }
    }
    
    if (criteres.montantMin || criteres.montantMax) {
        query.total = {};
        if (criteres.montantMin) {
            query.total.$gte = criteres.montantMin;
        }
        if (criteres.montantMax) {
            query.total.$lte = criteres.montantMax;
        }
    }
    
    return this.find(query)
               .sort({ dateCommande: -1 })
               .populate('client.userId', 'nom prenom email');
};

// Assurer que les virtuals sont inclus lors de la sérialisation
OrderSchema.set('toJSON', { virtuals: true });
OrderSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Order', OrderSchema);
