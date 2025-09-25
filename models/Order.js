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
            required: [true, 'Le prénom du client est requis'],
            trim: true
        },
        nom: {
            type: String,
            required: [true, 'Le nom du client est requis'],
            trim: true
        },
        email: {
            type: String,
            required: [true, 'L\'email du client est requis'],
            lowercase: true,
            trim: true,
            match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Format d\'email invalide']
        },
        telephone: {
            type: String,
            required: [true, 'Le téléphone du client est requis'],
            trim: true
        },
        adresse: {
            type: String,
            required: [true, 'L\'adresse du client est requise'],
            trim: true,
            minlength: [10, 'L\'adresse doit contenir au moins 10 caractères']
        },
        wilaya: {
            type: String,
            required: [true, 'La wilaya est requise'],
            trim: true
        }
    },
    articles: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
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
            min: [0, 'Le prix ne peut pas être négatif']
        },
        quantite: {
            type: Number,
            required: true,
            min: [1, 'La quantité doit être au moins 1']
        },
        image: {
            type: String,
            default: ''
        }
    }],
    sousTotal: {
        type: Number,
        required: true,
        min: [0, 'Le sous-total ne peut pas être négatif']
    },
    fraisLivraison: {
        type: Number,
        required: true,
        min: [0, 'Les frais de livraison ne peuvent pas être négatifs'],
        default: 0
    },
    total: {
        type: Number,
        required: true,
        min: [0, 'Le total ne peut pas être négatif']
    },
    statut: {
        type: String,
        required: true,
        enum: {
            values: ['en-attente', 'confirmée', 'préparée', 'expédiée', 'livrée', 'annulée'],
            message: '{VALUE} n\'est pas un statut valide'
        },
        default: 'en-attente'
    },
    modePaiement: {
        type: String,
        required: true,
        enum: {
            values: ['Paiement à la livraison', 'Carte bancaire', 'Virement bancaire'],
            message: '{VALUE} n\'est pas un mode de paiement valide'
        },
        default: 'Paiement à la livraison'
    },
    commentaires: {
        type: String,
        default: '',
        maxlength: [500, 'Les commentaires ne peuvent pas dépasser 500 caractères']
    },
    dateCommande: {
        type: Date,
        required: true,
        default: Date.now
    },
    dateLivraison: {
        type: Date,
        default: null
    },
    dateAnnulation: {
        type: Date,
        default: null
    },
    raisonAnnulation: {
        type: String,
        default: ''
    },
    historiqueStatut: [{
        statut: {
            type: String,
            required: true
        },
        date: {
            type: Date,
            required: true,
            default: Date.now
        },
        commentaire: {
            type: String,
            default: ''
        }
    }],
    tracking: {
        numeroSuivi: {
            type: String,
            default: ''
        },
        transporteur: {
            type: String,
            default: ''
        }
    },
    notes: {
        type: String,
        default: ''
    },
    actif: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Index pour améliorer les performances
OrderSchema.index({ numeroCommande: 1 });
OrderSchema.index({ 'client.email': 1 });
OrderSchema.index({ 'client.userId': 1 });
OrderSchema.index({ statut: 1 });
OrderSchema.index({ dateCommande: -1 });
OrderSchema.index({ dateLivraison: 1 });

// Virtual pour calculer le nombre total d'articles
OrderSchema.virtual('totalArticles').get(function() {
    return this.articles.reduce((total, article) => total + article.quantite, 0);
});

// Virtual pour le nom complet du client
OrderSchema.virtual('client.nomComplet').get(function() {
    return `${this.client.prenom} ${this.client.nom}`;
});

// Middleware pour ajouter l'historique de statut lors des modifications
OrderSchema.pre('save', function(next) {
    if (this.isModified('statut') && !this.isNew) {
        this.historiqueStatut.push({
            statut: this.statut,
            date: new Date(),
            commentaire: `Statut changé vers: ${this.statut}`
        });
        
        // Mettre à jour les dates selon le statut
        if (this.statut === 'livrée' && !this.dateLivraison) {
            this.dateLivraison = new Date();
        } else if (this.statut === 'annulée' && !this.dateAnnulation) {
            this.dateAnnulation = new Date();
        }
    }
    
    // Ajouter l'historique initial pour une nouvelle commande
    if (this.isNew) {
        this.historiqueStatut.push({
            statut: this.statut,
            date: this.dateCommande,
            commentaire: 'Commande créée'
        });
    }
    
    next();
});

