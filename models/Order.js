const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    numeroCommande: {
        type: String,
        required: [true, 'Le numéro de commande est requis'],
        unique: true,
        trim: true
    },
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Le client est requis']
    },
    articles: [{
        id: {
            type: String,
            required: [true, 'ID de l\'article requis']
        },
        nom: {
            type: String,
            required: [true, 'Nom de l\'article requis'],
            trim: true
        },
        prix: {
            type: Number,
            required: [true, 'Prix de l\'article requis'],
            min: [0, 'Le prix ne peut pas être négatif']
        },
        quantite: {
            type: Number,
            required: [true, 'Quantité requise'],
            min: [1, 'La quantité doit être au moins 1']
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
        required: [true, 'Sous-total requis'],
        min: [0, 'Le sous-total ne peut pas être négatif']
    },
    fraisLivraison: {
        type: Number,
        default: 0,
        min: [0, 'Les frais de livraison ne peuvent pas être négatifs']
    },
    total: {
        type: Number,
        required: [true, 'Total requis'],
        min: [0, 'Le total ne peut pas être négatif']
    },
    statut: {
        type: String,
        enum: {
            values: ['en-attente', 'confirmée', 'préparée', 'expédiée', 'livrée', 'annulée'],
            message: 'Statut invalide'
        },
        default: 'en-attente'
    },
    modePaiement: {
        type: String,
        enum: {
            values: ['Paiement à la livraison', 'Carte bancaire', 'Virement', 'Espèces'],
            message: 'Mode de paiement invalide'
        },
        default: 'Paiement à la livraison'
    },
    dateCommande: {
        type: Date,
        default: Date.now,
        index: true
    },
    dateLivraison: {
        type: Date,
        default: null
    },
    dateExpedition: {
        type: Date,
        default: null
    },
    adresseLivraison: {
        nom: {
            type: String,
            trim: true
        },
        prenom: {
            type: String,
            trim: true
        },
        telephone: {
            type: String,
            trim: true
        },
        adresse: {
            type: String,
            trim: true
        },
        ville: {
            type: String,
            trim: true
        },
        wilaya: {
            type: String,
            trim: true
        },
        codePostal: {
            type: String,
            trim: true
        }
    },
    commentaires: {
        type: String,
        trim: true,
        maxlength: [1000, 'Les commentaires ne peuvent pas dépasser 1000 caractères']
    },
    commentairesAdmin: {
        type: String,
        trim: true,
        maxlength: [500, 'Les commentaires admin ne peuvent pas dépasser 500 caractères']
    },
    numeroSuivi: {
        type: String,
        trim: true,
        default: null
    },
    transporteur: {
        type: String,
        trim: true,
        default: 'Livraison locale'
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes pour améliorer les performances
OrderSchema.index({ client: 1, dateCommande: -1 });
OrderSchema.index({ numeroCommande: 1 });
OrderSchema.index({ statut: 1 });
OrderSchema.index({ dateCommande: -1 });
OrderSchema.index({ 'client': 1, 'statut': 1 });

// Virtual pour le numéro de commande formaté
OrderSchema.virtual('numeroFormate').get(function() {
    return `#${this.numeroCommande}`;
});

// Virtual pour le délai de livraison
OrderSchema.virtual('delaiLivraison').get(function() {
    if (this.dateLivraison && this.dateCommande) {
        const diffTime = Math.abs(this.dateLivraison - this.dateCommande);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }
    return null;
});

// Virtual pour le statut en français
OrderSchema.virtual('statutFrancais').get(function() {
    const statutsMap = {
        'en-attente': 'En attente',
        'confirmée': 'Confirmée',
        'préparée': 'Préparée',
        'expédiée': 'Expédiée',
        'livrée': 'Livrée',
        'annulée': 'Annulée'
    };
    return statutsMap[this.statut] || this.statut;
});

// Méthode pour calculer le total
OrderSchema.methods.calculerTotal = function() {
    const sousTotal = this.articles.reduce((total, article) => {
        return total + (article.prix * article.quantite);
    }, 0);
    
    this.sousTotal = sousTotal;
    this.total = sousTotal + this.fraisLivraison;
    
    return this.total;
};

// Méthode pour mettre à jour le statut
OrderSchema.methods.mettreAJourStatut = function(nouveauStatut) {
    const statutsValides = ['en-attente', 'confirmée', 'préparée', 'expédiée', 'livrée', 'annulée'];
    
    if (!statutsValides.includes(nouveauStatut)) {
        throw new Error('Statut invalide');
    }
    
    this.statut = nouveauStatut;
    
    // Définir automatiquement les dates selon le statut
    switch (nouveauStatut) {
        case 'expédiée':
            if (!this.dateExpedition) {
                this.dateExpedition = new Date();
            }
            break;
        case 'livrée':
            if (!this.dateLivraison) {
                this.dateLivraison = new Date();
            }
            break;
    }
    
    return this.save();
};

// Méthode pour ajouter un commentaire admin
OrderSchema.methods.ajouterCommentaireAdmin = function(commentaire) {
    const timestamp = new Date().toLocaleString('fr-FR');
    const nouveauCommentaire = `[${timestamp}] ${commentaire}`;
    
    if (this.commentairesAdmin) {
        this.commentairesAdmin += '\n' + nouveauCommentaire;
    } else {
        this.commentairesAdmin = nouveauCommentaire;
    }
    
    return this.save();
};

// Méthode pour générer un numéro de suivi
OrderSchema.methods.genererNumeroSuivi = function() {
    if (!this.numeroSuivi) {
        const prefix = 'SHF';
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        this.numeroSuivi = `${prefix}${timestamp}${random}`;
    }
    return this.numeroSuivi;
};

// Méthode statique pour obtenir les commandes par statut
OrderSchema.statics.obtenirParStatut = function(statut) {
    return this.find({ statut })
        .populate('client', 'nom prenom email telephone wilaya')
        .sort({ dateCommande: -1 });
};

// Méthode statique pour obtenir les commandes récentes
OrderSchema.statics.obtenirRecentes = function(limite = 10) {
    return this.find()
        .populate('client', 'nom prenom email telephone')
        .sort({ dateCommande: -1 })
        .limit(limite);
};

// Méthode statique pour obtenir les statistiques
OrderSchema.statics.obtenirStatistiques = async function() {
    try {
        const maintenant = new Date();
        const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
        const debutSemaine = new Date(maintenant.setDate(maintenant.getDate() - maintenant.getDay()));
        
        const [
            totalCommandes,
            commandesEnAttente,
            commandesConfirmees,
            commandesLivrees,
            revenusAgg
        ] = await Promise.all([
            this.countDocuments(),
            this.countDocuments({ statut: 'en-attente' }),
            this.countDocuments({ statut: 'confirmée' }),
            this.countDocuments({ statut: 'livrée' }),
            this.aggregate([
                {
                    $match: {
                        dateCommande: { $gte: debutMois },
                        statut: { $nin: ['annulée'] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        revenusTotal: { $sum: '$total' },
                        nombreCommandes: { $sum: 1 }
                    }
                }
            ])
        ]);
        
        const revenus = revenusAgg.length > 0 ? revenusAgg[0].revenusTotal : 0;
        const commandesMois = revenusAgg.length > 0 ? revenusAgg[0].nombreCommandes : 0;
        
        return {
            totalCommandes,
            commandesEnAttente,
            commandesConfirmees,
            commandesLivrees,
            revenus,
            commandesMois
        };
    } catch (error) {
        throw new Error('Erreur lors du calcul des statistiques: ' + error.message);
    }
};

// Middleware pre-save pour valider et calculer
OrderSchema.pre('save', function(next) {
    // Recalculer le total si les articles ou frais de livraison ont changé
    if (this.isModified('articles') || this.isModified('fraisLivraison')) {
        this.calculerTotal();
    }
    
    // Valider que le total correspond au calcul
    const totalCalcule = this.sousTotal + this.fraisLivraison;
    if (Math.abs(this.total - totalCalcule) > 0.01) {
        return next(new Error('Le total ne correspond pas au calcul'));
    }
    
    // Générer numéro de suivi si expédiée
    if (this.statut === 'expédiée' && !this.numeroSuivi) {
        this.genererNumeroSuivi();
    }
    
    next();
});

// Middleware post-save pour logging
OrderSchema.post('save', function(doc) {
    console.log(`✅ Commande ${doc.numeroCommande} sauvegardée avec statut: ${doc.statut}`);
});

// Middleware pre-remove pour logging
OrderSchema.pre('remove', function(next) {
    console.log(`🗑️ Suppression de la commande: ${this.numeroCommande}`);
    next();
});

module.exports = mongoose.model('Order', OrderSchema);
