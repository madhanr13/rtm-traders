require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// JWT Configuration from environment variables
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30m';

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

const CSV_FILE = path.join(__dirname, '../data.csv');

// Config endpoint - serves API URL to frontend
app.get('/api/config', (req, res) => {
    res.json({
        apiUrl: process.env.API_URL || `http://localhost:${PORT}`
    });
});

// Read all records from CSV
function readRecordsFromCSV() {
    return new Promise((resolve, reject) => {
        const records = [];
        fs.createReadStream(CSV_FILE)
            .pipe(csv())
            .on('data', (row) => {
                records.push({
                    id: parseInt(row.id),
                    date: row.date,
                    vehicleNumber: row.vehicleNumber,
                    city: row.city,
                    destination: row.destination,
                    weightInTons: parseFloat(row.weightInTons),
                    ratePerTon: parseFloat(row.ratePerTon),
                    amountSpend: parseFloat(row.amountSpend),
                    rateWeFixed: parseFloat(row.rateWeFixed),
                    extraSpend: parseFloat(row.extraSpend),
                    totalProfit: parseFloat(row.totalProfit)
                });
            })
            .on('end', () => resolve(records))
            .on('error', reject);
    });
}

// Write records to CSV
function writeRecordsToCSV(records) {
    const csvWriter = createCsvWriter({
        path: CSV_FILE,
        header: [
            { id: 'id', title: 'id' },
            { id: 'date', title: 'date' },
            { id: 'vehicleNumber', title: 'vehicleNumber' },
            { id: 'city', title: 'city' },
            { id: 'destination', title: 'destination' },
            { id: 'weightInTons', title: 'weightInTons' },
            { id: 'ratePerTon', title: 'ratePerTon' },
            { id: 'amountSpend', title: 'amountSpend' },
            { id: 'rateWeFixed', title: 'rateWeFixed' },
            { id: 'extraSpend', title: 'extraSpend' },
            { id: 'totalProfit', title: 'totalProfit' }
        ]
    });

    return csvWriter.writeRecords(records);
}

// API Routes (Protected with JWT)

// Get all records
app.get('/api/records', authenticateToken, async (req, res) => {
    try {
        const records = await readRecordsFromCSV();
        res.json(records);
    } catch (error) {
        console.error('Error reading records:', error);
        res.status(500).json({ error: 'Failed to read records' });
    }
});

// Add new record
app.post('/api/records', authenticateToken, async (req, res) => {
    try {
        const records = await readRecordsFromCSV();
        const newId = records.length > 0 ? Math.max(...records.map(r => r.id)) + 1 : 1;
        
        const newRecord = {
            id: newId,
            date: req.body.date,
            vehicleNumber: req.body.vehicleNumber,
            city: req.body.city,
            destination: req.body.destination,
            weightInTons: parseFloat(req.body.weightInTons),
            ratePerTon: parseFloat(req.body.ratePerTon),
            amountSpend: parseFloat(req.body.amountSpend),
            rateWeFixed: parseFloat(req.body.rateWeFixed),
            extraSpend: parseFloat(req.body.extraSpend),
            totalProfit: parseFloat(req.body.totalProfit)
        };
        
        records.push(newRecord);
        await writeRecordsToCSV(records);
        
        res.json(newRecord);
    } catch (error) {
        console.error('Error adding record:', error);
        res.status(500).json({ error: 'Failed to add record' });
    }
});

// Update record
app.put('/api/records/:id', authenticateToken, async (req, res) => {
    try {
        const records = await readRecordsFromCSV();
        const recordId = parseInt(req.params.id);
        const index = records.findIndex(r => r.id === recordId);
        
        if (index === -1) {
            return res.status(404).json({ error: 'Record not found' });
        }
        
        records[index] = {
            id: recordId,
            date: req.body.date,
            vehicleNumber: req.body.vehicleNumber,
            city: req.body.city,
            destination: req.body.destination,
            weightInTons: parseFloat(req.body.weightInTons),
            ratePerTon: parseFloat(req.body.ratePerTon),
            amountSpend: parseFloat(req.body.amountSpend),
            rateWeFixed: parseFloat(req.body.rateWeFixed),
            extraSpend: parseFloat(req.body.extraSpend),
            totalProfit: parseFloat(req.body.totalProfit)
        };
        
        await writeRecordsToCSV(records);
        res.json(records[index]);
    } catch (error) {
        console.error('Error updating record:', error);
        res.status(500).json({ error: 'Failed to update record' });
    }
});

// Delete record
app.delete('/api/records/:id', authenticateToken, async (req, res) => {
    try {
        const records = await readRecordsFromCSV();
        const recordId = parseInt(req.params.id);
        const filteredRecords = records.filter(r => r.id !== recordId);
        
        if (filteredRecords.length === records.length) {
            return res.status(404).json({ error: 'Record not found' });
        }
        
        await writeRecordsToCSV(filteredRecords);
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
    console.log(`📁 CSV File: ${CSV_FILE}`);
    console.log(`\nOpen http://localhost:${PORT}/index.html in your browser\n`);
});
