const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    numeroCommande: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    utilisateur: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    client: {
        nom: {
            type: String,
            required: true,
            trim: true
        },
        prenom: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true
        },
        telephone: {
            type: String,
            required: true,
            trim: true
        },
        adresse: {
            type: String,
            default: '',
            trim: true
        },
        ville: {
            type: String,
            default: '',
            trim: true
        },
        wilaya: {
            type: String,
            default: '',
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
        }
    }],
    sousTotal: {
        type: Number,
        required: true,
        min: 0
    },
    fraisLivraison: {
        type: Number,
        default: 0,
        min: 0
    },
    total: {
        type: Number,
        required: true,
        min: 0
    },
    statut: {
        type: String,
        enum: ['en-attente', 'confirmée', 'préparée', 'expédiée', 'livrée', 'annulée'],
        default: 'en-attente'
    },
    modePaiement: {
        type: String,
        enum: [
            'Paiement à la livraison',
            'Carte bancaire',
            'Virement bancaire',
            'Mobile Money',
            'Espèces'
        ],
        default: 'Paiement à la livraison'
    },
    statutPaiement: {
        type: String,
        enum: ['en-attente', 'payé', 'échoué', 'remboursé'],
        default: 'en-attente'
    },
    dateCommande: {
        type: Date,
        default: Date.now
    },
    dateConfirmation: {
        type: Date,
        default: null
    },
    datePreparation: {
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
    dateAnnulation: {
        type: Date,
        default: null
    },
    commentaires: {
        type: String,
        default: '',
        trim: true,
        maxlength: 1000
    },
    commentairesAdmin: {
        type: String,
        default: '',
        trim: true,
        maxlength: 1000
    },
    adresseLivraison: {
        type: String,
        default: '',
        trim: true
    },
    transporteur: {
        nom: {
            type: String,
            default: '',
            trim: true
        },
        numeroSuivi: {
            type: String,
            default: '',
            trim: true
        }
    },
    codePromo: {
        code: {
            type: String,
            default: '',
            trim: true
        },
        reduction: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    factureUrl: {
        type: String,
        default: ''
    },
    historique: [{
        statut: {
            type: String,
            required: true
        },
        date: {
            type: Date,
            default: Date.now
        },
        commentaire: {
            type: String,
            default: '',
            trim: true
        },
        utilisateur: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        }
    }]
}, {
    timestamps: true
});

// Index pour améliorer les performances de recherche
OrderSchema.index({ numeroCommande: 1 });
OrderSchema.index({ 'client.email': 1 });
OrderSchema.index({ utilisateur: 1 });
OrderSchema.index({ statut: 1 });
OrderSchema.index({ dateCommande: -1 });

// Middleware pour ajouter automatiquement à l'historique lors des changements de statut
OrderSchema.pre('save', function(next) {
    if (this.isModified('statut') && !this.isNew) {
        this.historique.push({
            statut: this.statut,
            date: new Date(),
            commentaire: `Statut changé vers: ${this.statut}`
        });
        
        // Mettre à jour les dates selon le statut
        switch (this.statut) {
            case 'confirmée':
                if (!this.dateConfirmation) this.dateConfirmation = new Date();
                break;
            case 'préparée':
                if (!this.datePreparation) this.datePreparation = new Date();
                break;
            case 'expédiée':
                if (!this.dateExpedition) this.dateExpedition = new Date();
                break;
            case 'livrée':
                if (!this.dateLivraison) this.dateLivraison = new Date();
                this.statutPaiement = 'payé'; // Automatiquement payé quand livré
                break;
            case 'annulée':
                if (!this.dateAnnulation) this.dateAnnulation = new Date();
                this.statutPaiement = 'remboursé';
                break;
        }
    }
    next();
});

// Méthode pour calculer le temps de traitement
OrderSchema.methods.getProcessingTime = function() {
    if (!this.dateLivraison) return null;
    
    const diffTime = Math.abs(this.dateLivraison - this.dateCommande);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
};

// Méthode pour obtenir le statut formaté
OrderSchema.methods.getFormattedStatus = function() {
    const statusMap = {
        'en-attente': 'En attente',
        'confirmée': 'Confirmée',
        'préparée': 'Préparée',
        'expédiée': 'Expédiée',
        'livrée': 'Livrée',
        'annulée': 'Annulée'
    };
    return statusMap[this.statut] || this.statut;
};

