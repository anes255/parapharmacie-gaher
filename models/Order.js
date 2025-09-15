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
            trim: true
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
            enum: [
                'Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi', 'Batna', 'Béjaïa', 'Biskra', 'Béchar',
                'Blida', 'Bouira', 'Tamanrasset', 'Tébessa', 'Tlemcen', 'Tiaret', 'Tizi Ouzou', 'Alger',
                'Djelfa', 'Jijel', 'Sétif', 'Saïda', 'Skikda', 'Sidi Bel Abbès', 'Annaba', 'Guelma',
                'Constantine', 'Médéa', 'Mostaganem', 'M\'Sila', 'Mascara', 'Ouargla', 'Oran', 'El Bayadh',
                'Illizi', 'Bordj Bou Arréridj', 'Boumerdès', 'El Tarf', 'Tindouf', 'Tissemsilt', 'El Oued',
                'Khenchela', 'Souk Ahras', 'Tipaza', 'Mila', 'Aïn Defla', 'Naâma', 'Aïn Témouchent',
                'Ghardaïa', 'Relizane', 'Timimoun', 'Bordj Badji Mokhtar', 'Ouled Djellal', 'Béni Abbès',
                'In Salah', 'In Guezzam', 'Touggourt', 'Djanet', 'El M\'Ghair', 'El Meniaa'
            ]
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
        required: true,
        min: 0,
        default: 0
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
        enum: ['Paiement à la livraison', 'Carte bancaire', 'Virement bancaire'],
        default: 'Paiement à la livraison'
    },
    commentaires: {
        type: String,
        default: '',
        maxlength: 1000
    },
    dateCommande: {
        type: Date,
        default: Date.now
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
    numeroSuivi: {
        type: String,
        default: '',
        trim: true
    },
    notes: {
        type: String,
        default: '',
        maxlength: 1000
    }
}, {
    timestamps: true
});

// Index pour optimiser les requêtes
OrderSchema.index({ numeroCommande: 1 });
OrderSchema.index({ 'client.userId': 1 });
OrderSchema.index({ 'client.email': 1 });
OrderSchema.index({ statut: 1 });
OrderSchema.index({ dateCommande: -1 });

// Virtual pour le nom complet du client
OrderSchema.virtual('client.nomComplet').get(function() {
    return `${this.client.prenom} ${this.client.nom}`;
});

// Méthode pour calculer le total automatiquement
OrderSchema.methods.calculateTotal = function() {
    this.sousTotal = this.articles.reduce((total, article) => {
        return total + (article.prix * article.quantite);
    }, 0);
    
    this.total = this.sousTotal + this.fraisLivraison;
    return this.total;
};

// Méthode pour changer le statut avec validation
OrderSchema.methods.updateStatus = function(newStatus, notes = '') {
    const validTransitions = {
        'en-attente': ['confirmée', 'annulée'],
        'confirmée': ['préparée', 'annulée'],
        'préparée': ['expédiée', 'annulée'],
        'expédiée': ['livrée'],
        'livrée': [],
        'annulée': []
    };
    
    if (!validTransitions[this.statut].includes(newStatus)) {
        throw new Error(`Transition de statut invalide: ${this.statut} -> ${newStatus}`);
    }
    
    this.statut = newStatus;
    
    // Mettre à jour les dates selon le statut
    const now = new Date();
    switch (newStatus) {
        case 'confirmée':
            this.dateConfirmation = now;
            break;
        case 'expédiée':
            this.dateExpedition = now;
            break;
        case 'livrée':
            this.dateLivraison = now;
            break;
    }
    
    if (notes) {
        this.notes = notes;
    }
    
    return this;
};

// Hook pre-save pour calculer le total
OrderSchema.pre('save', function(next) {
    if (this.isModified('articles') || this.isModified('fraisLivraison')) {
        this.calculateTotal();
    }
    next();
});

// Hook pre-save pour valider les articles
OrderSchema.pre('save', function(next) {
    if (this.articles.length === 0) {
        return next(new Error('Une commande doit contenir au moins un article'));
    }
    
    // Vérifier que tous les articles ont des prix et quantités valides
    for (let article of this.articles) {
        if (article.prix <= 0) {
            return next(new Error(`Prix invalide pour l'article: ${article.nom}`));
        }
        if (article.quantite <= 0) {
            return next(new Error(`Quantité invalide pour l'article: ${article.nom}`));
        }
    }
    
    next();
});

// Méthode statique pour générer un numéro de commande unique
OrderSchema.statics.generateOrderNumber = async function() {
    const prefix = 'CMD';
    const timestamp = Date.now().toString().slice(-8);
    let orderNumber = prefix + timestamp;
    
    // Vérifier l'unicité
    let counter = 1;
    while (await this.findOne({ numeroCommande: orderNumber })) {
        orderNumber = prefix + timestamp + counter.toString().padStart(2, '0');
        counter++;
    }
    
    return orderNumber;
};

// Méthode statique pour obtenir les statistiques
OrderSchema.statics.getStats = async function(dateFrom, dateTo) {
    const matchStage = {};
    
    if (dateFrom || dateTo) {
        matchStage.dateCommande = {};
        if (dateFrom) matchStage.dateCommande.$gte = new Date(dateFrom);
        if (dateTo) matchStage.dateCommande.$lte = new Date(dateTo);
    }
    
    const stats = await this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalRevenue: { $sum: '$total' },
                averageOrderValue: { $avg: '$total' },
                totalArticles: { 
                    $sum: { 
                        $sum: '$articles.quantite' 
                    } 
                }
            }
        }
    ]);
    
    const statusStats = await this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: '$statut',
                count: { $sum: 1 }
            }
        }
    ]);
    
    return {
        general: stats[0] || {
            totalOrders: 0,
            totalRevenue: 0,
            averageOrderValue: 0,
            totalArticles: 0
        },
        byStatus: statusStats.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {})
    };
};

// Export du modèle
module.exports = mongoose.model('Order', OrderSchema);
