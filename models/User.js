const mongoose = require('mongoose');

// Simple and robust User schema
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
    password: {
        type: String,
        required: true,
        select: false // Don't include password in queries by default
    },
    telephone: {
        type: String,
        required: true,
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
        required: true
    },
    codePostal: {
        type: String,
        trim: true
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
    dateInscription: {
        type: Date,
        default: Date.now
    },
    dernierConnexion: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for performance
UserSchema.index({ email: 1 });

// Hash password before saving
UserSchema.pre('save', async function(next) {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) return next();
    
    try {
        const bcrypt = require('bcryptjs');
        // Hash password with cost of 12
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        console.error('❌ Password hashing error:', error);
        next(error);
    }
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        const bcrypt = require('bcryptjs');
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        console.error('❌ Password comparison error:', error);
        throw error;
    }
};

// Update last connection
UserSchema.methods.updateLastConnection = async function() {
    try {
        this.dernierConnexion = new Date();
        return await this.save();
    } catch (error) {
        console.error('❌ Update last connection error:', error);
        throw error;
    }
};

// Get full name
UserSchema.virtual('nomComplet').get(function() {
    return `${this.prenom} ${this.nom}`;
});

// Transform output to hide sensitive data
UserSchema.methods.toJSON = function() {
    const user = this.toObject();
    delete user.password;
    return user;
};

// Static methods
UserSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

UserSchema.statics.findActive = function() {
    return this.find({ actif: true });
};

UserSchema.statics.findAdmins = function() {
    return this.find({ role: 'admin', actif: true });
};

module.exports = mongoose.model('User', UserSchema);
