require('dotenv').config();
const mongoose = require('mongoose');
const Record = require('./src/models/Record');

const MONGODB_URI = process.env.MONGODB_URI;

console.log('🔍 Checking MongoDB Atlas Data...\n');
console.log('Connection URI:', MONGODB_URI.replace(/:[^:@]+@/, ':****@'));
console.log('');

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('✅ Connected to MongoDB Atlas successfully\n');
        
        // Get database and collection info
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        
        console.log('📊 Database:', db.databaseName);
        console.log('📁 Collections:', collections.map(c => c.name).join(', ') || 'None');
        console.log('');
        
        // Count records
        const count = await Record.countDocuments();
        console.log(`📈 Total Records: ${count}`);
        console.log('');
        
        if (count > 0) {
            // Fetch all records
            console.log('📋 All Records:\n');
            const allRecords = await Record.find().sort({ createdAt: -1 });
            
            allRecords.forEach((record, index) => {
                console.log(`Record ${index + 1}:`);
                console.log(`  ID: ${record._id}`);
                console.log(`  Date: ${record.date}`);
                console.log(`  Vehicle: ${record.vehicleNumber}`);
                console.log(`  Route: ${record.city} → ${record.destination}`);
                console.log(`  Weight: ${record.weightInTons} tons`);
                console.log(`  Rate: ₹${record.ratePerTon} → ₹${record.rateWeFixed}`);
                console.log(`  Profit: ₹${record.totalProfit}`);
                console.log(`  Created: ${record.createdAt}`);
                console.log('');
            });
        } else {
            console.log('⚠️  No records found in database!');
            console.log('');
            console.log('Possible reasons:');
            console.log('1. Records are being saved to a different database');
            console.log('2. Form submission is failing silently');
            console.log('3. Server is not receiving the POST request');
        }
        
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Connection error:', error.message);
        process.exit(1);
    });
