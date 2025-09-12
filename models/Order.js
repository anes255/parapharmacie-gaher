const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    numeroCommande: {
        type: String,
        required: true,
        unique: true
    },
    utilisateur: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null // Allow guest orders
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
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
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
        enum: ['paiement-livraison', 'carte-bancaire', 'virement', 'especes'],
        default: 'paiement-livraison'
    },
    statutPaiement: {
        type: String,
        enum: ['en-attente', 'payé', 'échec', 'remboursé'],
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
        maxlength: 1000
    },
    notesInternes: {
        type: String,
        default: '',
        maxlength: 1000
    },
    trackingNumber: {
        type: String,
        default: '',
        trim: true
    },
    // Audit fields
    createdBy: {
        type: String,
        default: 'client'
    },
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    modifications: [{
        date: {
            type: Date,
            default: Date.now
        },
        action: String,
        oldValue: String,
        newValue: String,
        modifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }]
}, {
    timestamps: true
});

// Indexes for better performance
OrderSchema.index({ numeroCommande: 1 });
OrderSchema.index({ 'client.email': 1 });
OrderSchema.index({ statut: 1 });
OrderSchema.index({ dateCommande: -1 });
OrderSchema.index({ utilisateur: 1 });

// Pre-save middleware to generate order number
OrderSchema.pre('save', async function(next) {
    if (this.isNew && !this.numeroCommande) {
        // Generate unique order number
        const timestamp = Date.now().toString();
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        this.numeroCommande = `CMD${timestamp.slice(-6)}${random}`;
    }
    
    // Update modification timestamps based on status changes
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
        }
    }
    
    next();
});

// Virtual for order age in days
OrderSchema.virtual('ageInDays').get(function() {
    const now = new Date();
    const orderDate = this.dateCommande;
    const diffTime = Math.abs(now - orderDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for total items count
OrderSchema.virtual('totalItems').get(function() {
    return this.articles.reduce((total, article) => total + article.quantite, 0);
});

// Method to add modification log
OrderSchema.methods.addModification = function(action, oldValue, newValue, modifiedBy) {
    this.modifications.push({
        action,
        oldValue: oldValue?.toString() || '',
        newValue: newValue?.toString() || '',
        modifiedBy
    });
    this.lastModifiedBy = modifiedBy;
};

// Static method to generate next order number
OrderSchema.statics.generateOrderNumber = async function() {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const orderNumber = `CMD${timestamp.slice(-6)}${random}`;
    
    // Check if it already exists (very unlikely but just in case)
    const existing = await this.findOne({ numeroCommande: orderNumber });
    if (existing) {
        // If it exists, try again
        return this.generateOrderNumber();
    }
    
    return orderNumber;
};

// Static method to get orders by status
OrderSchema.statics.getByStatus = function(status, limit = 10) {
    return this.find({ statut: status })
        .sort({ dateCommande: -1 })
        .limit(limit)
        .populate('utilisateur', 'nom prenom email');
};

// Static method to get recent orders
OrderSchema.statics.getRecent = function(days = 7, limit = 20) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return this.find({ dateCommande: { $gte: startDate } })
        .sort({ dateCommande: -1 })
        .limit(limit)
        .populate('utilisateur', 'nom prenom email');
};

// Static method to get order statistics
OrderSchema.statics.getStatistics = async function(startDate, endDate) {
    const matchStage = {};
    if (startDate || endDate) {
        matchStage.dateCommande = {};
        if (startDate) matchStage.dateCommande.$gte = new Date(startDate);
        if (endDate) matchStage.dateCommande.$lte = new Date(endDate);
    }
    
    const pipeline = [
        { $match: matchStage },
        {
            $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalRevenue: { $sum: '$total' },
                averageOrderValue: { $avg: '$total' },
                totalItems: { $sum: { $sum: '$articles.quantite' } },
                statusBreakdown: {
                    $push: '$statut'
                }
            }
        }
    ];
    
    const result = await this.aggregate(pipeline);
    return result[0] || {
        totalOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        totalItems: 0,
        statusBreakdown: []
    };
};

module.exports = mongoose.model('Order', OrderSchema);
