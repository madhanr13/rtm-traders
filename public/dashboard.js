// Dashboard Logic with CSV Backend Storage
let API_URL = 'http://localhost:3000/api'; // Default fallback
let businessRecords = [];
let revenueChart, expenseChart;
let dataSortOrder = 'date-desc';

// Fetch API URL from server config
async function fetchConfig() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        API_URL = config.apiUrl + '/api';
    } catch (error) {
        console.warn('Could not fetch config, using default:', error);
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    // Fetch API configuration first
    await fetchConfig();
    // Check JWT authentication
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }
    
    // Verify token is valid
    const isValid = await verifyToken(token);
    if (!isValid) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('username');
        localStorage.removeItem('userName');
        window.location.href = 'index.html';
        return;
    }
    
    // Initialize theme
    initializeTheme();
    
    // Load data from CSV via API
    loadDataFromCSV();
    
    // Initialize dashboard
    initializeDashboard();
    
    // Set up event listeners
    setupEventListeners();
});

// Verify JWT token
async function verifyToken(token) {
    try {
        const response = await fetch(`${API_URL}/verify`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.ok;
    } catch (error) {
        console.error('Token verification error:', error);
        return false;
    }
}

// Get auth headers for API requests
function getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

async function loadDataFromCSV() {
    try {
        const response = await fetch(`${API_URL}/records`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                // Token expired or invalid
                localStorage.removeItem('authToken');
                window.location.href = 'index.html';
                return;
            }
            throw new Error('Failed to load data');
        }
        
        businessRecords = await response.json();
        renderRecords();
        updateStatistics();
        initializeCharts();
    } catch (error) {
        console.error('Error loading data:', error);
        businessRecords = [];
        renderRecords();
        updateStatistics();
        initializeCharts();
    }
}

async function saveRecordToCSV(record, isUpdate = false) {
    try {
        const url = isUpdate ? `${API_URL}/records/${record.id}` : `${API_URL}/records`;
        const method = isUpdate ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: getAuthHeaders(),
            body: JSON.stringify(record)
        });
        
        if (!response.ok) throw new Error('Failed to save record');
        
        return await response.json();
    } catch (error) {
        console.error('Error saving record:', error);
        showNotification('Failed to save record. Please check server connection.', 'error');
        throw error;
    }
}

