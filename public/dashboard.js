// ============================================
// RTM TRADERS — Dashboard Application
// Routing, theme, sidebar, pages + all business logic
// ============================================

// ===== STATE =====
let API_URL = 'https://rtm-traders-api.onrender.com';
let businessRecords = [];
let revenueChart, expenseChart, pendingChart;
let dataSortOrder = 'date-desc';
let selectedMonth = 'all';
let searchQuery = '';
let currentPage = 1;
let recordsPerPage = 15;
let pendingDeleteId = null;
let isDataLoaded = false;
let statsHidden = localStorage.getItem('rtm-stats-hidden') === 'true';

// ===== CONFIG =====
async function fetchConfig() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        API_URL = config.apiUrl + '/api';
    } catch (error) {
        console.warn('Could not fetch config, using default:', error);
    }
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async function () {
    await fetchConfig();

    // Auth guard
    const token = localStorage.getItem('authToken');
    if (!token) { window.location.href = 'index.html'; return; }
    const isValid = await verifyToken(token);
    if (!isValid) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('username');
        localStorage.removeItem('userName');
        window.location.href = 'index.html';
        return;
    }

    // Systems
    initTheme();
    initSidebar();
    initHeader();
    initRouter();

    // Data
    await loadDataFromCSV();

    // Global listeners
    setupGlobalListeners();
});

// ===== THEME SYSTEM =====
function initTheme() {
    const stored = localStorage.getItem('rtm-theme');
    applyThemePreference(stored || 'system');
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
        const pref = localStorage.getItem('rtm-theme');
        if (pref === 'system' || !pref) applyThemePreference('system');
    });
}

function applyThemePreference(pref) {
    let resolved;
    if (pref === 'system') {
        resolved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } else {
        resolved = pref;
    }
    document.documentElement.setAttribute('data-theme', resolved);
    updateThemeIcon(resolved);
    updateChartTheme();
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('rtm-theme', next);
    applyThemePreference(next);
}

function setThemePreference(pref) {
    localStorage.setItem('rtm-theme', pref);
    applyThemePreference(pref);
    // Update settings page buttons if visible
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === pref);
    });
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('themeIcon');
    if (icon) icon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
}

function getChartThemeColors() {
    const theme = document.documentElement.getAttribute('data-theme');
    const isDark = theme !== 'light';
    return {
        tooltipBg: isDark ? '#1C2028' : '#FFFFFF',
        tooltipText: isDark ? '#F0F2F5' : '#111318',
        tooltipBorder: isDark ? '#2A2E37' : '#E0E3E8',
        gridColor: isDark ? 'rgba(42,46,55,0.5)' : 'rgba(224,227,232,0.7)',
        tickColor: isDark ? '#5C616B' : '#9CA2AC',
        legendColor: isDark ? '#8B909A' : '#5F6570',
        pointBorderColor: isDark ? '#161A20' : '#FFFFFF',
        chartBorderColor: isDark ? '#161A20' : '#FFFFFF',
    };
}

function updateChartTheme() {
    if (!isDataLoaded) return;
    if (revenueChart) { revenueChart.options = getRevenueChartOptions(); revenueChart.data = getRevenueChartData(); revenueChart.update(); }
    if (expenseChart) { expenseChart.options = getExpenseChartOptions(); expenseChart.data = getExpenseChartData(); expenseChart.update(); }
    if (pendingChart) { pendingChart.options = getPendingChartOptions(); pendingChart.data = getPendingChartData(); pendingChart.update(); }
}

// ===== SIDEBAR =====
function initSidebar() {
    const collapsed = localStorage.getItem('rtm-sidebar-collapsed') === 'true';
    if (collapsed) document.body.classList.add('sidebar-collapsed');

    document.getElementById('sidebarToggle')?.addEventListener('click', toggleDesktopSidebar);
    document.getElementById('menuBtn')?.addEventListener('click', toggleMobileSidebar);
}

function toggleDesktopSidebar() {
    document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('rtm-sidebar-collapsed', document.body.classList.contains('sidebar-collapsed'));
}

function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    sidebar.classList.toggle('mobile-open');
    backdrop.classList.toggle('visible');
}

function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('visible');
}
window.closeMobileSidebar = closeMobileSidebar;

function updateActiveNavItem(page) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
}

// ===== HEADER =====
function initHeader() {
    const userName = localStorage.getItem('username') || 'Admin';
    const displayName = userName.charAt(0).toUpperCase() + userName.slice(1);

    const sidebarName = document.getElementById('sidebarUserName');
    if (sidebarName) sidebarName.textContent = displayName;
    const headerName = document.getElementById('headerUserName');
    if (headerName) headerName.textContent = displayName;

    updateCurrentDate();
    setInterval(updateCurrentDate, 60000);

    document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
    document.getElementById('logoutBtn')?.addEventListener('click', (e) => { e.preventDefault(); openLogoutModal(); });
}

function updateCurrentDate() {
    const el = document.getElementById('currentDate');
    if (el) {
        const today = new Date();
        el.textContent = today.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    }
}

// ===== ROUTER =====
function initRouter() {
    window.addEventListener('hashchange', renderCurrentPage);
    renderCurrentPage();
}

function getCurrentPage() {
    const hash = window.location.hash.replace('#', '') || 'overview';
    return hash;
}

function renderCurrentPage() {
    const page = getCurrentPage();
    updateActiveNavItem(page);

    const breadcrumbPage = document.getElementById('breadcrumbPage');
    const pageTitles = { overview: 'Overview', records: 'Records', settings: 'Settings' };
    if (breadcrumbPage) breadcrumbPage.textContent = pageTitles[page] || 'Overview';

    const content = document.getElementById('appContent');
    if (!content) return;

    // Destroy existing charts before re-rendering
    destroyCharts();

    switch (page) {
        case 'records': renderRecordsPage(content); break;
        case 'settings': renderSettingsPage(content); break;
        default: renderOverviewPage(content); break;
    }

    // FAB visibility — show on all pages for quick access
    updateFAB();
}

