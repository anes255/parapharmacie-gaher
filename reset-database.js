// reset-database.js - Script to reset users with proper password hashes
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(async () => {
    console.log('✅ Connecté à MongoDB');
    
    // Import models
    const User = require('./models/User');
    const Settings = require('./models/Settings');
    const Product = require('./models/Product');
    
    try {
        console.log('🔄 Début de la réinitialisation...');
        
        // Delete all existing users to start fresh
        await User.deleteMany({});
        console.log('🗑️ Tous les utilisateurs existants supprimés');
        
        // Create admin user with proper password hash
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('anesaya75', salt);
        
        console.log('🔐 Mot de passe hashé créé');
        
        const adminUser = new User({
            nom: 'Gaher',
            prenom: 'Pharmacie',
            email: 'pharmaciegaher@gmail.com',
            telephone: '+213123456789',
            adresse: 'Tipaza, Algérie',
            wilaya: 'Tipaza',
            password: hashedPassword,
            role: 'admin'
        });
        
        await adminUser.save();
        console.log('✅ Compte admin créé avec mot de passe hashé');
        console.log('📧 Email: pharmaciegaher@gmail.com');
        console.log('🔑 Mot de passe: anesaya75');
        console.log('👑 Rôle: admin');
        
        // Verify the admin user was created correctly
        const verifyAdmin = await User.findOne({ email: 'pharmaciegaher@gmail.com' }).select('+password');
        if (verifyAdmin && verifyAdmin.password) {
            console.log('✅ Vérification: Admin user créé avec password hash');
            console.log('🔍 Password hash length:', verifyAdmin.password.length);
            console.log('🔍 Role:', verifyAdmin.role);
        } else {
            console.log('❌ ERREUR: Admin user créé mais sans password!');
        }
        
        // Create a test user account
        const testUserPassword = await bcrypt.hash('test123', salt);
        const testUser = new User({
            nom: 'Test',
            prenom: 'User',
            email: 'test@example.com',
            telephone: '+213987654321',
            adresse: 'Test Address, Algérie',
            wilaya: 'Alger',
            password: testUserPassword,
            role: 'user'
        });
        
        await testUser.save();
        console.log('✅ Compte test créé');
        console.log('📧 Email: test@example.com');
        console.log('🔑 Mot de passe: test123');
        
        // Create default settings
        await Settings.deleteMany({});
        const defaultSettings = new Settings({
            fraisLivraison: 300,
            livraisonGratuite: 5000,
            couleurPrimaire: '#10b981',
            couleurSecondaire: '#059669',
            couleurAccent: '#34d399',
            nomSite: 'VitalCare - Pharmacie Gaher',
            slogan: 'Votre bien-être, notre mission naturelle',
            email: 'pharmaciegaher@gmail.com',
            telephone: '+213123456789',
            adresse: 'Tipaza, Algérie',
            instagram: 'https://www.instagram.com/pharmaciegaher/',
            facebook: 'https://www.facebook.com/pharmaciegaher/?locale=mg_MG',
            heuresOuverture: 'Lun-Sam: 8h-20h, Dim: 9h-18h',
            messageAccueil: 'Bienvenue chez VitalCare - Votre partenaire santé de confiance'
        });
        
        await defaultSettings.save();
        console.log('✅ Paramètres par défaut créés');
        
        // Create example products if none exist
        const productCount = await Product.countDocuments();
        if (productCount === 0) {
            console.log('📦 Création des produits d\'exemple...');
            await createExampleProducts();
        }
        
        console.log('\n🎉 Base de données réinitialisée avec succès!');
        console.log('\n📋 RÉSUMÉ:');
        console.log('   - Admin: pharmaciegaher@gmail.com / anesaya75');
        console.log('   - Test User: test@example.com / test123');
        console.log('   - Paramètres par défaut créés');
        console.log('   - Produits d\'exemple créés');
        
    } catch (error) {
        console.error('❌ Erreur lors de la réinitialisation:', error);
    }
    
    mongoose.disconnect();
    console.log('👋 Déconnecté de MongoDB');
})
.catch(err => {
    console.error('❌ Erreur de connexion MongoDB:', err);
});

