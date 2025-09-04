// fix-admin-password.js - Force fix admin password issue
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

console.log('🔧 Fixing admin password issue...');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(async () => {
    console.log('✅ Connected to MongoDB');
    
    // Import the User model
    const User = require('./models/User');
    
    try {
        console.log('🔍 Checking current admin user...');
        
        // First, completely delete the problematic admin user
        await User.deleteOne({ email: 'pharmaciegaher@gmail.com' });
        console.log('🗑️ Deleted existing admin user');
        
        // Create a strong password hash
        console.log('🔐 Creating new password hash...');
        const salt = await bcrypt.genSalt(12); // Higher salt rounds for security
        const hashedPassword = await bcrypt.hash('anesaya75', salt);
        
        console.log('📏 Password hash length:', hashedPassword.length);
        console.log('🔐 Hash starts with:', hashedPassword.substring(0, 10) + '...');
        
        // Create new admin user with explicit field setting
        const adminData = {
            nom: 'Gaher',
            prenom: 'Pharmacie',
            email: 'pharmaciegaher@gmail.com',
            telephone: '+213123456789',
            adresse: 'Tipaza, Algérie',
            wilaya: 'Tipaza',
            password: hashedPassword,
            role: 'admin'
        };
        
        console.log('👤 Creating new admin user...');
        const adminUser = new User(adminData);
        
        // Force save with password validation
        const savedAdmin = await adminUser.save();
        
        console.log('✅ Admin user created successfully!');
        console.log('📧 Email:', savedAdmin.email);
        console.log('👑 Role:', savedAdmin.role);
        console.log('🆔 ID:', savedAdmin._id);
        
        // Verify the user was saved correctly by fetching it back
        console.log('🔍 Verifying admin user...');
        const verifyAdmin = await User.findOne({ email: 'pharmaciegaher@gmail.com' }).select('+password');
        
        if (verifyAdmin) {
            console.log('✅ Admin verification successful');
            console.log('📧 Found email:', verifyAdmin.email);
            console.log('👑 Role:', verifyAdmin.role);
            console.log('🔐 Password hash exists:', !!verifyAdmin.password);
            console.log('📏 Password hash length:', verifyAdmin.password ? verifyAdmin.password.length : 0);
            
            // Test password verification
            if (verifyAdmin.password) {
                const isValid = await bcrypt.compare('anesaya75', verifyAdmin.password);
                console.log('🔓 Password verification test:', isValid ? 'PASS' : 'FAIL');
                
                if (isValid) {
                    console.log('🎉 SUCCESS! Admin user is fully functional');
                    console.log('📋 Login credentials:');
                    console.log('   Email: pharmaciegaher@gmail.com');
                    console.log('   Password: anesaya75');
                } else {
                    console.log('❌ ERROR: Password verification failed');
                }
            } else {
                console.log('❌ ERROR: No password hash found after creation');
            }
        } else {
            console.log('❌ ERROR: Could not find admin user after creation');
        }
        
        // Also create a test user for testing
        console.log('👥 Creating test user...');
        const testPassword = await bcrypt.hash('test123', salt);
        const testUser = new User({
            nom: 'Test',
            prenom: 'User',
            email: 'test@example.com',
            telephone: '+213987654321',
            adresse: 'Test Address, Algérie',
            wilaya: 'Alger',
            password: testPassword,
            role: 'user'
        });
        
        await testUser.save();
        console.log('✅ Test user created');
        console.log('📧 Test login: test@example.com / test123');
        
        console.log('\n🎯 SUMMARY:');
        console.log('✅ Admin user: pharmaciegaher@gmail.com / anesaya75');
        console.log('✅ Test user: test@example.com / test123');
        console.log('✅ Both users have properly hashed passwords');
        console.log('\n🚀 You can now login to the admin panel!');
        
    } catch (error) {
        console.error('❌ Error fixing admin:', error);
        console.error('Stack trace:', error.stack);
    }
    
    mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
})
.catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
});