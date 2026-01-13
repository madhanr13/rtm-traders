require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getRecordModel } = require('./models/Record');

const app = express();
const PORT = process.env.PORT || 3000;

// JWT Configuration from environment variables
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30m';

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rtm-traders';

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB successfully');
    })
    .catch((error) => {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    });

// User credentials from environment variables
const USERS = {
    [process.env.ADMIN_EMAIL]: {
        password: process.env.ADMIN_PASSWORD_HASH,
        username: process.env.ADMIN_EMAIL,
        name: process.env.ADMIN_NAME
    }
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
});

// JWT Authentication Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// Config endpoint - serves API URL to frontend
app.get('/api/config', (req, res) => {
    res.json({
        apiUrl: process.env.API_URL || `http://localhost:${PORT}`
    });
});

// API Routes (Protected with JWT)

// Get all records (from all monthly collections)
app.get('/api/records', authenticateToken, async (req, res) => {
    try {
        console.log('📊 Fetching all records from MongoDB...');
        
        // Get all collection names that match the pattern records_YYYY_MM
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        const recordCollections = collections
            .filter(col => col.name.startsWith('records_'))
            .map(col => col.name);
        
        console.log('📁 Found collections:', recordCollections);
        
        let allRecords = [];
        
        // Fetch records from each monthly collection
        for (const collectionName of recordCollections) {
            const Model = mongoose.model(collectionName, require('./models/Record').recordSchema, collectionName);
            const records = await Model.find();
            allRecords = allRecords.concat(records);
        }
        
        // Sort by date descending
        allRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        console.log(`✅ Found ${allRecords.length} total records`);
        
        // Transform MongoDB documents to match frontend format
        const formattedRecords = allRecords.map(record => ({
            id: record._id,
            date: record.date,
            vehicleNumber: record.vehicleNumber,
            destination: record.destination,
            weightInTons: record.weightInTons,
            ratePerTon: record.ratePerTon,
            amountSpend: record.amountSpend,
            rateWeFixed: record.rateWeFixed,
            totalProfit: record.totalProfit
        }));
        res.json(formattedRecords);
    } catch (error) {
        console.error('❌ Error reading records:', error);
        res.status(500).json({ error: 'Failed to read records' });
    }
});

// Add new record
app.post('/api/records', authenticateToken, async (req, res) => {
    try {
        console.log('📝 Received POST request to add record:', req.body);
        
        // Get the appropriate model for the record's date
        const RecordModel = getRecordModel(req.body.date);
        const collectionName = RecordModel.collection.name;
        console.log(`📁 Using collection: ${collectionName}`);
        
        const newRecord = new RecordModel({
            date: req.body.date,
            vehicleNumber: req.body.vehicleNumber,
            destination: req.body.destination,
            weightInTons: parseFloat(req.body.weightInTons),
            ratePerTon: parseFloat(req.body.ratePerTon),
            amountSpend: parseFloat(req.body.amountSpend),
            rateWeFixed: parseFloat(req.body.rateWeFixed),
            totalProfit: parseFloat(req.body.totalProfit)
        });
        
        console.log('💾 Attempting to save record to MongoDB...');
        const savedRecord = await newRecord.save();
        console.log('✅ Record saved successfully:', savedRecord._id);
        
        // Format response to match frontend expectations
        const formattedRecord = {
            id: savedRecord._id,
            date: savedRecord.date,
            vehicleNumber: savedRecord.vehicleNumber,
            destination: savedRecord.destination,
            weightInTons: savedRecord.weightInTons,
            ratePerTon: savedRecord.ratePerTon,
            amountSpend: savedRecord.amountSpend,
            rateWeFixed: savedRecord.rateWeFixed,
            totalProfit: savedRecord.totalProfit
        };
        
        res.json(formattedRecord);
    } catch (error) {
        console.error('❌ Error adding record:', error);
        console.error('Error details:', error.message);
        res.status(500).json({ error: 'Failed to add record', details: error.message });
    }
});

// Update record
app.put('/api/records/:id', authenticateToken, async (req, res) => {
    try {
        const recordId = req.params.id;
        
        // Get the appropriate model for the new date
        const RecordModel = getRecordModel(req.body.date);
        console.log(`📝 Updating record in collection: ${RecordModel.collection.name}`);
        
        const updatedRecord = await RecordModel.findByIdAndUpdate(
            recordId,
            {
                date: req.body.date,
                vehicleNumber: req.body.vehicleNumber,
                destination: req.body.destination,
                weightInTons: parseFloat(req.body.weightInTons),
                ratePerTon: parseFloat(req.body.ratePerTon),
                amountSpend: parseFloat(req.body.amountSpend),
                rateWeFixed: parseFloat(req.body.rateWeFixed),
                totalProfit: parseFloat(req.body.totalProfit)
            },
            { new: true }
        );
        
        if (!updatedRecord) {
            return res.status(404).json({ error: 'Record not found' });
        }
        
        // Format response
        const formattedRecord = {
            id: updatedRecord._id,
            date: updatedRecord.date,
            vehicleNumber: updatedRecord.vehicleNumber,
            destination: updatedRecord.destination,
            weightInTons: updatedRecord.weightInTons,
            ratePerTon: updatedRecord.ratePerTon,
            amountSpend: updatedRecord.amountSpend,
            rateWeFixed: updatedRecord.rateWeFixed,
            totalProfit: updatedRecord.totalProfit
        };
        
        res.json(formattedRecord);
    } catch (error) {
        console.error('Error updating record:', error);
        res.status(500).json({ error: 'Failed to update record' });
    }
});

// Delete record
app.delete('/api/records/:id', authenticateToken, async (req, res) => {
    try {
        const recordId = req.params.id;
        
        // Try to find and delete from all monthly collections
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        const recordCollections = collections
            .filter(col => col.name.startsWith('records_'))
            .map(col => col.name);
        
        let deletedRecord = null;
        
        for (const collectionName of recordCollections) {
            const Model = mongoose.model(collectionName, require('./models/Record').recordSchema, collectionName);
            deletedRecord = await Model.findByIdAndDelete(recordId);
            if (deletedRecord) {
                console.log(`🗑️  Record deleted from collection: ${collectionName}`);
                break;
            }
        }
        
        if (!deletedRecord) {
            return res.status(404).json({ error: 'Record not found' });
        }
        
        res.json({ message: 'Record deleted successfully' });
    } catch (error) {
        console.error('Error deleting record:', error);
        res.status(500).json({ error: 'Failed to delete record' });
    }
});

// Authentication endpoints
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    // Check if user exists
    const user = USERS[username];
    
    if (!user) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
        { 
            username: user.username,
            name: user.name
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
    
    res.json({ 
        success: true, 
        token,
        user: {
            username: user.username,
            name: user.name
        }
    });
});

// Verify token endpoint
app.get('/api/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 RTM Traders Dashboard Server Running!`);
    console.log(`📊 Server: http://localhost:${PORT}`);
    console.log(`💾 Database: MongoDB (${MONGODB_URI})`);
    console.log(`\nOpen http://localhost:${PORT} in your browser\n`);
});