// Function to create example products
async function createExampleProducts() {
    const Product = require('./models/Product');
    
    const exampleProducts = [
        {
            nom: "Multivitamines VitalForce",
            description: "Complexe de vitamines et minéraux pour booster votre énergie quotidienne. Formule complète avec vitamines A, B, C, D, E et minéraux essentiels.",
            prix: 2800,
            prixOriginal: 3200,
            categorie: "Vitalité",
            marque: "VitalCare",
            stock: 50,
            enPromotion: true,
            pourcentagePromotion: 12,
            enVedette: true,
            image: "/images/multivitamines.jpg",
            ingredients: "Vitamines A, B1, B2, B6, B12, C, D3, E, Fer, Zinc, Magnésium",
            modeEmploi: "1 comprimé par jour avec un grand verre d'eau, de préférence le matin",
            precautions: "Ne pas dépasser la dose recommandée. Tenir hors de portée des enfants."
        },
        {
            nom: "Shampoing Anti-Chute L'Oréal",
            description: "Shampoing fortifiant pour cheveux fragiles et qui tombent. Formule enrichie en aminexil et vitamines B3, B5, B6.",
            prix: 2500,
            prixOriginal: 3000,
            categorie: "Cheveux",
            marque: "L'Oréal",
            stock: 25,
            enPromotion: true,
            pourcentagePromotion: 17,
            enVedette: true,
            image: "/images/shampoing-loreal.jpg",
            ingredients: "Aqua, Sodium Laureth Sulfate, Aminexil, Vitamines B3, B5, B6",
            modeEmploi: "Appliquer sur cheveux mouillés, masser délicatement, rincer abondamment",
            precautions: "Éviter le contact avec les yeux"
        },
        {
            nom: "Crème Hydratante Visage Avène",
            description: "Crème hydratante apaisante pour peaux sensibles et sèches. Eau thermale d'Avène.",
            prix: 3200,
            categorie: "Visage",
            marque: "Avène",
            stock: 30,
            enVedette: true,
            image: "/images/creme-avene.jpg",
            ingredients: "Eau thermale d'Avène, Glycérine, Beurre de Karité",
            modeEmploi: "Appliquer matin et soir sur visage propre",
            precautions: "Usage externe uniquement"
        },
        {
            nom: "Lait Nettoyant Bébé Mustela",
            description: "Lait nettoyant doux pour la peau délicate de bébé. Sans paraben, hypoallergénique.",
            prix: 1800,
            categorie: "Bébé",
            marque: "Mustela",
            stock: 20,
            image: "/images/lait-mustela.jpg",
            ingredients: "Aqua, Coco-Glucoside, Glycérine végétale",
            modeEmploi: "Appliquer sur peau humide, nettoyer en douceur, rincer",
            precautions: "Testé sous contrôle dermatologique et pédiatrique"
        },
        {
            nom: "Crème Solaire SPF 50+ La Roche Posay",
            description: "Protection solaire très haute pour peaux sensibles. Résistante à l'eau.",
            prix: 4500,
            categorie: "Solaire",
            marque: "La Roche Posay",
            stock: 15,
            enVedette: true,
            image: "/images/creme-solaire-lrp.jpg",
            ingredients: "Mexoryl SX, Mexoryl XL, Eau thermale La Roche-Posay",
            modeEmploi: "Appliquer généreusement avant exposition. Renouveler fréquemment",
            precautions: "Éviter exposition prolongée même avec protection"
        },
        {
            nom: "Dentifrice Sensodyne Protection Complète",
            description: "Dentifrice pour dents sensibles. Protection 24h contre la sensibilité dentaire.",
            prix: 950,
            categorie: "Dentaire",
            marque: "Sensodyne",
            stock: 40,
            image: "/images/dentifrice-sensodyne.jpg",
            modeEmploi: "Brosser les dents 2 fois par jour",
            precautions: "Ne pas avaler. Tenir hors de portée des enfants"
        },
        {
            nom: "Gel Nettoyant Intime Saforelle",
            description: "Gel doux pour l'hygiène intime quotidienne. pH physiologique, sans savon.",
            prix: 1600,
            categorie: "Intime",
            marque: "Saforelle",
            stock: 22,
            image: "/images/gel-saforelle.jpg",
            ingredients: "Bardane, pH 5.2, Sans savon",
            modeEmploi: "Utiliser quotidiennement avec de l'eau tiède",
            precautions: "Usage externe uniquement"
        },
        {
            nom: "Gel Douche Homme Vichy",
            description: "Gel douche hydratant pour homme. Eau thermale de Vichy, parfum frais.",
            prix: 1400,
            categorie: "Homme",
            marque: "Vichy",
            stock: 18,
            image: "/images/gel-vichy-homme.jpg",
            ingredients: "Eau thermale de Vichy, Glycérine",
            modeEmploi: "Appliquer sur peau mouillée, faire mousser, rincer",
            precautions: "Éviter le contact avec les yeux"
        }
    ];

    await Product.insertMany(exampleProducts);
    console.log('✅ Produits d\'exemple créés:', exampleProducts.length);
}