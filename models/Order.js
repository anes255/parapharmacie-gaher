const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    numeroCommande: {
        type: String,
        required: true,
        unique: true,
        index: true
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
            required: true,
            trim: true
        },
        ville: {
            type: String,
            trim: true
        },
        wilaya: {
            type: String,
            required: true
        },
        codePostal: {
            type: String,
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
        sousTotal: {
            type: Number,
            required: true,
            min: 0
        },
        image: {
            type: String
        },
        categorie: {
            type: String
        },
        marque: {
            type: String
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
        default: 0
    },
    remise: {
        type: Number,
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
        required: true,
        enum: ['en-attente', 'confirmée', 'préparée', 'expédiée', 'livrée', 'annulée'],
        default: 'en-attente'
    },
    modePaiement: {
        type: String,
        required: true,
        enum: ['Paiement à la livraison', 'Carte bancaire', 'Virement bancaire'],
        default: 'Paiement à la livraison'
    },
    dateCommande: {
        type: Date,
        required: true,
        default: Date.now
    },
    dateConfirmation: {
        type: Date
    },
    dateExpedition: {
        type: Date
    },
    dateLivraison: {
        type: Date
    },
    dateAnnulation: {
        type: Date
    },
    commentaires: {
        type: String,
        trim: true
    },
    commentairesAdmin: {
        type: String,
        trim: true
    },
    deviceInfo: {
        userAgent: String,
        platform: String,
        ip: String
    },
    source: {
        type: String,
        enum: ['web', 'mobile', 'api'],
        default: 'web'
    }
}, {
    timestamps: true
});

// Indexes for performance and search
OrderSchema.index({ numeroCommande: 1 });
OrderSchema.index({ 'client.email': 1 });
OrderSchema.index({ statut: 1 });
OrderSchema.index({ dateCommande: -1 });
OrderSchema.index({ 'client.nom': 'text', 'client.prenom': 'text', 'client.email': 'text', numeroCommande: 'text' });

// Generate order number automatically
OrderSchema.pre('save', async function(next) {
    if (this.isNew && !this.numeroCommande) {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        
        // Find the last order number for today
        const startOfDay = new Date(date.setHours(0, 0, 0, 0));
        const endOfDay = new Date(date.setHours(23, 59, 59, 999));
        
        const lastOrder = await this.constructor.findOne({
            dateCommande: { $gte: startOfDay, $lte: endOfDay }
        }).sort({ numeroCommande: -1 });
        
        let sequence = 1;
        if (lastOrder && lastOrder.numeroCommande) {
            const lastSequence = parseInt(lastOrder.numeroCommande.slice(-3));
            sequence = lastSequence + 1;
        }
        
        this.numeroCommande = `SH${year}${month}${day}${sequence.toString().padStart(3, '0')}`;
    }
    next();
});

// Calculate totals before saving
OrderSchema.pre('save', function(next) {
    // Calculate sous-total from articles
    this.sousTotal = this.articles.reduce((total, article) => {
        article.sousTotal = article.prix * article.quantite;
        return total + article.sousTotal;
    }, 0);
    
    // Calculate total
    this.total = this.sousTotal + this.fraisLivraison - (this.remise || 0);
    
    // Ensure total is not negative
    if (this.total < 0) this.total = 0;
    
    next();
});

// Update status dates
OrderSchema.pre('save', function(next) {
    if (this.isModified('statut')) {
        const now = new Date();
        
        switch (this.statut) {
            case 'confirmée':
                if (!this.dateConfirmation) this.dateConfirmation = now;
                break;
            case 'expédiée':
                if (!this.dateExpedition) this.dateExpedition = now;
                break;
            case 'livrée':
                if (!this.dateLivraison) this.dateLivraison = now;
                break;
            case 'annulée':
                if (!this.dateAnnulation) this.dateAnnulation = now;
                break;
        }
    }
    next();
});

// Instance methods
OrderSchema.methods.canBeCancelled = function() {
    return ['en-attente', 'confirmée'].includes(this.statut);
};

OrderSchema.methods.canBeModified = function() {
    return ['en-attente'].includes(this.statut);
};

OrderSchema.methods.updateStatus = function(newStatus, commentaire = null) {
    this.statut = newStatus;
    if (commentaire) {
        this.commentairesAdmin = commentaire;
    }
};

// Virtual for full client name
OrderSchema.virtual('client.nomComplet').get(function() {
    return `${this.client.prenom} ${this.client.nom}`;
});

// Virtual for order duration
OrderSchema.virtual('dureeCommande').get(function() {
    const endDate = this.dateLivraison || new Date();
    return Math.ceil((endDate - this.dateCommande) / (1000 * 60 * 60 * 24));
});

// Static methods
OrderSchema.statics.findByStatus = function(statut) {
    return this.find({ statut }).sort({ dateCommande: -1 });
};

OrderSchema.statics.findByClient = function(email) {
    return this.find({ 'client.email': email.toLowerCase() }).sort({ dateCommande: -1 });
};

OrderSchema.statics.findByDateRange = function(startDate, endDate) {
    return this.find({
        dateCommande: {
            $gte: startDate,
            $lte: endDate
        }
    }).sort({ dateCommande: -1 });
};

OrderSchema.statics.getStats = function() {
    return this.aggregate([
        {
            $group: {
                _id: '$statut',
                count: { $sum: 1 },
                totalAmount: { $sum: '$total' }
            }
        }
    ]);
};

OrderSchema.statics.searchOrders = function(query, limit = 50) {
    const searchRegex = new RegExp(query, 'i');
    return this.find({
        $or: [
            { numeroCommande: searchRegex },
            { 'client.nom': searchRegex },
            { 'client.prenom': searchRegex },
            { 'client.email': searchRegex },
            { 'client.telephone': searchRegex }
        ]
    }).sort({ dateCommande: -1 }).limit(limit);
};

module.exports = mongoose.model('Order', OrderSchema);