// ===== PAGE: OVERVIEW =====
function renderOverviewPage(container) {
    const eyeIcon = statsHidden ? 'fa-eye' : 'fa-eye-slash';
    const hiddenClass = statsHidden ? ' stat-value-hidden' : '';

    container.innerHTML = `
        <div class="page-enter">
            <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                <div>
                    <h1 class="page-title">Overview</h1>
                    <p class="page-description">Business performance at a glance</p>
                </div>
                <button class="stats-toggle-btn" id="statsToggleBtn" onclick="toggleStatsVisibility()" title="${statsHidden ? 'Show' : 'Hide'} values">
                    <i class="fas ${eyeIcon}"></i>
                </button>
            </div>

            <!-- Stat Cards -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                <div class="card stat-card">
                    <div class="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                        <div class="stat-icon" style="background:rgba(16,185,129,0.12);color:#10B981;"><i class="fas fa-indian-rupee-sign"></i></div>
                        <span class="stat-label">Total Profit</span>
                    </div>
                    <div class="stat-value${hiddenClass}" id="statTotalProfit">₹0</div>
                </div>
                <div class="card stat-card">
                    <div class="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                        <div class="stat-icon" style="background:rgba(59,130,246,0.12);color:#3B82F6;"><i class="fas fa-wallet"></i></div>
                        <span class="stat-label">Investment</span>
                    </div>
                    <div class="stat-value${hiddenClass}" id="statTotalInvestment">₹0</div>
                </div>
                <div class="card stat-card">
                    <div class="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                        <div class="stat-icon" style="background:rgba(139,92,246,0.12);color:#8B5CF6;"><i class="fas fa-truck"></i></div>
                        <span class="stat-label">Total Loads</span>
                    </div>
                    <div class="stat-value${hiddenClass}" id="statTotalLoads">0</div>
                </div>
                <div class="card stat-card">
                    <div class="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                        <div class="stat-icon" style="background:rgba(245,158,11,0.12);color:#F59E0B;"><i class="fas fa-clock"></i></div>
                        <span class="stat-label">Pending</span>
                    </div>
                    <div class="stat-value${hiddenClass}" id="statTotalPending">₹0</div>
                </div>
            </div>

            <!-- Charts -->
            <div class="card mb-4 sm:mb-6">
                <div class="card-header">
                    <h2 style="font-size:14px;font-weight:600;color:var(--c-text);">Loads & Profit Trend</h2>
                    <select id="chartTimeRange" class="form-input" style="width:auto;min-width:120px;padding:6px 30px 6px 10px;font-size:12px;">
                        <option value="3">3 Months</option>
                        <option value="6" selected>6 Months</option>
                        <option value="12">12 Months</option>
                        <option value="all">All Time</option>
                    </select>
                </div>
                <div class="card-body" style="height:260px;">
                    <canvas id="revenueChart"></canvas>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div class="card">
                    <div class="card-header">
                        <h2 style="font-size:14px;font-weight:600;color:var(--c-text);">Expense vs Profit</h2>
                    </div>
                    <div class="card-body" style="height:220px;">
                        <canvas id="expenseChart"></canvas>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <h2 style="font-size:14px;font-weight:600;color:var(--c-text);">Payment Status</h2>
                    </div>
                    <div class="card-body" style="height:220px;">
                        <canvas id="pendingChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;

    if (isDataLoaded) {
        updateStatistics();
        setTimeout(initializeCharts, 50);
    }

    // Chart time range listener
    document.getElementById('chartTimeRange')?.addEventListener('change', () => { updateCharts(); });
}

// ===== STATS VISIBILITY TOGGLE =====
function toggleStatsVisibility() {
    statsHidden = !statsHidden;
    localStorage.setItem('rtm-stats-hidden', statsHidden);

    // Update icon
    const btn = document.getElementById('statsToggleBtn');
    if (btn) {
        btn.innerHTML = `<i class="fas ${statsHidden ? 'fa-eye' : 'fa-eye-slash'}"></i>`;
        btn.title = statsHidden ? 'Show values' : 'Hide values';
    }

    // Toggle class on all stat values
    document.querySelectorAll('.stat-value').forEach(el => {
        el.classList.toggle('stat-value-hidden', statsHidden);
    });
}
window.toggleStatsVisibility = toggleStatsVisibility;

// ===== PAGE: RECORDS =====
function renderRecordsPage(container) {
    container.innerHTML = `
        <div class="page-enter">
            <div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                <div>
                    <h1 class="page-title">Records</h1>
                    <p class="page-description" id="recordCount">Loading records…</p>
                </div>
                <div class="toolbar" style="display:flex;gap:6px;">
                    <button id="addRecordBtn" class="btn btn-primary hidden sm:inline-flex"><i class="fas fa-plus"></i> Add Record</button>
                    <button id="exportDataBtn" class="btn btn-secondary"><i class="fas fa-download"></i> <span class="hidden sm:inline">Export</span></button>
                </div>
            </div>

            <!-- Filters -->
            <div class="card mb-3">
                <div class="mobile-filter-grid" style="padding:12px 16px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
                    <input type="text" id="searchInput" class="form-input form-input-search search-full" placeholder="Search vehicle, company, date…" style="max-width:280px;flex:1;min-width:160px;">
                    <select id="monthFilter" class="form-input" style="width:auto;min-width:130px;padding:9px 30px 9px 12px;flex:1;">
                        <option value="all">All Months</option>
                    </select>
                    <select id="sortData" class="form-input" style="width:auto;min-width:120px;padding:9px 30px 9px 12px;flex:1;">
                        <option value="date-desc">Newest</option>
                        <option value="date-asc">Oldest</option>
                        <option value="profit-desc">Profit ↓</option>
                        <option value="profit-asc">Profit ↑</option>
                    </select>
                    <select id="perPageSelect" class="form-input hidden sm:block" style="width:auto;min-width:90px;padding:9px 30px 9px 12px;">
                        <option value="10">10</option>
                        <option value="15" selected>15</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                    </select>
                </div>
            </div>

            <!-- Desktop Table -->
            <div class="card desktop-table" style="overflow:hidden;">
                <div style="overflow-x:auto;">
                    <table class="data-table" id="recordsTable">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Vehicle</th>
                                <th>Company</th>
                                <th>Weight × Rate</th>
                                <th>Amt Spent</th>
                                <th>Rate Fixed</th>
                                <th>Profit</th>
                                <th style="text-align:center;">Status</th>
                                <th style="text-align:center;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="dataRecords">
                        </tbody>
                    </table>
                </div>
                <div id="paginationContainer"></div>
            </div>

            <!-- Mobile Cards -->
            <div class="card" style="overflow:hidden;display:none;" id="mobileRecordsCard">
                <div class="record-cards-container" id="mobileRecords"></div>
                <div id="mobilePaginationContainer"></div>
            </div>
        </div>
    `;

    // Show mobile card container on mobile
    if (window.innerWidth < 768) {
        const mobileCard = document.getElementById('mobileRecordsCard');
        if (mobileCard) mobileCard.style.display = 'block';
    }

    // Attach listeners
    document.getElementById('addRecordBtn')?.addEventListener('click', (e) => { e.preventDefault(); openAddRecordModal(); });
    document.getElementById('exportDataBtn')?.addEventListener('click', (e) => { e.preventDefault(); exportDataToCSV(); });
    document.getElementById('sortData')?.addEventListener('change', (e) => { dataSortOrder = e.target.value; currentPage = 1; renderRecords(); });
    document.getElementById('monthFilter')?.addEventListener('change', (e) => { selectedMonth = e.target.value; currentPage = 1; renderRecords(); });
    document.getElementById('searchInput')?.addEventListener('input', (e) => { searchQuery = e.target.value.trim().toLowerCase(); currentPage = 1; renderRecords(); });
    document.getElementById('perPageSelect')?.addEventListener('change', (e) => { recordsPerPage = parseInt(e.target.value); currentPage = 1; renderRecords(); });

    // Restore current filter state
    const sortEl = document.getElementById('sortData');
    if (sortEl) sortEl.value = dataSortOrder;
    const perPageEl = document.getElementById('perPageSelect');
    if (perPageEl) perPageEl.value = String(recordsPerPage);
    const searchEl = document.getElementById('searchInput');
    if (searchEl) searchEl.value = searchQuery;

    if (isDataLoaded) {
        populateMonthFilter();
        const mfEl = document.getElementById('monthFilter');
        if (mfEl) mfEl.value = selectedMonth;
        renderRecords();
    }
}

// ===== PAGE: SETTINGS =====
function renderSettingsPage(container) {
    const storedPref = localStorage.getItem('rtm-theme') || 'system';
    const userName = localStorage.getItem('username') || 'Admin';
    const displayName = userName.charAt(0).toUpperCase() + userName.slice(1);

    container.innerHTML = `
        <div class="page-enter">
            <div class="page-header">
                <h1 class="page-title">Settings</h1>
                <p class="page-description">Customize your dashboard experience</p>
            </div>

            <div class="settings-section">
                <div class="settings-section-title">Appearance</div>
                <div class="setting-row">
                    <div>
                        <div class="setting-label">Theme</div>
                        <div class="setting-description">Select your preferred color scheme</div>
                    </div>
                    <div class="theme-btn-group">
                        <button class="theme-btn ${storedPref === 'light' ? 'active' : ''}" data-theme="light" onclick="setThemePreference('light')"><i class="fas fa-sun" style="margin-right:4px;"></i> Light</button>
                        <button class="theme-btn ${storedPref === 'dark' ? 'active' : ''}" data-theme="dark" onclick="setThemePreference('dark')"><i class="fas fa-moon" style="margin-right:4px;"></i> Dark</button>
                        <button class="theme-btn ${storedPref === 'system' ? 'active' : ''}" data-theme="system" onclick="setThemePreference('system')"><i class="fas fa-desktop" style="margin-right:4px;"></i> System</button>
                    </div>
                </div>
                <div class="setting-row">
                    <div>
                        <div class="setting-label">Sidebar</div>
                        <div class="setting-description">Toggle the sidebar collapsed state</div>
                    </div>
                    <button class="btn btn-secondary btn-sm" onclick="toggleDesktopSidebar()"><i class="fas fa-sidebar"></i> Toggle</button>
                </div>
            </div>

            <div class="settings-section">
                <div class="settings-section-title">Account</div>
                <div class="setting-row">
                    <div>
                        <div class="setting-label">Signed in as</div>
                        <div class="setting-description">${displayName}</div>
                    </div>
                    <button class="btn btn-danger btn-sm" onclick="openLogoutModal()"><i class="fas fa-right-from-bracket"></i> Sign Out</button>
                </div>
            </div>

            <div class="settings-section">
                <div class="settings-section-title">Data</div>
                <div class="setting-row">
                    <div>
                        <div class="setting-label">Export Records</div>
                        <div class="setting-description">Download all business records as CSV</div>
                    </div>
                    <button class="btn btn-secondary btn-sm" onclick="exportDataToCSV()"><i class="fas fa-download"></i> Export CSV</button>
                </div>
                <div class="setting-row">
                    <div>
                        <div class="setting-label">Total Records</div>
                        <div class="setting-description">Records stored in the database</div>
                    </div>
                    <span class="badge badge-info">${businessRecords.length} records</span>
                </div>
            </div>
        </div>
    `;
}

// ===== AUTH / API =====
async function verifyToken(token) {
    try {
        const response = await fetch(`${API_URL}/verify`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.ok;
    } catch (error) {
        console.error('Token verification error:', error);
        return false;
    }
}

function getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

async function loadDataFromCSV() {
    try {
        const response = await fetch(`${API_URL}/records`, { headers: getAuthHeaders() });
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('authToken');
                window.location.href = 'index.html';
                return;
            }
            throw new Error('Failed to load data');
        }
        businessRecords = await response.json();
    } catch (error) {
        console.error('Error loading data:', error);
        businessRecords = [];
    }
    isDataLoaded = true;
    renderCurrentPage();
}

async function saveRecordToCSV(record, isUpdate = false) {
    try {
        const url = isUpdate ? `${API_URL}/records/${record.id}` : `${API_URL}/records`;
        const method = isUpdate ? 'PUT' : 'POST';
        const response = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(record) });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorData.error || 'Failed to save record');
        }
        return await response.json();
    } catch (error) {
        console.error('Error saving record:', error);
        showNotification(`Failed to save record: ${error.message}`, 'error');
        throw error;
    }
}

async function deleteRecordFromCSV(id) {
    try {
        const response = await fetch(`${API_URL}/records/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Failed to delete record');
        return await response.json();
    } catch (error) {
        console.error('Error deleting record:', error);
        showNotification('Failed to delete record. Please check server connection.', 'error');
        throw error;
    }
}

