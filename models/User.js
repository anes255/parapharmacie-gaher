const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
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
        unique: true,
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
        enum: [
            'Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi', 'Batna', 'Béjaïa', 
            'Biskra', 'Béchar', 'Blida', 'Bouira', 'Tamanrasset', 'Tébessa', 
            'Tlemcen', 'Tiaret', 'Tizi Ouzou', 'Alger', 'Djelfa', 'Jijel', 
            'Sétif', 'Saïda', 'Skikda', 'Sidi Bel Abbès', 'Annaba', 'Guelma', 
            'Constantine', 'Médéa', 'Mostaganem', 'M\'Sila', 'Mascara', 'Ouargla', 
            'Oran', 'El Bayadh', 'Illizi', 'Bordj Bou Arréridj', 'Boumerdès', 
            'El Tarf', 'Tindouf', 'Tissemsilt', 'El Oued', 'Khenchela', 
            'Souk Ahras', 'Tipaza', 'Mila', 'Aïn Defla', 'Naâma', 'Aïn Témouchent', 
            'Ghardaïa', 'Relizane'
        ]
    },
    password: {
        type: String,
        required: true,
        minlength: 6
        // REMOVED select: false - this was preventing password from being saved
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    dateInscription: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index pour les recherches fréquentes
UserSchema.index({ email: 1 });

module.exports = mongoose.model('User', UserSchema);