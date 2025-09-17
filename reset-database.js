const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');
const Settings = require('./models/Settings');

// Demo products data
const demoProducts = [
    {
        nom: "Vitamine D3 2000 UI",
        description: "Complément alimentaire vitamine D3 pour renforcer votre système immunitaire et maintenir des os solides",
        prix: 2500,
        prixOriginal: 3000,
        categorie: "Vitalité",
        marque: "VitalHealth",
        stock: 50,
        enPromotion: true,
        enVedette: true,
        pourcentagePromotion: 17,
        ingredients: "Vitamine D3 (cholécalciférol), huile de tournesol",
        modeEmploi: "1 gélule par jour avec un repas",
        precautions: "Ne pas dépasser la dose recommandée",
        image: "https://via.placeholder.com/300x300/10b981/ffffff?text=Vit+D3",
        actif: true
    },
    {
        nom: "Shampooing Anti-Chute",
        description: "Shampooing fortifiant spécialement formulé pour réduire la chute des cheveux et stimuler la repousse",
        prix: 1800,
        categorie: "Cheveux",
        marque: "HairCare",
        stock: 30,
        enVedette: true,
        ingredients: "Kératine, biotine, huiles essentielles",
        modeEmploi: "Appliquer sur cheveux mouillés, masser, rincer",
        precautions: "Éviter le contact avec les yeux",
        image: "https://via.placeholder.com/300x300/f59e0b/ffffff?text=Shampoing",
        actif: true
    },
    {
        nom: "Crème Hydratante Visage SPF 30",
        description: "Crème hydratante quotidienne avec protection solaire pour tous types de peaux",
        prix: 3200,
        categorie: "Visage",
        marque: "SkinCare",
        stock: 25,
        enVedette: true,
        ingredients: "Acide hyaluronique, vitamine E, filtres UV",
        modeEmploi: "Appliquer matin et soir sur visage propre",
        precautions: "Test d'allergie recommandé",
        image: "https://via.placeholder.com/300x300/ec4899/ffffff?text=Crème",
        actif: true
    },
    {
        nom: "Gel Intime Apaisant",
        description: "Gel doux pour l'hygiène intime féminine, formule hypoallergénique",
        prix: 1500,
        categorie: "Intime",
        marque: "FemCare",
        stock: 40,
        ingredients: "Aloe vera, camomille, acide lactique",
        modeEmploi: "Usage externe uniquement",
        precautions: "Arrêter en cas d'irritation",
        image: "https://via.placeholder.com/300x300/ef4444/ffffff?text=Gel",
        actif: true
    },
    {
        nom: "Crème Solaire Enfants SPF 50+",
        description: "Protection solaire très haute pour la peau délicate des enfants",
        prix: 2800,
        categorie: "Solaire",
        marque: "SunProtect",
        stock: 35,
        enPromotion: true,
        prixOriginal: 3200,
        pourcentagePromotion: 12,
        ingredients: "Filtres minéraux, oxyde de zinc",
        modeEmploi: "Appliquer généreusement 30 min avant exposition",
        precautions: "Renouveler toutes les 2 heures",
        image: "https://via.placeholder.com/300x300/f97316/ffffff?text=Solaire",
        actif: true
    },
    {
        nom: "Lait Corporel Bébé",
        description: "Lait hydratant doux pour la peau sensible des bébés",
        prix: 1200,
        categorie: "Bébé",
        marque: "BabyCare",
        stock: 45,
        enVedette: true,
        ingredients: "Huile d'amande douce, beurre de karité",
        modeEmploi: "Masser délicatement sur peau propre",
        precautions: "Produit testé dermatologiquement",
        image: "https://via.placeholder.com/300x300/06b6d4/ffffff?text=Bébé",
        actif: true
    },
    {
        nom: "Complément Prénatal",
        description: "Vitamines et minéraux essentiels pour la femme enceinte et allaitante",
        prix: 4500,
        categorie: "Maman",
        marque: "MamaCare",
        stock: 20,
        ingredients: "Acide folique, fer, calcium, oméga-3",
        modeEmploi: "1 comprimé par jour pendant le repas",
        precautions: "Consulter un médecin avant utilisation",
        image: "https://via.placeholder.com/300x300/d946ef/ffffff?text=Prénatal",
        actif: true
    },
    {
        nom: "Brûleur de Graisse Naturel",
        description: "Complément minceur à base d'extraits végétaux pour soutenir la perte de poids",
        prix: 3800,
        categorie: "Minceur",
        marque: "SlimFit",
        stock: 15,
        ingredients: "Thé vert, guarana, chrome",
        modeEmploi: "2 gélules avant le petit-déjeuner",
        precautions: "Déconseillé aux femmes enceintes",
        image: "https://via.placeholder.com/300x300/8b5cf6/ffffff?text=Minceur",
        actif: true
    },
    {
        nom: "Gel Douche Homme Sport",
        description: "Gel douche rafraîchissant spécialement conçu pour les hommes actifs",
        prix: 1600,
        categorie: "Homme",
        marque: "MenCare",
        stock: 30,
        ingredients: "Menthol, aloe vera, vitamines",
        modeEmploi: "Appliquer sur peau mouillée et rincer",
        precautions: "Usage externe uniquement",
        image: "https://via.placeholder.com/300x300/3b82f6/ffffff?text=Sport",
        actif: true
    },
    {
        nom: "Sérum Anti-Âge",
        description: "Sérum concentré en actifs anti-âge pour réduire les rides et raffermir la peau",
        prix: 5500,
        categorie: "Soins",
        marque: "AntiAge",
        stock: 12,
        enVedette: true,
        ingredients: "Rétinol, peptides, vitamine C",
        modeEmploi: "Appliquer le soir sur peau propre",
        precautions: "Utiliser une protection solaire le jour",
        image: "https://via.placeholder.com/300x300/22c55e/ffffff?text=Sérum",
        actif: true
    },
    {
        nom: "Dentifrice Blanchissant",
        description: "Dentifrice au fluor pour un blanchiment en douceur et une protection complète",
        prix: 950,
        categorie: "Dentaire",
        marque: "SmileCare",
        stock: 60,
        ingredients: "Fluor, bicarbonate, huile de menthe",
        modeEmploi: "Brosser 3 fois par jour après les repas",
        precautions: "Ne pas avaler",
        image: "https://via.placeholder.com/300x300/6366f1/ffffff?text=Dent",
        actif: true
    },
    {
        nom: "Protéine Whey Vanille",
        description: "Poudre protéinée haute qualité pour la récupération musculaire",
        prix: 7200,
        categorie: "Sport",
        marque: "FitProtein",
        stock: 18,
        ingredients: "Protéine de lactosérum, arôme vanille",
        modeEmploi: "1 shaker après l'entraînement",
        precautions: "Boire suffisamment d'eau",
        image: "https://via.placeholder.com/300x300/f43f5e/ffffff?text=Protéine",
        actif: true
    }
];