// Méthode pour changer le statut avec commentaire
OrderSchema.methods.changerStatut = function(nouveauStatut, commentaire = '') {
    const statutsValides = ['en-attente', 'confirmée', 'préparée', 'expédiée', 'livrée', 'annulée'];
    
    if (!statutsValides.includes(nouveauStatut)) {
        throw new Error('Statut invalide');
    }
    
    this.statut = nouveauStatut;
    
    // Ajouter à l'historique
    this.historiqueStatut.push({
        statut: nouveauStatut,
        date: new Date(),
        commentaire: commentaire || `Statut changé vers: ${nouveauStatut}`
    });
    
    // Mettre à jour les dates
    if (nouveauStatut === 'livrée') {
        this.dateLivraison = new Date();
    } else if (nouveauStatut === 'annulée') {
        this.dateAnnulation = new Date();
        this.raisonAnnulation = commentaire;
    }
    
    return this.save();
};

// Méthode pour calculer les délais
OrderSchema.methods.calculerDelais = function() {
    const maintenant = new Date();
    const delaiDepuisCommande = Math.floor((maintenant - this.dateCommande) / (1000 * 60 * 60 * 24));
    
    let delaiLivraison = null;
    if (this.dateLivraison) {
        delaiLivraison = Math.floor((this.dateLivraison - this.dateCommande) / (1000 * 60 * 60 * 24));
    }
    
    return {
        delaiDepuisCommande,
        delaiLivraison,
        enRetard: delaiDepuisCommande > 7 && this.statut !== 'livrée' && this.statut !== 'annulée'
    };
};

// Méthode statique pour obtenir les statistiques
OrderSchema.statics.obtenirStatistiques = async function(periode = 30) {
    const dateDebut = new Date();
    dateDebut.setDate(dateDebut.getDate() - periode);
    
    const pipeline = [
        {
            $match: {
                dateCommande: { $gte: dateDebut },
                actif: true
            }
        },
        {
            $group: {
                _id: null,
                totalCommandes: { $sum: 1 },
                chiffreAffaires: { $sum: '$total' },
                panierMoyen: { $avg: '$total' },
                commandesEnAttente: {
                    $sum: { $cond: [{ $eq: ['$statut', 'en-attente'] }, 1, 0] }
                },
                commandesLivrees: {
                    $sum: { $cond: [{ $eq: ['$statut', 'livrée'] }, 1, 0] }
                }
            }
        }
    ];
    
    const result = await this.aggregate(pipeline);
    return result[0] || {
        totalCommandes: 0,
        chiffreAffaires: 0,
        panierMoyen: 0,
        commandesEnAttente: 0,
        commandesLivrees: 0
    };
};

// Méthode statique pour rechercher des commandes
OrderSchema.statics.rechercher = function(criteres = {}) {
    let query = this.find({ actif: true });
    
    // Recherche par numéro de commande
    if (criteres.numeroCommande) {
        query = query.where('numeroCommande').regex(new RegExp(criteres.numeroCommande, 'i'));
    }
    
    // Recherche par email client
    if (criteres.emailClient) {
        query = query.where('client.email').regex(new RegExp(criteres.emailClient, 'i'));
    }
    
    // Filtrage par statut
    if (criteres.statut) {
        query = query.where('statut').equals(criteres.statut);
    }
    
    // Filtrage par période
    if (criteres.dateDebut) {
        query = query.where('dateCommande').gte(criteres.dateDebut);
    }
    
    if (criteres.dateFin) {
        query = query.where('dateCommande').lte(criteres.dateFin);
    }
    
    // Filtrage par montant
    if (criteres.montantMin) {
        query = query.where('total').gte(criteres.montantMin);
    }
    
    if (criteres.montantMax) {
        query = query.where('total').lte(criteres.montantMax);
    }
    
    return query.sort({ dateCommande: -1 });
};

module.exports = mongoose.model('Order', OrderSchema);