// ===== DATA HELPERS =====
function populateMonthFilter() {
    const monthFilter = document.getElementById('monthFilter');
    if (!monthFilter) return;
    const monthsSet = new Set();
    businessRecords.forEach(record => {
        const date = new Date(record.date);
        monthsSet.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    });
    const months = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
    monthFilter.innerHTML = '<option value="all">All Months</option>';
    months.forEach(my => {
        const [y, m] = my.split('-');
        const d = new Date(y, parseInt(m) - 1);
        const option = document.createElement('option');
        option.value = my;
        option.textContent = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        monthFilter.appendChild(option);
    });
}

function sortData(data, sortOrder) {
    const [field, direction] = sortOrder.split('-');
    return data.sort((a, b) => {
        let cA, cB;
        if (field === 'date') { cA = new Date(a.date); cB = new Date(b.date); }
        else if (field === 'profit') { cA = parseFloat(a.totalProfit); cB = parseFloat(b.totalProfit); }
        return direction === 'asc' ? (cA > cB ? 1 : -1) : (cA < cB ? 1 : -1);
    });
}

function getFilteredRecords() {
    const timeRange = document.getElementById('chartTimeRange')?.value || '6';
    if (timeRange === 'all') return businessRecords;
    const monthsBack = parseInt(timeRange);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - monthsBack);
    return businessRecords.filter(r => new Date(r.date) >= cutoff);
}

