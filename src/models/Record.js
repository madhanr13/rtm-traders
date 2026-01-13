const mongoose = require('mongoose');

const recordSchema = new mongoose.Schema({
    date: {
        type: String,
        required: true
    },
    vehicleNumber: {
        type: String,
        required: true
    },
    destination: {
        type: String,
        required: true
    },
    weightInTons: {
        type: Number,
        required: true
    },
    ratePerTon: {
        type: Number,
        required: true
    },
    amountSpend: {
        type: Number,
        required: true
    },
    rateWeFixed: {
        type: Number,
        required: true
    },
    totalProfit: {
        type: Number,
        required: true
    }
}, {
    timestamps: true
});

// Function to get model for specific month
function getRecordModel(date) {
    const recordDate = new Date(date);
    const year = recordDate.getFullYear();
    const month = String(recordDate.getMonth() + 1).padStart(2, '0');
    const collectionName = `records_${year}_${month}`;
    
    // Check if model already exists
    if (mongoose.models[collectionName]) {
        return mongoose.models[collectionName];
    }
    
    // Create new model for this month
    return mongoose.model(collectionName, recordSchema, collectionName);
}

module.exports = {
    getRecordModel,
    recordSchema
};
