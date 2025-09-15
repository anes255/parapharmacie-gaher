const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    numeroCommande: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    client: {
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
            trim: true,
            lowercase: true
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
        wilaya: {
            type: String,
            required: true,
            trim: true
        },
        commentaires: {
            type: String,
            default: '',
            trim: true
        }
    },
    articles: [{
        id: {
            type: String,
            required: true
        },
        nom: {
            type: String,
            required: true
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
        required: true,
        min: 0,
        default: 300
    },
    total: {
        type: Number,
        required: true,
        min: 0
    },
    statut: {
        type: String,
        required: true,
        enum: ['en-attente', 'confirmée', 'préparée', 'expédiée', 'livrée', 'annulée'],
        default: 'en-attente'
    },
    modePaiement: {
        type: String,
        required: true,
        enum: ['Paiement à la livraison', 'Carte bancaire', 'Virement'],
        default: 'Paiement à la livraison'
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
        trim: true
    },
    noteInterne: {
        type: String,
        default: '',
        trim: true
    }
}, {
    timestamps: true
});

// Index pour la recherche et optimisation
OrderSchema.index({ numeroCommande: 1 });
OrderSchema.index({ 'client.email': 1 });
OrderSchema.index({ statut: 1 });
OrderSchema.index({ dateCommande: -1 });

// Méthode pour calculer le total automatiquement
OrderSchema.pre('save', function(next) {
    this.total = this.sousTotal + this.fraisLivraison;
    next();
});

// Méthode pour mettre à jour les dates selon le statut
OrderSchema.pre('save', function(next) {
    const now = new Date();
    
    if (this.statut === 'confirmée' && !this.dateConfirmation) {
        this.dateConfirmation = now;
    } else if (this.statut === 'expédiée' && !this.dateExpedition) {
        this.dateExpedition = now;
    } else if (this.statut === 'livrée' && !this.dateLivraison) {
        this.dateLivraison = now;
    }
    
    next();
});

// Méthode virtuelle pour obtenir le nom complet du client
OrderSchema.virtual('client.nomComplet').get(function() {
    return `${this.client.prenom} ${this.client.nom}`;
});

// Méthode pour obtenir le nombre d'articles
OrderSchema.virtual('nombreArticles').get(function() {
    return this.articles.reduce((total, article) => total + article.quantite, 0);
});

// Méthode statique pour obtenir les statistiques
OrderSchema.statics.getStats = async function() {
    const stats = await this.aggregate([
        {
            $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalRevenue: { $sum: '$total' },
                averageOrderValue: { $avg: '$total' },
                pendingOrders: {
                    $sum: {
                        $cond: [{ $eq: ['$statut', 'en-attente'] }, 1, 0]
                    }
                }
            }
        }
    ]);
    
    return stats[0] || {
        totalOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        pendingOrders: 0
    };
};

// Méthode statique pour obtenir les commandes par période
OrderSchema.statics.getOrdersByPeriod = async function(startDate, endDate) {
    return this.find({
        dateCommande: {
            $gte: startDate,
            $lte: endDate
        }
    }).sort({ dateCommande: -1 });
};

// Assurer que les objets JSON incluent les propriétés virtuelles
OrderSchema.set('toJSON', { virtuals: true });
OrderSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Order', OrderSchema);