// ===== STATISTICS =====
function updateStatistics() {
    const totalProfit = businessRecords.reduce((s, r) => s + r.totalProfit, 0);
    const totalInvestment = businessRecords.reduce((s, r) => s + r.amountSpend, 0);
    const totalLoads = businessRecords.length;
    const totalPending = businessRecords.reduce((s, r) => s + (r.amountReceived ? 0 : ((r.amountSpend || 0) + (r.totalProfit || 0))), 0);

    animateValue(document.getElementById('statTotalProfit'), 0, totalProfit, 1200);
    animateValue(document.getElementById('statTotalInvestment'), 0, totalInvestment, 1200);
    animateValue(document.getElementById('statTotalLoads'), 0, totalLoads, 1200);
    animateValue(document.getElementById('statTotalPending'), 0, totalPending, 1200);
}

function animateValue(element, start, end, duration) {
    if (!element) return;
    // If stats are hidden, set final value silently (for when user reveals later)
    if (statsHidden) {
        element.classList.add('stat-value-hidden');
        if (element.id === 'statTotalLoads') element.textContent = Math.floor(end);
        else element.textContent = formatCurrency(Math.floor(end));
        return;
    }
    let startTs = null;
    const step = (ts) => {
        if (!startTs) startTs = ts;
        const progress = Math.min((ts - startTs) / duration, 1);
        const val = progress * (end - start) + start;
        if (element.id === 'statTotalLoads') {
            element.textContent = Math.floor(val);
        } else {
            element.textContent = formatCurrency(Math.floor(val));
        }
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

// ===== RECORDS TABLE =====
function renderRecords() {
    const tbody = document.getElementById('dataRecords');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Filter by month
    let filtered = businessRecords;
    if (selectedMonth !== 'all') {
        filtered = filtered.filter(r => {
            const d = new Date(r.date);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === selectedMonth;
        });
    }

    // Filter by search
    if (searchQuery) {
        filtered = filtered.filter(r =>
            (r.vehicleNumber || '').toLowerCase().includes(searchQuery) ||
            (r.destination || '').toLowerCase().includes(searchQuery) ||
            (r.date || '').includes(searchQuery) ||
            formatDate(r.date).toLowerCase().includes(searchQuery)
        );
    }

    // Sort
    const sorted = sortData([...filtered], dataSortOrder);

    // Pagination
    const totalRecords = sorted.length;
    const totalPages = Math.ceil(totalRecords / recordsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * recordsPerPage;
    const pageRecords = sorted.slice(start, start + recordsPerPage);

    // Update count
    const countEl = document.getElementById('recordCount');
    if (countEl) {
        if (totalRecords === 0) {
            countEl.textContent = 'No records found';
        } else {
            countEl.textContent = `Showing ${start + 1}–${Math.min(start + recordsPerPage, totalRecords)} of ${totalRecords} record${totalRecords !== 1 ? 's' : ''}`;
        }
    }

    // Empty state
    if (pageRecords.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td colspan="9">
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="fas fa-database"></i></div>
                    <div class="empty-state-title">No Records Found</div>
                    <div class="empty-state-text">${searchQuery ? 'Try adjusting your search or filters' : 'Start adding business records to track your performance'}</div>
                </div>
            </td>`;
        tbody.appendChild(tr);
        renderPagination(0);
        return;
    }

    // Rows (desktop table)
    pageRecords.forEach(record => {
        const tr = document.createElement('tr');
        const profit = parseFloat(record.totalProfit);
        const profitColor = profit >= 0 ? 'color:#10B981;' : 'color:#EF4444;';

        tr.innerHTML = `
            <td style="white-space:nowrap;">${formatDate(record.date)}</td>
            <td style="font-weight:500;color:var(--c-text);">${record.vehicleNumber}</td>
            <td>${record.destination}</td>
            <td style="white-space:nowrap;">${parseFloat(record.weightInTons).toFixed(3)} × ${formatCurrency(record.ratePerTon)}</td>
            <td>${formatCurrency(record.amountSpend)}</td>
            <td>${formatCurrency(record.rateWeFixed)}</td>
            <td style="font-weight:600;${profitColor}">${formatCurrency(record.totalProfit)}</td>
            <td style="text-align:center;">
                <span class="badge ${record.amountReceived ? 'badge-success' : 'badge-warning'}" style="cursor:pointer;" onclick="toggleAmountReceived('${record.id}', ${!record.amountReceived})">
                    <i class="fas fa-${record.amountReceived ? 'check-circle' : 'clock'}" style="font-size:10px;"></i>
                    ${record.amountReceived ? 'Received' : 'Pending'}
                </span>
            </td>
            <td style="text-align:center;white-space:nowrap;">
                <button onclick="editRecord('${record.id}')" class="btn btn-ghost btn-sm btn-icon" title="Edit" style="width:30px;height:30px;"><i class="fas fa-pen" style="font-size:11px;"></i></button>
                <button onclick="openDeleteModal('${record.id}')" class="btn btn-ghost btn-sm btn-icon" title="Delete" style="width:30px;height:30px;color:#EF4444;"><i class="fas fa-trash" style="font-size:11px;"></i></button>
            </td>`;
        tbody.appendChild(tr);
    });

    // Mobile cards
    const mobileContainer = document.getElementById('mobileRecords');
    if (mobileContainer) {
        mobileContainer.innerHTML = '';
        if (pageRecords.length === 0) {
            mobileContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="fas fa-database"></i></div>
                    <div class="empty-state-title">No Records Found</div>
                    <div class="empty-state-text">${searchQuery ? 'Try adjusting your search or filters' : 'Tap + to add your first record'}</div>
                </div>`;
        } else {
            pageRecords.forEach(record => {
                const profit = parseFloat(record.totalProfit);
                const profitColor = profit >= 0 ? '#10B981' : '#EF4444';
                const card = document.createElement('div');
                card.className = 'record-card';
                card.innerHTML = `
                    <div class="record-card-header">
                        <span class="record-card-vehicle">${record.vehicleNumber}</span>
                        <span class="record-card-date">${formatDate(record.date)}</span>
                    </div>
                    <div class="record-card-company"><i class="fas fa-building" style="font-size:10px;margin-right:4px;opacity:0.5;"></i>${record.destination}</div>
                    <div class="record-card-grid">
                        <div>
                            <div class="record-card-field-label">Weight</div>
                            <div class="record-card-field-value">${parseFloat(record.weightInTons).toFixed(3)} T</div>
                        </div>
                        <div>
                            <div class="record-card-field-label">Rate/Ton</div>
                            <div class="record-card-field-value">${formatCurrency(record.ratePerTon)}</div>
                        </div>
                        <div>
                            <div class="record-card-field-label">Amt Spent</div>
                            <div class="record-card-field-value">${formatCurrency(record.amountSpend)}</div>
                        </div>
                        <div>
                            <div class="record-card-field-label">Rate Fixed</div>
                            <div class="record-card-field-value">${formatCurrency(record.rateWeFixed)}</div>
                        </div>
                        <div style="grid-column:1/-1;">
                            <div class="record-card-field-label">Profit</div>
                            <div class="record-card-field-value" style="color:${profitColor};font-weight:600;font-size:15px;">${formatCurrency(record.totalProfit)}</div>
                        </div>
                    </div>
                    <div class="record-card-footer">
                        <span class="badge ${record.amountReceived ? 'badge-success' : 'badge-warning'}" style="cursor:pointer;" onclick="toggleAmountReceived('${record.id}', ${!record.amountReceived})">
                            <i class="fas fa-${record.amountReceived ? 'check-circle' : 'clock'}" style="font-size:10px;"></i>
                            ${record.amountReceived ? 'Received' : 'Pending'}
                        </span>
                        <div class="record-card-actions">
                            <button onclick="editRecord('${record.id}')" class="btn btn-ghost btn-sm btn-icon" title="Edit"><i class="fas fa-pen" style="font-size:12px;"></i></button>
                            <button onclick="openDeleteModal('${record.id}')" class="btn btn-ghost btn-sm btn-icon" title="Delete" style="color:#EF4444;"><i class="fas fa-trash" style="font-size:12px;"></i></button>
                        </div>
                    </div>`;
                mobileContainer.appendChild(card);
            });
        }
    }

    renderPagination(totalRecords);
}

function renderPagination(totalRecords) {
    const container = document.getElementById('paginationContainer');
    const mobileContainer = document.getElementById('mobilePaginationContainer');
    const totalPages = Math.ceil(totalRecords / recordsPerPage) || 1;

    const emptyPagination = () => {
        if (container) container.innerHTML = '';
        if (mobileContainer) mobileContainer.innerHTML = '';
    };

    if (totalRecords <= recordsPerPage) {
        emptyPagination();
        return;
    }

    const start = (currentPage - 1) * recordsPerPage + 1;
    const end = Math.min(currentPage * recordsPerPage, totalRecords);

    let pagesHtml = '';
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

    for (let i = startPage; i <= endPage; i++) {
        pagesHtml += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }

    const paginationHtml = `
        <div class="pagination">
            <span class="pagination-info">Showing ${start}–${end} of ${totalRecords}</span>
            <div class="pagination-controls">
                <button class="page-btn" onclick="goToPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}><i class="fas fa-chevron-left" style="font-size:10px;"></i></button>
                ${pagesHtml}
                <button class="page-btn" onclick="goToPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right" style="font-size:10px;"></i></button>
            </div>
        </div>`;

    if (container) container.innerHTML = paginationHtml;
    if (mobileContainer) mobileContainer.innerHTML = paginationHtml;
}

function goToPage(page) {
    const totalPages = Math.ceil(businessRecords.length / recordsPerPage) || 1;
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderRecords();
    // Scroll to appropriate container
    const target = window.innerWidth < 768
        ? document.getElementById('mobileRecordsCard')
        : document.getElementById('recordsTable');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
window.goToPage = goToPage;

// ===== CHARTS =====
function destroyCharts() {
    if (revenueChart) { revenueChart.destroy(); revenueChart = null; }
    if (expenseChart) { expenseChart.destroy(); expenseChart = null; }
    if (pendingChart) { pendingChart.destroy(); pendingChart = null; }
}

function initializeCharts() {
    const revCtx = document.getElementById('revenueChart');
    if (revCtx) {
        revenueChart = new Chart(revCtx.getContext('2d'), { type: 'line', data: getRevenueChartData(), options: getRevenueChartOptions() });
    }
    const expCtx = document.getElementById('expenseChart');
    if (expCtx) {
        expenseChart = new Chart(expCtx.getContext('2d'), { type: 'doughnut', data: getExpenseChartData(), options: getExpenseChartOptions() });
    }
    const penCtx = document.getElementById('pendingChart');
    if (penCtx) {
        pendingChart = new Chart(penCtx.getContext('2d'), { type: 'doughnut', data: getPendingChartData(), options: getPendingChartOptions() });
    }
}

function updateCharts() {
    if (revenueChart) { revenueChart.data = getRevenueChartData(); revenueChart.update(); }
    if (expenseChart) { expenseChart.data = getExpenseChartData(); expenseChart.update(); }
    if (pendingChart) { pendingChart.data = getPendingChartData(); pendingChart.update(); }
}

function getRevenueChartData() {
    const timeRange = document.getElementById('chartTimeRange')?.value || '6';
    const today = new Date();
    let startDate = new Date();
    if (timeRange === 'all') { startDate = new Date(1970, 0, 1); }
    else { startDate = new Date(today.getFullYear(), today.getMonth() - parseInt(timeRange), today.getDate()); }
    const startStr = startDate.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    const filtered = businessRecords.filter(r => r.date >= startStr && r.date <= todayStr);

    const monthly = {};
    filtered.forEach(r => {
        const m = r.date.substring(0, 7);
        if (!monthly[m]) monthly[m] = { loads: 0, profit: 0 };
        monthly[m].loads += 1;
        monthly[m].profit += r.totalProfit;
    });
    const months = Object.keys(monthly).sort();
    const labels = months.map(m => { const d = new Date(m + '-01'); return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); });
    const c = getChartThemeColors();

    return {
        labels: labels.length > 0 ? labels : ['Jan', 'Feb', 'Mar'],
        datasets: [{
            label: 'Lorry Loads',
            data: months.map(m => monthly[m].loads),
            borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.08)',
            tension: 0.4, fill: true, borderWidth: 2, pointRadius: 4,
            pointBackgroundColor: '#3B82F6', pointBorderColor: c.pointBorderColor, pointBorderWidth: 2, yAxisID: 'y'
        }, {
            label: 'Profit',
            data: months.map(m => monthly[m].profit),
            borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.08)',
            tension: 0.4, fill: true, borderWidth: 2, pointRadius: 4,
            pointBackgroundColor: '#10B981', pointBorderColor: c.pointBorderColor, pointBorderWidth: 2, yAxisID: 'y1'
        }]
    };
}

