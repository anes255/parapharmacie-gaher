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
            default: '',
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
            default: '',
            trim: true
        }
    },
    remise: {
        type: {
            type: String,
            enum: ['pourcentage', 'montant'],
            required: false
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
        }
    }
}, {
    timestamps: true
});

// Index pour les recherches fréquentes
OrderSchema.index({ numeroCommande: 1 });
OrderSchema.index({ 'client.email': 1 });
OrderSchema.index({ 'client.userId': 1 });
OrderSchema.index({ statut: 1 });
OrderSchema.index({ dateCommande: -1 });
OrderSchema.index({ 'client.telephone': 1 });

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
    return ['en-attente', 'confirmée'].includes(this.statut);
});

// Pre-save middleware pour calculer automatiquement les totaux
OrderSchema.pre('save', function(next) {
    // Calculer le sous-total si ce n'est pas déjà fait
    if (this.articles && this.articles.length > 0) {
        this.sousTotal = this.articles.reduce((total, article) => {
            return total + (article.prix * article.quantite);
        }, 0);
        
        // Calculer le total
        this.total = this.sousTotal + (this.fraisLivraison || 0);
        
        // Appliquer la remise si applicable
        if (this.remise && this.remise.type && this.remise.valeur > 0) {
            if (this.remise.type === 'pourcentage') {
                const reduction = this.sousTotal * (this.remise.valeur / 100);
                this.total = Math.max(0, this.total - reduction);
            } else if (this.remise.type === 'montant') {
                this.total = Math.max(0, this.total - this.remise.valeur);
            }
        }
        
        // Arrondir à 2 décimales
        this.sousTotal = Math.round(this.sousTotal * 100) / 100;
        this.total = Math.round(this.total * 100) / 100;
    }
    
    next();
});

// Pre-save middleware pour gérer l'historique des statuts
OrderSchema.pre('save', function(next) {
    if (this.isModified('statut')) {
        // Ajouter à l'historique
        this.historiqueStatut.push({
            statut: this.statut,
            date: new Date(),
            modifiePar: null, // Sera défini par le contrôleur si nécessaire
            commentaire: `Statut changé vers: ${this.statut}`
        });
        
        // Mettre à jour les dates automatiquement
        switch (this.statut) {
            case 'confirmée':
                this.dateConfirmation = new Date();
                break;
            case 'expédiée':
                this.dateExpedition = new Date();
                break;
            case 'livrée':
                this.dateLivraison = new Date();
                this.statutPaiement = 'payé'; // Automatiquement payé à la livraison
                break;
        }
    }
    
    next();
});

// Méthodes d'instance
OrderSchema.methods.changerStatut = function(nouveauStatut, utilisateur = null, commentaire = '') {
    const anciensStatut = this.statut;
    this.statut = nouveauStatut;
    
    // L'historique sera géré par le pre-save hook
    if (commentaire) {
        this.historiqueStatut[this.historiqueStatut.length - 1].commentaire = commentaire;
    }
    if (utilisateur) {
        this.historiqueStatut[this.historiqueStatut.length - 1].modifiePar = utilisateur;
    }
    
    return this.save();
};

OrderSchema.methods.calculerTotal = function() {
    this.sousTotal = this.articles.reduce((total, article) => {
        return total + (article.prix * article.quantite);
    }, 0);
    
    this.total = this.sousTotal + (this.fraisLivraison || 0);
    
    // Appliquer la remise
    if (this.remise && this.remise.type && this.remise.valeur > 0) {
        if (this.remise.type === 'pourcentage') {
            const reduction = this.sousTotal * (this.remise.valeur / 100);
            this.total = Math.max(0, this.total - reduction);
        } else if (this.remise.type === 'montant') {
            this.total = Math.max(0, this.total - this.remise.valeur);
        }
    }
    
    return this.total;
};

// Méthodes statiques
OrderSchema.statics.genererNumeroCommande = function() {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `CMD${timestamp.slice(-8)}${random}`;
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
                totalMontant: { $sum: '$total' }
            }
        }
    ]);
};

// Assurer que les virtuals sont inclus lors de la sérialisation
OrderSchema.set('toJSON', { virtuals: true });
OrderSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Order', OrderSchema);