async function deleteRecordFromCSV(id) {
    try {
        const response = await fetch(`${API_URL}/records/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        if (!response.ok) throw new Error('Failed to delete record');
        
        return await response.json();
    } catch (error) {
        console.error('Error deleting record:', error);
        showNotification('Failed to delete record. Please check server connection.', 'error');
        throw error;
    }
}

function initializeDashboard() {
    // Set user name
    const userName = localStorage.getItem('username') || 'Admin';
    const userNameEl = document.getElementById('userName');
    if (userNameEl) {
        userNameEl.textContent = userName.charAt(0).toUpperCase() + userName.slice(1);
    }
    
    // Set current date and update daily
    updateCurrentDate();
    // Update date every minute
    setInterval(updateCurrentDate, 60000);
    
    // Logout functionality
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            openLogoutModal();
        });
    }
}

// Logout Modal Functions
function openLogoutModal() {
    const modal = document.getElementById('logoutModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }
}

function closeLogoutModal() {
    const modal = document.getElementById('logoutModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 300);
    }
}

function confirmLogout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    localStorage.removeItem('userName');
    window.location.href = 'index.html';
}

function updateCurrentDate() {
    const dateDisplay = document.getElementById('currentDate');
    if (dateDisplay) {
        const today = new Date();
        const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
        dateDisplay.textContent = today.toLocaleDateString('en-US', options);
    }
}

function setupEventListeners() {
    // Add Record Button
    const addRecordBtn = document.getElementById('addRecordBtn');
    if (addRecordBtn) {
        addRecordBtn.addEventListener('click', function(e) {
            e.preventDefault();
            openAddRecordModal();
        });
    }
    
    // Export Button
    const exportDataBtn = document.getElementById('exportDataBtn');
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', function(e) {
            e.preventDefault();
            exportDataToCSV();
        });
    }
    
    // Sort Dropdown
    const sortData = document.getElementById('sortData');
    if (sortData) {
        sortData.addEventListener('change', function(e) {
            dataSortOrder = e.target.value;
            renderRecords();
        });
    }
    
    // Form Submission
    const recordForm = document.getElementById('recordForm');
    if (recordForm) {
        recordForm.addEventListener('submit', handleRecordFormSubmit);
    }
    
    // Theme toggle button
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Time range dropdown filter for charts
    const chartTimeRange = document.getElementById('chartTimeRange');
    if (chartTimeRange) {
        chartTimeRange.addEventListener('change', function() {
            updateCharts();
        });
    }
    
    // Auto-calculate profit when weight or rate changes
    const weightInTons = document.getElementById('weightInTons');
    const ratePerTon = document.getElementById('ratePerTon');
    const rateWeFixed = document.getElementById('rateWeFixed');
    const totalProfit = document.getElementById('totalProfit');
    
    if (weightInTons && ratePerTon && rateWeFixed && totalProfit) {
        const calculateProfit = () => {
            const weight = parseFloat(weightInTons.value) || 0;
            const ratePurchase = parseFloat(ratePerTon.value) || 0;
            const rateSelling = parseFloat(rateWeFixed.value) || 0;
            totalProfit.value = (weight * (rateSelling - ratePurchase)).toFixed(2);
        };
        
        weightInTons.addEventListener('input', calculateProfit);
        ratePerTon.addEventListener('input', calculateProfit);
        rateWeFixed.addEventListener('input', calculateProfit);
    }
    
    // Close modal on outside click
    window.addEventListener('click', function(event) {
        const recordModal = document.getElementById('recordModal');
        if (event.target === recordModal) {
            closeRecordModal();
        }
    });
}

// Format currency in Indian Rupees
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// Update Statistics
function updateStatistics() {
    const totalProfit = businessRecords.reduce((sum, record) => sum + record.totalProfit, 0);
    const totalInvestment = businessRecords.reduce((sum, record) => sum + record.amountSpend, 0);
    const totalLoads = businessRecords.length;
    const totalExtraSpend = businessRecords.reduce((sum, record) => sum + record.extraSpend, 0);
    
    // Animate statistics
    animateValue(document.getElementById('totalProfit'), 0, totalProfit, 1500);
    animateValue(document.getElementById('totalInvestment'), 0, totalInvestment, 1500);
    animateValue(document.getElementById('totalLoads'), 0, totalLoads, 1500);
    animateValue(document.getElementById('driverExtras'), 0, totalExtraSpend, 1500);
}

function animateValue(element, start, end, duration) {
    if (!element) return;
    
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = progress * (end - start) + start;
        
        if (element.id === 'totalLoads') {
            element.textContent = Math.floor(value);
        } else {
            element.textContent = formatCurrency(Math.floor(value));
        }
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Render Business Records
function renderRecords() {
    const tbody = document.getElementById('dataRecords');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Update record count
    const recordCountElem = document.getElementById('recordCount');
    if (recordCountElem) {
        const count = businessRecords.length;
        recordCountElem.textContent = `${count} record${count !== 1 ? 's' : ''}`;
    }
    
    // Check if no data
    if (businessRecords.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td colspan="10" class="no-data-state">
                <div>
                    <i class="fas fa-database no-data-icon"></i>
                    <h3>No Records Found</h3>
                    <p>Start adding business records to track your performance</p>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
        return;
    }
    
    // Sort the data
    const sortedRecords = sortData([...businessRecords], dataSortOrder);
    
    sortedRecords.forEach(record => {
        const tr = document.createElement('tr');
        const profit = parseFloat(record.totalProfit);
        const profitClass = profit >= 0 ? 'profit-positive' : 'profit-negative';
        
        tr.innerHTML = `
            <td>${formatDate(record.date)}</td>
            <td><strong>${record.vehicleNumber}</strong></td>
            <td>${record.city}</td>
            <td>${record.destination}</td>
            <td>${parseFloat(record.weightInTons).toFixed(3)} × ${formatCurrency(record.ratePerTon)}</td>
            <td>${formatCurrency(record.amountSpend)}</td>
            <td>${formatCurrency(record.rateWeFixed)}</td>
            <td>${formatCurrency(record.extraSpend)}</td>
            <td class="${profitClass}"><strong>${formatCurrency(record.totalProfit)}</strong></td>
            <td style="text-align: center;">
                <i class="fas fa-edit edit-icon" onclick="editRecord(${record.id})"></i>
                <i class="fas fa-trash delete-icon" onclick="deleteRecord(${record.id})"></i>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Sort data function
function sortData(data, sortOrder) {
    const [field, direction] = sortOrder.split('-');
    
    return data.sort((a, b) => {
        let compareA, compareB;
        
        if (field === 'date') {
            compareA = new Date(a.date);
            compareB = new Date(b.date);
        } else if (field === 'profit') {
            compareA = a.profit;
            compareB = b.profit;
        }
        
        if (direction === 'asc') {
            return compareA > compareB ? 1 : -1;
        } else {
            return compareA < compareB ? 1 : -1;
        }
    });
}

// Modal Functions for Records
function openAddRecordModal() {
    document.getElementById('recordModalTitle').textContent = 'Add Record';
    document.getElementById('recordForm').reset();
    document.getElementById('recordId').value = '';
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('recordDate').value = today;
    document.getElementById('recordModal').classList.add('active');
}

function closeRecordModal() {
    document.getElementById('recordModal').classList.remove('active');
}

window.closeRecordModal = closeRecordModal;

function editRecord(id) {
    const record = businessRecords.find(r => r.id === id);
    if (!record) return;
    
    document.getElementById('recordModalTitle').textContent = 'Edit Record';
    document.getElementById('recordId').value = record.id;
    document.getElementById('recordDate').value = record.date;
    document.getElementById('vehicleNumber').value = record.vehicleNumber;
    document.getElementById('city').value = record.city;
    document.getElementById('destination').value = record.destination;
    document.getElementById('weightInTons').value = record.weightInTons;
    document.getElementById('ratePerTon').value = record.ratePerTon;
    document.getElementById('amountSpend').value = record.amountSpend;
    document.getElementById('rateWeFixed').value = record.rateWeFixed;
    document.getElementById('extraSpend').value = record.extraSpend;
    document.getElementById('totalProfit').value = record.totalProfit;
    document.getElementById('recordModal').classList.add('active');
}

window.editRecord = editRecord;

async function deleteRecord(id) {
    if (confirm('Are you sure you want to delete this record?')) {
        try {
            await deleteRecordFromCSV(id);
            businessRecords = businessRecords.filter(r => r.id !== id);
            renderRecords();
            updateStatistics();
            updateCharts();
        } catch (error) {
            console.error('Delete failed:', error);
        }
    }
}

window.deleteRecord = deleteRecord;

async function handleRecordFormSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('recordId').value;
    const date = document.getElementById('recordDate').value;
    const vehicleNumber = document.getElementById('vehicleNumber').value;
    const city = document.getElementById('city').value;
    const destination = document.getElementById('destination').value;
    const weightInTons = parseFloat(document.getElementById('weightInTons').value);
    const ratePerTon = parseFloat(document.getElementById('ratePerTon').value);
    const amountSpend = parseFloat(document.getElementById('amountSpend').value);
    const rateWeFixed = parseFloat(document.getElementById('rateWeFixed').value);
    const extraSpend = parseFloat(document.getElementById('extraSpend').value);
    const totalProfit = parseFloat(document.getElementById('totalProfit').value);
    
    const recordData = { date, vehicleNumber, city, destination, weightInTons, ratePerTon, amountSpend, rateWeFixed, extraSpend, totalProfit };
    
    try {
        if (id) {
            // Edit existing record
            recordData.id = parseInt(id);
            await saveRecordToCSV(recordData, true);
            
            const record = businessRecords.find(r => r.id === parseInt(id));
            if (record) {
                record.date = date;
                record.vehicleNumber = vehicleNumber;
                record.city = city;
                record.destination = destination;
                record.weightInTons = weightInTons;
                record.ratePerTon = ratePerTon;
                record.amountSpend = amountSpend;
                record.rateWeFixed = rateWeFixed;
                record.extraSpend = extraSpend;
                record.totalProfit = totalProfit;
            }
        } else {
            // Add new record
            const savedRecord = await saveRecordToCSV(recordData, false);
            businessRecords.push(savedRecord);
        }
        
        renderRecords();
        updateStatistics();
        updateCharts();
        closeRecordModal();
    } catch (error) {
        console.error('Save failed:', error);
    }
}

// Export to CSV Function
function exportDataToCSV() {
    const headers = ['Date', 'Vehicle Number', 'City', 'Destination', 'Weight (Tons)', 'Rate per Ton', 'Amount Spend', 'Rate Fixed', 'Extra Spend', 'Total Profit'];
    const rows = businessRecords.map(record => [
        record.date,
        record.vehicleNumber,
        record.city,
        record.destination,
        record.weightInTons,
        record.ratePerTon,
        record.amountSpend,
        record.rateWeFixed,
        record.extraSpend,
        record.totalProfit
    ]);
    
    const timestamp = new Date().toISOString().split('T')[0];
    downloadCSV(`business_records_${timestamp}.csv`, headers, rows);
}

function downloadCSV(filename, headers, rows) {
    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
        csvContent += row.map(cell => {
            // Escape commas and quotes in cell content
            if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
                return '"' + cell.replace(/"/g, '""') + '"';
            }
            return cell;
        }).join(',') + '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Initialize Charts
function initializeCharts() {
    // Revenue & Profit Chart
    const revenueCtx = document.getElementById('revenueChart');
    if (revenueCtx) {
        revenueChart = new Chart(revenueCtx.getContext('2d'), {
            type: 'line',
            data: getRevenueChartData(),
            options: getRevenueChartOptions()
        });
    }
    
    // Expense Distribution Chart
    const expenseCtx = document.getElementById('expenseChart');
    if (expenseCtx) {
        expenseChart = new Chart(expenseCtx.getContext('2d'), {
            type: 'doughnut',
            data: getExpenseChartData(),
            options: getExpenseChartOptions()
        });
    }
}

function updateCharts() {
    if (revenueChart) {
        revenueChart.data = getRevenueChartData();
        revenueChart.update();
    }
    
    if (expenseChart) {
        expenseChart.data = getExpenseChartData();
        expenseChart.update();
    }
}

function getRevenueChartData() {
    // Get time range from dropdown
    const timeRange = document.getElementById('chartTimeRange')?.value || '6';
    
    // Calculate date range based on selection
    const today = new Date();
    let startDate = new Date();
    
    if (timeRange === 'all') {
        startDate = new Date(1970, 0, 1); // Very old date to get all records
    } else {
        const months = parseInt(timeRange);
        startDate = new Date(today.getFullYear(), today.getMonth() - months, today.getDate());
    }
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    
    // Filter records by date range
    const filteredRecords = businessRecords.filter(record => {
        return record.date >= startDateStr && record.date <= todayStr;
    });
    
    // Group data by month
    const monthlyData = {};
    
    filteredRecords.forEach(record => {
        const month = record.date.substring(0, 7); // YYYY-MM
        if (!monthlyData[month]) {
            monthlyData[month] = { loads: 0, profit: 0 };
        }
        monthlyData[month].loads += 1;
        monthlyData[month].profit += record.totalProfit;
    });
    
    // Get all months and sort
    const months = Object.keys(monthlyData).sort();
    const labels = months.map(m => {
        const date = new Date(m + '-01');
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    });
    
    const loadsData = months.map(m => monthlyData[m].loads);
    const profitData = months.map(m => monthlyData[m].profit);
    
    return {
        labels: labels.length > 0 ? labels : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [{
            label: 'Lorry Loads',
            data: loadsData.length > 0 ? loadsData : [12, 15, 13, 18, 20, 22],
            borderColor: 'rgb(99, 102, 241)',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            tension: 0.4,
            fill: true,
            borderWidth: 3,
            pointRadius: 5,
            pointBackgroundColor: 'rgb(99, 102, 241)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            yAxisID: 'y'
        }, {
            label: 'Profit',
            data: profitData.length > 0 ? profitData : [150000, 180000, 160000, 220000, 250000, 280000],
            borderColor: 'rgb(16, 185, 129)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.4,
            fill: true,
            borderWidth: 3,
            pointRadius: 5,
            pointBackgroundColor: 'rgb(16, 185, 129)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            yAxisID: 'y1'
        }]
    };
}

function getRevenueChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    color: '#94a3b8',
                    usePointStyle: true,
                    padding: 20,
                    font: {
                        size: 12,
                        weight: '600'
                    }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                padding: 12,
                titleColor: '#f1f5f9',
                bodyColor: '#f1f5f9',
                borderColor: '#334155',
                borderWidth: 1,
                displayColors: true,
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.dataset.yAxisID === 'y') {
                            label += context.parsed.y + ' loads';
                        } else {
                            label += formatCurrency(context.parsed.y);
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                beginAtZero: true,
                grid: {
                    color: 'rgba(51, 65, 85, 0.5)',
                    drawBorder: false
                },
                ticks: {
                    color: '#94a3b8',
                    stepSize: 1,
                    callback: function(value) {
                        return value;
                    }
                },
                title: {
                    display: true,
                    text: 'Lorry Loads',
                    color: '#94a3b8'
                }
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                beginAtZero: true,
                grid: {
                    drawOnChartArea: false,
                },
                ticks: {
                    color: '#94a3b8',
                    callback: function(value) {
                        return '₹' + (value / 1000) + 'K';
                    }
                },
                title: {
                    display: true,
                    text: 'Profit',
                    color: '#94a3b8'
                }
            },
            x: {
                grid: {
                    display: false,
                    drawBorder: false
                },
                ticks: {
                    color: '#94a3b8'
                }
            }
        }
    };
}