function getRevenueChartOptions() {
    const c = getChartThemeColors();
    return {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { display: true, position: 'top', labels: { color: c.legendColor, usePointStyle: true, padding: 20, font: { family: 'Inter', size: 11, weight: '500' } } },
            tooltip: { backgroundColor: c.tooltipBg, padding: 12, titleColor: c.tooltipText, bodyColor: c.tooltipText, borderColor: c.tooltipBorder, borderWidth: 1, titleFont: { family: 'Inter', size: 12 }, bodyFont: { family: 'Inter', size: 12 }, displayColors: true,
                callbacks: { label(ctx) { let l = ctx.dataset.label || ''; if (l) l += ': '; l += ctx.dataset.yAxisID === 'y' ? ctx.parsed.y + ' loads' : formatCurrency(ctx.parsed.y); return l; } }
            }
        },
        scales: {
            y: { type: 'linear', display: true, position: 'left', beginAtZero: true,
                grid: { color: c.gridColor, drawBorder: false }, ticks: { color: c.tickColor, font: { family: 'Inter', size: 11 }, stepSize: 1 },
                title: { display: true, text: 'Lorry Loads', color: c.tickColor, font: { family: 'Inter', size: 11 } }
            },
            y1: { type: 'linear', display: true, position: 'right', beginAtZero: true,
                grid: { drawOnChartArea: false }, ticks: { color: c.tickColor, font: { family: 'Inter', size: 11 }, callback(v) { return '₹' + (v / 1000) + 'K'; } },
                title: { display: true, text: 'Profit', color: c.tickColor, font: { family: 'Inter', size: 11 } }
            },
            x: { grid: { display: false, drawBorder: false }, ticks: { color: c.tickColor, font: { family: 'Inter', size: 11 } } }
        }
    };
}

