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
    codePromo: {
        type: String,
        trim: true,
        uppercase: true
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
        enum: ['Paiement à la livraison', 'Carte bancaire', 'Virement bancaire', 'Chèque'],
        default: 'Paiement à la livraison'
    },
    statutPaiement: {
        type: String,
        enum: ['en-attente', 'payé', 'échoué', 'remboursé'],
        default: 'en-attente'
    },
    dateCommande: {
        type: Date,
        required: true,
        default: Date.now
    },
    dateConfirmation: {
        type: Date
    },
    datePreparation: {
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
    transporteur: {
        nom: {
            type: String,
            trim: true
        },
        numeroSuivi: {
            type: String,
            trim: true
        },
        urlSuivi: {
            type: String,
            trim: true
        }
    },
    commentaires: {
        type: String,
        trim: true,
        maxlength: [500, 'Les commentaires ne peuvent pas dépasser 500 caractères']
    },
    commentairesInternes: {
        type: String,
        trim: true,
        maxlength: [1000, 'Les commentaires internes ne peuvent pas dépasser 1000 caractères']
    },
    historique: [{
        action: {
            type: String,
            required: true
        },
        date: {
            type: Date,
            default: Date.now
        },
        utilisateur: {
            type: String
        },
        details: {
            type: String
        }
    }],
    facturation: {
        numeroFacture: {
            type: String,
            trim: true
        },
        dateFacturation: {
            type: Date
        },
        montantTTC: {
            type: Number
        },
        montantHT: {
            type: Number
        },
        tva: {
            type: Number,
            default: 0
        }
    },
    livraison: {
        adresse: {
            type: String,
            trim: true
        },
        ville: {
            type: String,
            trim: true
        },
        wilaya: {
            type: String
        },
        codePostal: {
            type: String,
            trim: true
        },
        instructions: {
            type: String,
            trim: true,
            maxlength: [200, 'Les instructions de livraison ne peuvent pas dépasser 200 caractères']
        },
        creneauLivraison: {
            type: String,
            enum: ['Matin (9h-12h)', 'Après-midi (14h-17h)', 'Soirée (17h-20h)', 'Toute la journée']
        }
    },
    utilisateurId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    newsletter: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Indexes for performance
OrderSchema.index({ numeroCommande: 1 });
OrderSchema.index({ 'client.email': 1 });
OrderSchema.index({ statut: 1 });
OrderSchema.index({ dateCommande: -1 });
OrderSchema.index({ utilisateurId: 1 });
OrderSchema.index({ 'client.nom': 'text', 'client.prenom': 'text', 'client.email': 'text' });

// Generate order number
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

// Update status history
OrderSchema.pre('save', function(next) {
    if (this.isModified('statut')) {
        const now = new Date();
        
        // Update corresponding date fields
        switch (this.statut) {
            case 'confirmée':
                if (!this.dateConfirmation) this.dateConfirmation = now;
                break;
            case 'préparée':
                if (!this.datePreparation) this.datePreparation = now;
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
        
        // Add to history
        this.historique.push({
            action: `Statut changé vers: ${this.statut}`,
            date: now,
            details: `Commande ${this.statut}`
        });
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

// Instance methods
OrderSchema.methods.addToHistory = function(action, utilisateur = null, details = null) {
    this.historique.push({
        action,
        date: new Date(),
        utilisateur,
        details
    });
};

OrderSchema.methods.updateStatut = function(newStatut, utilisateur = null) {
    const oldStatut = this.statut;
    this.statut = newStatut;
    this.addToHistory(
        `Statut changé de "${oldStatut}" vers "${newStatut}"`,
        utilisateur,
        `Mise à jour du statut de commande`
    );
};

OrderSchema.methods.canBeCancelled = function() {
    return ['en-attente', 'confirmée'].includes(this.statut);
};

OrderSchema.methods.canBeModified = function() {
    return ['en-attente'].includes(this.statut);
};

// Virtual for full client name
OrderSchema.virtual('client.nomComplet').get(function() {
    return `${this.client.prenom} ${this.client.nom}`;
});

// Virtual for order duration
OrderSchema.virtual('dureeCommande').get(function() {
    if (this.dateLivraison) {
        return Math.ceil((this.dateLivraison - this.dateCommande) / (1000 * 60 * 60 * 24));
    }
    return Math.ceil((new Date() - this.dateCommande) / (1000 * 60 * 60 * 24));
});

// Static methods
OrderSchema.statics.findByStatus = function(statut) {
    return this.find({ statut });
};

OrderSchema.statics.findByClient = function(email) {
    return this.find({ 'client.email': email.toLowerCase() });
};

OrderSchema.statics.findByDateRange = function(startDate, endDate) {
    return this.find({
        dateCommande: {
            $gte: startDate,
            $lte: endDate
        }
    });
};

OrderSchema.statics.getRevenueStats = function(startDate, endDate) {
    return this.aggregate([
        {
            $match: {
                dateCommande: { $gte: startDate, $lte: endDate },
                statut: { $nin: ['annulée'] }
            }
        },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: '$total' },
                totalOrders: { $sum: 1 },
                averageOrderValue: { $avg: '$total' }
            }
        }
    ]);
};

OrderSchema.statics.getTopProducts = function(startDate, endDate, limit = 10) {
    return this.aggregate([
        {
            $match: {
                dateCommande: { $gte: startDate, $lte: endDate },
                statut: { $nin: ['annulée'] }
            }
        },
        { $unwind: '$articles' },
        {
            $group: {
                _id: '$articles.id',
                nom: { $first: '$articles.nom' },
                totalQuantity: { $sum: '$articles.quantite' },
                totalRevenue: { $sum: '$articles.sousTotal' }
            }
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: limit }
    ]);
};

// Transform output to hide sensitive data
OrderSchema.methods.toJSON = function() {
    const order = this.toObject();
    delete order.commentairesInternes;
    return order;
};

module.exports = mongoose.model('Order', OrderSchema);
