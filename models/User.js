const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

console.log('🔧 DEBUG: Loading User model...');

const UserSchema = new mongoose.Schema({
    prenom: { type: String, required: true },
    nom: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    telephone: { type: String, required: true },
    password: { type: String, required: true, select: false },
    adresse: { type: String, required: true },
    ville: { type: String, default: '' },
    wilaya: { type: String, required: true },
    codePostal: { type: String, default: '' },
    role: { type: String, enum: ['client', 'admin'], default: 'client' },
    actif: { type: Boolean, default: true },
    dateInscription: { type: Date, default: Date.now },
    dernierConnexion: { type: Date, default: Date.now },
    preferences: {
        newsletter: { type: Boolean, default: true },
        notifications: {
            email: { type: Boolean, default: true },
            sms: { type: Boolean, default: false }
        },
        langue: { type: String, enum: ['fr', 'ar', 'en'], default: 'fr' }
    }
}, { timestamps: true });

// Simple password hashing
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    try {
        this.password = await bcrypt.hash(this.password, 12);
        next();
    } catch (error) {
        next(error);
    }
});

// Simple password comparison - both method names for compatibility
UserSchema.methods.comparePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
};

UserSchema.methods.comparerMotDePasse = async function(password) {
    return await bcrypt.compare(password, this.password);
};

// Simple last connection update
UserSchema.methods.updateLastConnection = async function() {
    this.dernierConnexion = new Date();
    return await this.save();
};

// Clean JSON output
UserSchema.set('toJSON', {
    transform: function(doc, ret) {
        delete ret.password;
        return ret;
    }
});

console.log('🔧 DEBUG: User schema defined, creating model...');

const User = mongoose.model('User', UserSchema);

console.log('🔧 DEBUG: ✅ User model created successfully');

module.exports = User;