function getExpenseChartData() {
    const timeRange = document.getElementById('chartTimeRange')?.value || '6';
    const today = new Date();
    let startDate = timeRange === 'all' ? new Date(1970, 0, 1) : new Date(today.getFullYear(), today.getMonth() - parseInt(timeRange), today.getDate());
    const startStr = startDate.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    const filtered = businessRecords.filter(r => r.date >= startStr && r.date <= todayStr);
    const totalSpend = filtered.reduce((s, r) => s + (r.amountSpend || 0), 0);
    const totalProfit = filtered.reduce((s, r) => s + (r.totalProfit || 0), 0);
    const c = getChartThemeColors();
    return {
        labels: ['Amount Spend', 'Profit'],
        datasets: [{ data: [totalSpend, totalProfit], backgroundColor: ['#3B82F6', '#10B981'], borderColor: c.chartBorderColor, borderWidth: 3, hoverOffset: 6 }]
    };
}

function getExpenseChartOptions() {
    const c = getChartThemeColors();
    return {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { display: true, position: 'right', labels: { color: c.legendColor, usePointStyle: true, padding: 15, font: { family: 'Inter', size: 11, weight: '500' } } },
            tooltip: { backgroundColor: c.tooltipBg, padding: 12, titleColor: c.tooltipText, bodyColor: c.tooltipText, borderColor: c.tooltipBorder, borderWidth: 1, titleFont: { family: 'Inter', size: 12 }, bodyFont: { family: 'Inter', size: 12 },
                callbacks: { label(ctx) { let l = ctx.label || ''; if (l) l += ': '; const v = ctx.parsed; const tot = ctx.chart.data.datasets[0].data.reduce((s, x) => s + (x || 0), 0); l += formatCurrency(v); l += ' (' + (tot > 0 ? ((v / tot) * 100).toFixed(1) : '0.0') + '%)'; return l; } }
            }
        }
    };
}

