const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
    fraisLivraison: {
        type: Number,
        default: 300,
        min: 0
    },
    livraisonGratuite: {
        type: Number,
        default: 5000,
        min: 0
    },
    couleurPrimaire: {
        type: String,
        default: '#4ade80'
    },
    couleurSecondaire: {
        type: String,
        default: '#16a34a'
    },
    couleurAccent: {
        type: String,
        default: '#22c55e'
    },
    nomSite: {
        type: String,
        default: 'Pharmacie Gaher'
    },
    slogan: {
        type: String,
        default: 'Votre santé, notre priorité'
    },
    email: {
        type: String,
        default: 'pharmaciegaher@gmail.com'
    },
    telephone: {
        type: String,
        default: '+213123456789'
    },
    adresse: {
        type: String,
        default: 'Tipaza, Algérie'
    },
    instagram: {
        type: String,
        default: 'https://www.instagram.com/pharmaciegaher/'
    },
    facebook: {
        type: String,
        default: 'https://www.facebook.com/pharmaciegaher/?locale=mg_MG'
    },
    heuresOuverture: {
        type: String,
        default: 'Lun-Sam: 8h-20h, Dim: 9h-18h'
    },
    messageAccueil: {
        type: String,
        default: 'Bienvenue chez Pharmacie Gaher - Votre partenaire santé de confiance'
    },
    logoUrl: {
        type: String,
        default: '/images/logo.png'
    },
    banniereAccueil: {
        type: String,
        default: '/images/banniere-accueil.jpg'
    },
    maintenanceMode: {
        type: Boolean,
        default: false
    },
    messagesMaintenance: {
        type: String,
        default: 'Site en maintenance. Nous revenons bientôt!'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Settings', SettingsSchema);