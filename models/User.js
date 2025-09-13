const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    nom: {
        type: String,
        required: [true, 'Le nom est obligatoire'],
        trim: true,
        maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères']
    },
    prenom: {
        type: String,
        required: [true, 'Le prénom est obligatoire'],
        trim: true,
        maxlength: [50, 'Le prénom ne peut pas dépasser 50 caractères']
    },
    email: {
        type: String,
        required: [true, 'L\'email est obligatoire'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Veuillez entrer un email valide']
    },
    password: {
        type: String,
        required: [true, 'Le mot de passe est obligatoire'],
        minlength: [6, 'Le mot de passe doit contenir au moins 6 caractères'],
        select: false // Don't return password by default
    },
    telephone: {
        type: String,
        required: [true, 'Le numéro de téléphone est obligatoire'],
        match: [/^(\+213|0)[5-9]\d{8}$/, 'Veuillez entrer un numéro de téléphone algérien valide']
    },
    adresse: {
        type: String,
        default: '',
        maxlength: [200, 'L\'adresse ne peut pas dépasser 200 caractères']
    },
    ville: {
        type: String,
        default: '',
        maxlength: [50, 'La ville ne peut pas dépasser 50 caractères']
    },
    wilaya: {
        type: String,
        required: [true, 'La wilaya est obligatoire'],
        enum: [
            'Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi', 'Batna', 'Béjaïa', 'Biskra', 'Béchar',
            'Blida', 'Bouira', 'Tamanrasset', 'Tébessa', 'Tlemcen', 'Tiaret', 'Tizi Ouzou', 'Alger',
            'Djelfa', 'Jijel', 'Sétif', 'Saïda', 'Skikda', 'Sidi Bel Abbès', 'Annaba', 'Guelma',
            'Constantine', 'Médéa', 'Mostaganem', 'M\'Sila', 'Mascara', 'Ouargla', 'Oran', 'El Bayadh',
            'Illizi', 'Bordj Bou Arréridj', 'Boumerdès', 'El Tarf', 'Tindouf', 'Tissemsilt', 'El Oued',
            'Khenchela', 'Souk Ahras', 'Tipaza', 'Mila', 'Aïn Defla', 'Naâma', 'Aïn Témouchent',
            'Ghardaïa', 'Relizane'
        ]
    },
    codePostal: {
        type: String,
        default: '',
        match: [/^\d{5}$/, 'Le code postal doit contenir 5 chiffres']
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    actif: {
        type: Boolean,
        default: true
    },
    emailVerifie: {
        type: Boolean,
        default: false
    },
    dateInscription: {
        type: Date,
        default: Date.now
    },
    dernierConnexion: {
        type: Date,
        default: Date.now
    },
    preferences: {
        newsletter: {
            type: Boolean,
            default: true
        },
        notifications: {
            type: Boolean,
            default: true
        },
        langue: {
            type: String,
            enum: ['fr', 'ar'],
            default: 'fr'
        }
    },
    // Password reset functionality
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    
    // Email verification
    emailVerificationToken: String,
    emailVerificationExpire: Date
}, {
    timestamps: true
});

// Indexes for performance
UserSchema.index({ email: 1 });
UserSchema.index({ telephone: 1 });
UserSchema.index({ wilaya: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ actif: 1 });

// Hash password before saving
UserSchema.pre('save', async function(next) {
    // Only hash if password is modified
    if (!this.isModified('password')) {
        next();
    }
    
    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Method to generate password reset token
UserSchema.methods.getResetPasswordToken = function() {
    // Generate token
    const resetToken = crypto.randomBytes(20).toString('hex');
    
    // Hash and set to resetPasswordToken field
    this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    // Set expire time (10 minutes)
    this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    
    return resetToken;
};

// Method to generate email verification token
UserSchema.methods.getEmailVerificationToken = function() {
    const crypto = require('crypto');
    
    // Generate token
    const verificationToken = crypto.randomBytes(20).toString('hex');
    
    // Hash and set to emailVerificationToken field
    this.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    
    // Set expire time (24 hours)
    this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000;
    
    return verificationToken;
};

// Method to update last connection
UserSchema.methods.updateLastConnection = function() {
    this.dernierConnexion = new Date();
    return this.save();
};

// Virtual for full name
UserSchema.virtual('nomComplet').get(function() {
    return `${this.prenom} ${this.nom}`;
});

// Transform output (remove sensitive fields)
UserSchema.methods.toJSON = function() {
    const userObject = this.toObject();
    delete userObject.password;
    delete userObject.resetPasswordToken;
    delete userObject.resetPasswordExpire;
    delete userObject.emailVerificationToken;
    delete userObject.emailVerificationExpire;
    return userObject;
};

// Static method to find active users
UserSchema.statics.findActive = function() {
    return this.find({ actif: true });
};

// Static method to find by wilaya
UserSchema.statics.findByWilaya = function(wilaya) {
    return this.find({ wilaya, actif: true });
};

module.exports = mongoose.model('User', UserSchema);