// Méthode pour vérifier si la commande peut être annulée
OrderSchema.methods.canBeCancelled = function() {
    return ['en-attente', 'confirmée'].includes(this.statut);
};

// Méthode pour vérifier si la commande peut être modifiée
OrderSchema.methods.canBeModified = function() {
    return ['en-attente', 'confirmée'].includes(this.statut);
};

// Méthode statique pour obtenir les statistiques des commandes
OrderSchema.statics.getOrderStats = async function(dateDebut, dateFin) {
    const matchStage = {};
    
    if (dateDebut || dateFin) {
        matchStage.dateCommande = {};
        if (dateDebut) matchStage.dateCommande.$gte = new Date(dateDebut);
        if (dateFin) matchStage.dateCommande.$lte = new Date(dateFin);
    }
    
    const stats = await this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                totalCommandes: { $sum: 1 },
                totalVentes: { $sum: '$total' },
                commandesEnAttente: {
                    $sum: { $cond: [{ $eq: ['$statut', 'en-attente'] }, 1, 0] }
                },
                commandesConfirmees: {
                    $sum: { $cond: [{ $eq: ['$statut', 'confirmée'] }, 1, 0] }
                },
                commandesLivrees: {
                    $sum: { $cond: [{ $eq: ['$statut', 'livrée'] }, 1, 0] }
                },
                commandesAnnulees: {
                    $sum: { $cond: [{ $eq: ['$statut', 'annulée'] }, 1, 0] }
                },
                panierMoyen: { $avg: '$total' },
                totalArticles: { $sum: { $size: '$articles' } }
            }
        }
    ]);
    
    return stats[0] || {
        totalCommandes: 0,
        totalVentes: 0,
        commandesEnAttente: 0,
        commandesConfirmees: 0,
        commandesLivrees: 0,
        commandesAnnulees: 0,
        panierMoyen: 0,
        totalArticles: 0
    };
};

// Méthode statique pour obtenir les commandes par période
OrderSchema.statics.getOrdersByPeriod = async function(periode = 'month') {
    let groupBy;
    
    switch (periode) {
        case 'day':
            groupBy = {
                year: { $year: '$dateCommande' },
                month: { $month: '$dateCommande' },
                day: { $dayOfMonth: '$dateCommande' }
            };
            break;
        case 'week':
            groupBy = {
                year: { $year: '$dateCommande' },
                week: { $week: '$dateCommande' }
            };
            break;
        case 'year':
            groupBy = {
                year: { $year: '$dateCommande' }
            };
            break;
        default: // month
            groupBy = {
                year: { $year: '$dateCommande' },
                month: { $month: '$dateCommande' }
            };
    }
    
    return await this.aggregate([
        {
            $group: {
                _id: groupBy,
                commandes: { $sum: 1 },
                ventes: { $sum: '$total' },
                articles: { $sum: { $size: '$articles' } }
            }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } }
    ]);
};

// Méthode statique pour obtenir les produits les plus vendus
OrderSchema.statics.getTopSellingProducts = async function(limit = 10) {
    return await this.aggregate([
        { $unwind: '$articles' },
        {
            $group: {
                _id: '$articles.productId',
                nom: { $first: '$articles.nom' },
                totalVendu: { $sum: '$articles.quantite' },
                chiffreAffaires: { $sum: { $multiply: ['$articles.prix', '$articles.quantite'] } },
                nombreCommandes: { $sum: 1 }
            }
        },
        { $sort: { totalVendu: -1 } },
        { $limit: limit }
    ]);
};

// Virtual pour le nom complet du client
OrderSchema.virtual('client.nomComplet').get(function() {
    return `${this.client.prenom} ${this.client.nom}`;
});

// Virtual pour l'adresse complète du client
OrderSchema.virtual('client.adresseComplete').get(function() {
    const parts = [
        this.client.adresse,
        this.client.ville,
        this.client.wilaya,
        this.client.codePostal
    ].filter(part => part && part.trim() !== '');
    
    return parts.join(', ');
});

// Configuration pour inclure les virtuals lors de la conversion en JSON
OrderSchema.set('toJSON', { virtuals: true });
OrderSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Order', OrderSchema);
