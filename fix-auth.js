const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');

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

// Fix admin user
async function fixAdminUser() {
    try {
        console.log('🔧 Fixing admin user...');
        
        // Delete existing admin if any
        await User.deleteOne({ email: 'pharmaciegaher@gmail.com' });
        console.log('🗑️ Removed existing admin user');
        
        // Create new admin with correct password
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash('anesaya75', salt);
        
        const admin = new User({
            nom: 'Gaher',
            prenom: 'Parapharmacie',
            email: 'pharmaciegaher@gmail.com',
            telephone: '+213123456789',
            adresse: 'Tipaza, Algérie',
            wilaya: 'Tipaza',
            password: hashedPassword,
            role: 'admin',
            actif: true,
            emailVerifie: true,
            telephoneVerifie: true,
            dateInscription: new Date()
        });
        
        await admin.save();
        console.log('✅ Admin user created successfully');
        
        // Test password
        const testPassword = await bcrypt.compare('anesaya75', admin.password);
        console.log('🔍 Password test:', testPassword ? '✅ PASS' : '❌ FAIL');
        
        return admin;
        
    } catch (error) {
        console.error('❌ Error fixing admin user:', error);
        throw error;
    }
}

// Create demo products if none exist
async function createDemoProducts() {
    try {
        const existingProducts = await Product.countDocuments();
        
        if (existingProducts > 0) {
            console.log(`✅ ${existingProducts} products already exist`);
            return;
        }
        
        console.log('📦 Creating demo products...');
        
        const demoProducts = [
            {
                nom: "Vitamine D3 2000 UI",
                description: "Complément alimentaire vitamine D3 pour renforcer votre système immunitaire",
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
                actif: true,
                dateAjout: new Date()
            },
            {
                nom: "Shampooing Anti-Chute",
                description: "Shampooing fortifiant spécialement formulé pour réduire la chute des cheveux",
                prix: 1800,
                categorie: "Cheveux",
                marque: "HairCare",
                stock: 30,
                enVedette: true,
                ingredients: "Kératine, biotine, huiles essentielles",
                modeEmploi: "Appliquer sur cheveux mouillés, masser, rincer",
                precautions: "Éviter le contact avec les yeux",
                image: "https://via.placeholder.com/300x300/f59e0b/ffffff?text=Shampoing",
                actif: true,
                dateAjout: new Date()
            },
            {
                nom: "Crème Hydratante Visage SPF 30",
                description: "Crème hydratante quotidienne avec protection solaire",
                prix: 3200,
                categorie: "Visage",
                marque: "SkinCare",
                stock: 25,
                enVedette: true,
                ingredients: "Acide hyaluronique, vitamine E, filtres UV",
                modeEmploi: "Appliquer matin et soir sur visage propre",
                precautions: "Test d'allergie recommandé",
                image: "https://via.placeholder.com/300x300/ec4899/ffffff?text=Crème",
                actif: true,
                dateAjout: new Date()
            }
        ];
        
        await Product.insertMany(demoProducts);
        console.log(`✅ Created ${demoProducts.length} demo products`);
        
    } catch (error) {
        console.error('❌ Error creating demo products:', error);
        throw error;
    }
}

// Create demo order
async function createDemoOrder(admin) {
    try {
        const existingOrders = await Order.countDocuments();
        
        if (existingOrders > 0) {
            console.log(`✅ ${existingOrders} orders already exist`);
            return;
        }
        
        console.log('📝 Creating demo order...');
        
        const products = await Product.find().limit(2);
        
        if (products.length === 0) {
            console.log('⚠️ No products available for demo order');
            return;
        }
        
        const articles = products.map(product => ({
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
        
    } catch (error) {
        console.error('❌ Error creating demo order:', error);
        throw error;
    }
}

// Test authentication
async function testAuthentication() {
    try {
        console.log('🧪 Testing authentication...');
        
        const user = await User.findOne({ email: 'pharmaciegaher@gmail.com' }).select('+password');
        
        if (!user) {
            console.log('❌ Admin user not found');
            return false;
        }
        
        console.log('📧 Email:', user.email);
        console.log('🔑 Role:', user.role);
        console.log('✅ Active:', user.actif);
        console.log('🔐 Password hash exists:', !!user.password);
        
        // Test password comparison
        const passwordTest = await bcrypt.compare('anesaya75', user.password);
        console.log('🔍 Password test:', passwordTest ? '✅ PASS' : '❌ FAIL');
        
        if (!passwordTest) {
            console.log('🔧 Password hash:', user.password.substring(0, 20) + '...');
            
            // Try to recreate password hash
            const newSalt = await bcrypt.genSalt(12);
            const newHash = await bcrypt.hash('anesaya75', newSalt);
            
            user.password = newHash;
            await user.save();
            
            const retestPassword = await bcrypt.compare('anesaya75', user.password);
            console.log('🔄 Retest password:', retestPassword ? '✅ PASS' : '❌ FAIL');
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Authentication test error:', error);
        return false;
    }
}

// Main function
async function fixAuthentication() {
    try {
        console.log('🚀 Starting authentication fix...');
        
        await connectDB();
        
        const admin = await fixAdminUser();
        await createDemoProducts();
        await createDemoOrder(admin);
        await testAuthentication();
        
        console.log('✅ Authentication fix completed successfully!');
        console.log('');
        console.log('🔑 Admin credentials:');
        console.log('   Email: pharmaciegaher@gmail.com');
        console.log('   Password: anesaya75');
        console.log('');
        console.log('🚀 You can now test:');
        console.log('   1. Login with the admin credentials');
        console.log('   2. Access admin dashboard');
        console.log('   3. View orders and products');
        
    } catch (error) {
        console.error('❌ Authentication fix failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📝 Database connection closed');
        process.exit(0);
    }
}

// Run the fix
if (require.main === module) {
    fixAuthentication();
}

module.exports = { fixAuthentication };