// Connect to database
async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/parapharmacie', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB connected');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        process.exit(1);
    }
}

// Clear all collections
async function clearDatabase() {
    try {
        console.log('🧹 Clearing database...');
        
        await User.deleteMany({});
        await Product.deleteMany({});
        await Order.deleteMany({});
        await Settings.deleteMany({});
        
        console.log('✅ Database cleared');
    } catch (error) {
        console.error('❌ Error clearing database:', error);
        throw error;
    }
}

// Create admin user
async function createAdminUser() {
    try {
        console.log('👤 Creating admin user...');
        
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash('anesaya75', salt);
        
        const admin = new User({
            nom: 'Gaher',
            prenom: 'Parapharmacie',
            email: 'pharmaciegaher@gmail.com',
            password: hashedPassword,
            telephone: '+213123456789',
            adresse: 'Tipaza, Algérie',
            wilaya: 'Tipaza',
            role: 'admin',
            actif: true,
            emailVerifie: true,
            telephoneVerifie: true,
            dateInscription: new Date()
        });
        
        await admin.save();
        console.log('✅ Admin user created');
        
        return admin;
    } catch (error) {
        console.error('❌ Error creating admin user:', error);
        throw error;
    }
}

// Create demo products
async function createDemoProducts() {
    try {
        console.log('📦 Creating demo products...');
        
        const products = demoProducts.map(productData => ({
            ...productData,
            _id: new mongoose.Types.ObjectId(),
            dateAjout: new Date()
        }));
        
        await Product.insertMany(products);
        console.log(`✅ Created ${products.length} demo products`);
        
        return products;
    } catch (error) {
        console.error('❌ Error creating demo products:', error);
        throw error;
    }
}

// Initialize settings
async function initializeSettings() {
    try {
        console.log('⚙️ Initializing settings...');
        
        // This will create default settings
        await Settings.getSettings();
        
        // Initialize default wilayas
        await Settings.initializeDefaultWilayas();
        
        console.log('✅ Settings initialized');
    } catch (error) {
        console.error('❌ Error initializing settings:', error);
        throw error;
    }
}

// Create demo order
async function createDemoOrder(admin, products) {
    try {
        console.log('📝 Creating demo order...');
        
        const selectedProducts = products.slice(0, 3);
        const articles = selectedProducts.map(product => ({
            productId: product._id.toString(),
            nom: product.nom,
            prix: product.prix,
            quantite: Math.floor(Math.random() * 3) + 1,
            image: product.image
        }));
        
        const sousTotal = articles.reduce((total, article) => total + (article.prix * article.quantite), 0);
        const fraisLivraison = 400;
        const total = sousTotal + fraisLivraison;
        
        const order = new Order({
            numeroCommande: `CMD${Date.now()}${Math.floor(Math.random() * 1000)}`,
            client: {
                userId: admin._id,
                prenom: admin.prenom,
                nom: admin.nom,
                email: admin.email,
                telephone: admin.telephone,
                adresse: admin.adresse,
                wilaya: admin.wilaya
            },
            articles,
            sousTotal,
            fraisLivraison,
            total,
            statut: 'en-attente',
            modePaiement: 'Paiement à la livraison',
            commentaires: 'Commande de démonstration',
            dateCommande: new Date()
        });
        
        await order.save();
        console.log('✅ Demo order created');
        
        return order;
    } catch (error) {
        console.error('❌ Error creating demo order:', error);
        throw error;
    }
}

// Main reset function
async function resetDatabase() {
    try {
        console.log('🚀 Starting database reset...');
        
        await connectDB();
        await clearDatabase();
        
        const admin = await createAdminUser();
        const products = await createDemoProducts();
        await initializeSettings();
        await createDemoOrder(admin, products);
        
        console.log('✅ Database reset completed successfully!');
        console.log('📊 Summary:');
        console.log(`   - Admin user: ${admin.email}`);
        console.log(`   - Products: ${products.length}`);
        console.log(`   - Settings initialized`);
        console.log(`   - Demo order created`);
        console.log('');
        console.log('🔑 Admin credentials:');
        console.log('   Email: pharmaciegaher@gmail.com');
        console.log('   Password: anesaya75');
        
    } catch (error) {
        console.error('❌ Database reset failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📝 Database connection closed');
        process.exit(0);
    }
}

// Run the reset
if (require.main === module) {
    resetDatabase();
}

module.exports = { resetDatabase };
