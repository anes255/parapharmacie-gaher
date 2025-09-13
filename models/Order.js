const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    numeroCommande: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    clientInfo: {
        nom: { type: String, required: true },
        prenom: { type: String, default: '' },
        email: { type: String, default: '' },
        telephone: { type: String, required: true }
    },
    adresseLivraison: {
        adresse: { type: String, required: true },
        ville: { type: String, default: '' },
        wilaya: { type: String, required: true },
        codePostal: { type: String, default: '' },
        complementAdresse: { type: String, default: '' }
    },
    produits: [{
        produit: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        nom: { type: String, required: true },
        prix: { type: Number, required: true },
        quantite: { type: Number, required: true, min: 1 },
        image: { type: String, default: '' }
    }],
    sousTotal: {
        type: Number,
        required: true,
        min: 0
    },
    fraisLivraison: {
        type: Number,
        default: 300,
        min: 0
    },
    total: {
        type: Number,
        required: true,
        min: 0
    },
    statut: {
        type: String,
        enum: ['en-attente', 'confirmée', 'expédiée', 'livrée', 'annulée'],
        default: 'en-attente'
    },
    dateCommande: {
        type: Date,
        default: Date.now
    },
    dateModification: {
        type: Date,
        default: Date.now
    },
    notes: {
        type: String,
        default: ''
    },
    modeLivraison: {
        type: String,
        enum: ['domicile', 'point-relais'],
        default: 'domicile'
    },
    modePaiement: {
        type: String,
        enum: ['especes', 'carte', 'virement'],
        default: 'especes'
    }
}, {
    timestamps: true
});

// Index for search and performance
OrderSchema.index({ numeroCommande: 1 });
OrderSchema.index({ user: 1 });
OrderSchema.index({ statut: 1 });
OrderSchema.index({ dateCommande: -1 });
OrderSchema.index({ 'clientInfo.telephone': 1 });

// Pre-save middleware to update dateModification
OrderSchema.pre('save', function(next) {
    if (!this.isNew) {
        this.dateModification = new Date();
    }
    next();
});

module.exports = mongoose.model('Order', OrderSchema);
