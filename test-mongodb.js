require('dotenv').config();
const mongoose = require('mongoose');
const Record = require('./src/models/Record');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rtm-traders';

console.log('Testing MongoDB Connection...');
console.log('URI:', MONGODB_URI.replace(/:[^:@]+@/, ':****@')); // Hide password

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('✅ Connected to MongoDB successfully\n');
        
        // Test creating a record
        console.log('📝 Creating test record...');
        const testRecord = new Record({
            date: '2026-01-13',
            vehicleNumber: 'TEST-123',
            city: 'Chennai',
            destination: 'Bangalore',
            weightInTons: 25,
            ratePerTon: 800,
            amountSpend: 20000,
            rateWeFixed: 900,
            extraSpend: 500,
            totalProfit: 2000
        });
        
        const savedRecord = await testRecord.save();
        console.log('✅ Test record saved successfully!');
        console.log('Record ID:', savedRecord._id);
        console.log('Vehicle:', savedRecord.vehicleNumber);
        
        // Fetch all records
        console.log('\n📊 Fetching all records...');
        const allRecords = await Record.find();
        console.log(`✅ Found ${allRecords.length} record(s) in database`);
        
        allRecords.forEach((record, index) => {
            console.log(`\nRecord ${index + 1}:`);
            console.log('  ID:', record._id);
            console.log('  Vehicle:', record.vehicleNumber);
            console.log('  Date:', record.date);
            console.log('  City:', record.city, '→', record.destination);
            console.log('  Profit: ₹', record.totalProfit);
        });
        
        // Clean up test record
        console.log('\n🗑️  Cleaning up test record...');
        await Record.findByIdAndDelete(savedRecord._id);
        console.log('✅ Test record deleted');
        
        console.log('\n✅ All tests passed! MongoDB is working correctly.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ MongoDB connection error:', error.message);
        process.exit(1);
    });