function getPendingChartData() {
    const filtered = getFilteredRecords();
    let received = 0, pending = 0;
    filtered.forEach(r => {
        const amt = (parseFloat(r.amountSpend) || 0) + (parseFloat(r.totalProfit) || 0);
        if (r.amountReceived) received += amt; else pending += amt;
    });
    const c = getChartThemeColors();
    return {
        labels: ['Received', 'Pending'],
        datasets: [{ data: [received, pending], backgroundColor: ['#10B981', '#F59E0B'], borderColor: c.chartBorderColor, borderWidth: 3, cutout: '60%' }]
    };
}

function getPendingChartOptions() {
    const c = getChartThemeColors();
    return {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true, font: { family: 'Inter', size: 11 }, color: c.legendColor } },
            tooltip: { backgroundColor: c.tooltipBg, padding: 12, titleColor: c.tooltipText, bodyColor: c.tooltipText, borderColor: c.tooltipBorder, borderWidth: 1, titleFont: { family: 'Inter', size: 12 }, bodyFont: { family: 'Inter', size: 12 },
                callbacks: { label(ctx) { const v = ctx.parsed; const tot = ctx.dataset.data.reduce((a, b) => a + b, 0); const pct = tot > 0 ? ((v / tot) * 100).toFixed(1) : 0; return `${ctx.label}: ${formatCurrency(v)} (${pct}%)`; } }
            }
        }
    };
}

// ===== FORM HANDLING =====
function setupFormCalculations() {
    const wt = document.getElementById('weightInTons');
    const rpt = document.getElementById('ratePerTon');
    const rwf = document.getElementById('rateWeFixed');
    const as = document.getElementById('amountSpend');
    const tp = document.getElementById('totalProfit');
    if (!wt || !rpt || !as || !rwf || !tp) return;

    const nwt = wt.cloneNode(true); const nrpt = rpt.cloneNode(true); const nrwf = rwf.cloneNode(true);
    wt.parentNode.replaceChild(nwt, wt);
    rpt.parentNode.replaceChild(nrpt, rpt);
    rwf.parentNode.replaceChild(nrwf, rwf);

    const fwt = document.getElementById('weightInTons');
    const frpt = document.getElementById('ratePerTon');
    const frwf = document.getElementById('rateWeFixed');

    const calcSpend = () => { as.value = ((parseFloat(fwt.value) || 0) * (parseFloat(frpt.value) || 0)).toFixed(2); };
    const calcProfit = () => { tp.value = ((parseFloat(fwt.value) || 0) * (parseFloat(frwf.value) || 0) - (parseFloat(as.value) || 0)).toFixed(2); };
    const calcBoth = () => { calcSpend(); calcProfit(); };

    fwt.addEventListener('input', calcBoth);
    frpt.addEventListener('input', calcBoth);
    frwf.addEventListener('input', calcProfit);
}

function openAddRecordModal() {
    document.getElementById('recordModalTitle').textContent = 'Add Record';
    document.getElementById('recordForm').reset();
    document.getElementById('recordId').value = '';
    document.getElementById('recordDate').value = new Date().toISOString().split('T')[0];
    const modal = document.getElementById('recordModal');
    modal.classList.add('open');
    setTimeout(setupFormCalculations, 100);
}

function closeRecordModal() {
    document.getElementById('recordModal')?.classList.remove('open');
}
window.closeRecordModal = closeRecordModal;

function editRecord(id) {
    const record = businessRecords.find(r => r.id === id);
    if (!record) return;
    document.getElementById('recordModalTitle').textContent = 'Edit Record';
    document.getElementById('recordId').value = record.id;
    document.getElementById('recordDate').value = record.date;
    document.getElementById('vehicleNumber').value = record.vehicleNumber;
    document.getElementById('destination').value = record.destination;
    document.getElementById('weightInTons').value = record.weightInTons;
    document.getElementById('ratePerTon').value = record.ratePerTon;
    document.getElementById('amountSpend').value = record.amountSpend;
    document.getElementById('rateWeFixed').value = record.rateWeFixed;
    document.getElementById('totalProfit').value = record.totalProfit;
    document.getElementById('amountReceived').checked = record.amountReceived || false;
    document.getElementById('recordModal').classList.add('open');
    setTimeout(setupFormCalculations, 100);
}
window.editRecord = editRecord;