function getExpenseChartData() {
    // Get time range from dropdown (same as revenue chart)
    const timeRange = document.getElementById('chartTimeRange')?.value || '6';
    
    // Calculate date range based on selection
    const today = new Date();
    let startDate = new Date();
    
    if (timeRange === 'all') {
        startDate = new Date(1970, 0, 1);
    } else {
        const months = parseInt(timeRange);
        startDate = new Date(today.getFullYear(), today.getMonth() - months, today.getDate());
    }
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    
    // Filter records by date range
    const filteredRecords = businessRecords.filter(record => {
        return record.date >= startDateStr && record.date <= todayStr;
    });
    
    // Calculate totals for pie chart
    const totalAmountSpend = filteredRecords.reduce((sum, r) => sum + r.amountSpend, 0);
    const totalExtraSpend = filteredRecords.reduce((sum, r) => sum + r.extraSpend, 0);
    const totalProfit = filteredRecords.reduce((sum, r) => sum + r.totalProfit, 0);
    
    return {
        labels: ['Amount Spend', 'Extra Spend', 'Profit'],
        datasets: [{
            data: [totalAmountSpend, totalExtraSpend, totalProfit],
            backgroundColor: [
                'rgba(99, 102, 241, 0.8)',
                'rgba(245, 158, 11, 0.8)',
                'rgba(16, 185, 129, 0.8)'
            ],
            borderColor: '#1e293b',
            borderWidth: 3,
            hoverOffset: 10
        }]
    };
}

function getExpenseChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'right',
                labels: {
                    color: '#94a3b8',
                    usePointStyle: true,
                    padding: 15,
                    font: {
                        size: 12,
                        weight: '600'
                    }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                padding: 12,
                titleColor: '#f1f5f9',
                bodyColor: '#f1f5f9',
                borderColor: '#334155',
                borderWidth: 1,
                callbacks: {
                    label: function(context) {
                        let label = context.label || '';
                        if (label) {
                            label += ': ';
                        }
                        label += formatCurrency(context.parsed);
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = ((context.parsed / total) * 100).toFixed(1);
                        label += ' (' + percentage + '%)';
                        return label;
                    }
                }
            }
        }
    };
}

// Notification System
function showNotification(message, type = 'info') {
    // Remove existing notification if any
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Theme Toggle Functionality
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    
    // Update charts with new theme colors
    if (revenueChart && expenseChart) {
        updateChartColors();
    }
}

function updateThemeIcon(theme) {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        const icon = themeToggle.querySelector('i');
        if (icon) {
            icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }
}

function updateChartColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    
    // Update revenue chart colors
    if (revenueChart) {
        revenueChart.options.scales.x.ticks.color = isDark ? '#9aa0a6' : '#5f6368';
        revenueChart.options.scales.x.grid.color = isDark ? '#3c4043' : '#dadce0';
        revenueChart.options.scales.y.ticks.color = isDark ? '#9aa0a6' : '#5f6368';
        revenueChart.options.scales.y1.ticks.color = isDark ? '#9aa0a6' : '#5f6368';
        revenueChart.options.scales.y.grid.color = isDark ? '#3c4043' : '#dadce0';
        revenueChart.options.plugins.legend.labels.color = isDark ? '#e8eaed' : '#202124';
        revenueChart.update();
    }
    
    // Update expense chart colors
    if (expenseChart) {
        expenseChart.options.plugins.legend.labels.color = isDark ? '#e8eaed' : '#202124';
        expenseChart.update();
    }
}

