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

// Index for better performance
OrderSchema.index({ numeroCommande: 1 });
OrderSchema.index({ 'client.email': 1 });
OrderSchema.index({ statut: 1 });
OrderSchema.index({ dateCommande: -1 });

// Auto-calculate total before saving
OrderSchema.pre('save', function(next) {
    this.total = this.sousTotal + this.fraisLivraison;
    next();
});

// Update status dates automatically
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

module.exports = mongoose.model('Order', OrderSchema);
