// create-admin.js - Script to create or update admin user
// Place this file in your backend root directory and run: node create-admin.js

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User'); // Adjust path if needed

// MongoDB connection
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/parapharmacie', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB Connected');
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error);
        process.exit(1);
    }
};

// Create or update admin user
const createAdmin = async () => {
    try {
        const adminEmail = 'admin@pharmaciegaher.com';
        const adminPassword = 'Admin123456'; // Change this to a secure password
        
        console.log('\n🔍 Checking for existing admin user...');
        
        // Check if admin already exists
        let admin = await User.findOne({ email: adminEmail });
        
        if (admin) {
            console.log('✅ Admin user already exists!');
            console.log('📧 Email:', admin.email);
            console.log('👤 Name:', admin.prenom, admin.nom);
            console.log('🔑 Role:', admin.role);
            console.log('✔️  Active:', admin.actif);
            
            // Update role to admin if not already
            if (admin.role !== 'admin') {
                admin.role = 'admin';
                await admin.save();
                console.log('✅ User role updated to admin');
            }
            
            // Ensure user is active
            if (!admin.actif) {
                admin.actif = true;
                await admin.save();
                console.log('✅ User activated');
            }
            
            console.log('\n📋 You can login with:');
            console.log('   Email:', adminEmail);
            console.log('   Password: (your existing password)');
            
        } else {
            console.log('📝 Creating new admin user...');
            
            // Create new admin user
            admin = new User({
                nom: 'Admin',
                prenom: 'Pharmacie',
                email: adminEmail,
                password: adminPassword,
                telephone: '+213555000000',
                adresse: 'Tipaza, Algérie',
                ville: 'Tipaza',
                wilaya: 'Tipaza',
                codePostal: '42000',
                role: 'admin',
                actif: true,
                dateInscription: new Date()
            });
            
            await admin.save();
            
            console.log('✅ Admin user created successfully!');
            console.log('\n📋 Login credentials:');
            console.log('   Email:', adminEmail);
            console.log('   Password:', adminPassword);
            console.log('\n⚠️  IMPORTANT: Change this password after first login!');
        }
        
        // List all users
        console.log('\n📊 All users in database:');
        const allUsers = await User.find({}).select('email nom prenom role actif');
        allUsers.forEach((user, index) => {
            console.log(`   ${index + 1}. ${user.email} - ${user.prenom} ${user.nom} - ${user.role} - ${user.actif ? 'Active' : 'Inactive'}`);
        });
        
    } catch (error) {
        console.error('❌ Error creating admin:', error);
        throw error;
    }
};

// Main execution
const main = async () => {
    try {
        await connectDB();
        await createAdmin();
        console.log('\n✅ Script completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    }
};

// Run the script
main();
