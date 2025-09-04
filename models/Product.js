const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    nom: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    prix: {
        type: Number,
        required: true,
        min: 0
    },
    prixOriginal: {
        type: Number,
        default: null
    },
    categorie: {
        type: String,
        required: true,
        enum: [
            'Cheveux',
            'Intime', 
            'Solaire',
            'Maman',
            'Bébé',
            'Visage',
            'Minceur',
            'Homme',
            'Soins',
            'Dentaire',
            'Vitalité'
        ]
    },
    sousCategorie: {
        type: String,
        default: ''
    },
    image: {
        type: String,
        default: '/images/placeholder.jpg'
    },
    images: [{
        type: String
    }],
    stock: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    enPromotion: {
        type: Boolean,
        default: false
    },
    pourcentagePromotion: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    marque: {
        type: String,
        default: ''
    },
    ingredients: {
        type: String,
        default: ''
    },
    modeEmploi: {
        type: String,
        default: ''
    },
    precautions: {
        type: String,
        default: ''
    },
    enVedette: {
        type: Boolean,
        default: false
    },
    actif: {
        type: Boolean,
        default: true
    },
    dateAjout: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index pour la recherche
ProductSchema.index({ nom: 'text', description: 'text', marque: 'text' });

module.exports = mongoose.model('Product', ProductSchema);