async function handleRecordFormSubmit(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';

    try {
        const id = document.getElementById('recordId').value;
        const date = document.getElementById('recordDate').value;
        const vehicleNumber = document.getElementById('vehicleNumber').value;
        const destination = document.getElementById('destination').value;
        const weightInTons = parseFloat(document.getElementById('weightInTons').value);
        const ratePerTon = parseFloat(document.getElementById('ratePerTon').value);
        const amountSpend = parseFloat(document.getElementById('amountSpend').value);
        const rateWeFixed = parseFloat(document.getElementById('rateWeFixed').value);
        const totalProfit = parseFloat(document.getElementById('totalProfit').value);
        const amountReceived = document.getElementById('amountReceived').checked;

        const data = { date, vehicleNumber, destination, weightInTons, ratePerTon, amountSpend, rateWeFixed, totalProfit, amountReceived };

        if (id) {
            data.id = id;
            await saveRecordToCSV(data, true);
            const rec = businessRecords.find(r => r.id === id);
            if (rec) Object.assign(rec, { date, vehicleNumber, destination, weightInTons, ratePerTon, amountSpend, rateWeFixed, totalProfit, amountReceived });
        } else {
            const saved = await saveRecordToCSV(data, false);
            businessRecords.push(saved);
        }

        populateMonthFilter();
        renderRecords();
        updateStatistics();
        updateCharts();
        closeRecordModal();
        showNotification('Record saved successfully!', 'success');
    } catch (error) {
        showNotification('Failed to save record: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-check"></i> Save';
    }
}

// ===== DELETE MODAL =====
function openDeleteModal(id) {
    pendingDeleteId = id;
    document.getElementById('deleteModal')?.classList.add('open');
}
window.openDeleteModal = openDeleteModal;

function closeDeleteModal() {
    pendingDeleteId = null;
    document.getElementById('deleteModal')?.classList.remove('open');
}
window.closeDeleteModal = closeDeleteModal;

async function confirmDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    closeDeleteModal();
    try {
        await deleteRecordFromCSV(id);
        businessRecords = businessRecords.filter(r => r.id !== id);
        populateMonthFilter();
        renderRecords();
        updateStatistics();
        updateCharts();
        showNotification('Record deleted successfully!', 'success');
    } catch (error) {
        showNotification('Failed to delete record', 'error');
    }
}
window.confirmDelete = confirmDelete;

// ===== TOGGLE AMOUNT RECEIVED =====
async function toggleAmountReceived(recordId, isReceived) {
    // Optimistic UI update
    const record = businessRecords.find(r => r.id === recordId);
    if (record) record.amountReceived = isReceived;
    renderRecords();

    try {
        const response = await fetch(`${API_URL}/records/${recordId}/amount-received`, {
            method: 'PATCH', headers: getAuthHeaders(),
            body: JSON.stringify({ amountReceived: isReceived })
        });
        if (!response.ok) throw new Error('Failed to update');
        updateStatistics();
        updateCharts();
        showNotification(isReceived ? 'Amount marked as received' : 'Amount marked as pending', 'success');
    } catch (error) {
        // Revert
        if (record) record.amountReceived = !isReceived;
        renderRecords();
        showNotification('Error updating payment status', 'error');
    }
}
window.toggleAmountReceived = toggleAmountReceived;

// ===== LOGOUT =====
function openLogoutModal() {
    document.getElementById('logoutModal')?.classList.add('open');
}
function closeLogoutModal() {
    document.getElementById('logoutModal')?.classList.remove('open');
}
window.closeLogoutModal = closeLogoutModal;

function confirmLogout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    localStorage.removeItem('userName');
    window.location.href = 'index.html';
}
window.confirmLogout = confirmLogout;

// ===== NOTIFICATIONS =====
function showNotification(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const iconMap = { error: 'exclamation-circle', success: 'check-circle', info: 'info-circle' };
    toast.innerHTML = `<i class="fas fa-${iconMap[type] || 'info-circle'}"></i><span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(24px)';
        setTimeout(() => toast.remove(), 200);
    }, 4000);
}

// ===== EXPORT =====
function exportDataToCSV() {
    const headers = ['Date', 'Vehicle Number', 'City', 'Destination', 'Weight (Tons)', 'Rate per Ton', 'Amount Spend', 'Rate Fixed', 'Extra Spend', 'Total Profit', 'Amount Received'];
    const rows = businessRecords.map(r => [r.date, r.vehicleNumber, r.city, r.destination, r.weightInTons, r.ratePerTon, r.amountSpend, r.rateWeFixed, r.extraSpend, r.totalProfit, r.amountReceived ? 'Yes' : 'No']);
    downloadCSV(`business_records_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
    showNotification('CSV exported successfully!', 'success');
}

function downloadCSV(filename, headers, rows) {
    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
        csv += row.map(cell => {
            if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) return '"' + cell.replace(/"/g, '""') + '"';
            return cell;
        }).join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

// ===== UTILITIES =====
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ===== FLOATING ACTION BUTTON =====
function updateFAB() {
    let fab = document.getElementById('fab');
    if (!fab) {
        fab = document.createElement('button');
        fab.id = 'fab';
        fab.className = 'fab';
        fab.innerHTML = '<i class="fas fa-plus"></i>';
        fab.setAttribute('aria-label', 'Add Record');
        fab.addEventListener('click', () => openAddRecordModal());
        document.body.appendChild(fab);
    }
}

// ===== GLOBAL LISTENERS =====
function setupGlobalListeners() {
    // Form submit
    document.getElementById('recordForm')?.addEventListener('submit', handleRecordFormSubmit);

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('open');
                pendingDeleteId = null;
            }
        });
    });

    // Keyboard: Escape closes modals + mobile sidebar
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
            pendingDeleteId = null;
            closeMobileSidebar();
        }
    });
}

// Make global functions accessible from inline handlers
window.setThemePreference = setThemePreference;
window.toggleDesktopSidebar = toggleDesktopSidebar;
window.openLogoutModal = openLogoutModal;
window.exportDataToCSV = exportDataToCSV;
