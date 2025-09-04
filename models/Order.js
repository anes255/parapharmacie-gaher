const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    numeroCommande: {
        type: String,
        unique: true,
        required: true
    },
    client: {
        nom: { type: String, required: true },
        prenom: { type: String, required: true },
        email: { type: String, required: true },
        telephone: { type: String, required: true },
        adresse: { type: String, required: true },
        wilaya: { type: String, required: true }
    },
    articles: [{
        produit: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        nom: { type: String, required: true },
        prix: { type: Number, required: true },
        quantite: { type: Number, required: true, min: 1 },
        image: { type: String }
    }],
    sousTotal: {
        type: Number,
        required: true,
        min: 0
    },
    fraisLivraison: {
        type: Number,
        required: true,
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
        default: 'Paiement à la livraison'
    },
    commentaires: {
        type: String,
        default: ''
    },
    dateCommande: {
        type: Date,
        default: Date.now
    },
    dateLivraison: {
        type: Date,
        default: null
    },
    notesAdmin: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// Middleware pour générer le numéro de commande
OrderSchema.pre('save', async function(next) {
    if (this.isNew) {
        const count = await mongoose.model('Order').countDocuments();
        this.numeroCommande = `PG${Date.now().toString().slice(-6)}${(count + 1).toString().padStart(3, '0')}`;
    }
    next();
});

module.exports = mongoose.model('Order', OrderSchema);