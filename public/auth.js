// Authentication Logic
let API_URL = 'http://localhost:3000'; // Default fallback

// Fetch API URL from server config
async function fetchConfig() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        API_URL = config.apiUrl;
    } catch (error) {
        console.warn('Could not fetch config, using default:', error);
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    // Fetch API configuration first
    await fetchConfig();
    
    // Initialize theme
    initializeLoginTheme();
    
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    
    // Check if user is already logged in with valid token
    const token = localStorage.getItem('authToken');
    if (token) {
        verifyTokenAndRedirect(token);
    }
    
    // Theme toggle
    const themeToggleLogin = document.getElementById('themeToggleLogin');
    if (themeToggleLogin) {
        themeToggleLogin.addEventListener('click', toggleLoginTheme);
    }
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const submitBtn = loginForm.querySelector('.submit-btn');
        
        // Disable button and show loading
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
        
        try {
            // Send login request to server
            const response = await fetch(`${API_URL}/api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Store JWT token
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('username', data.user.username);
                localStorage.setItem('userName', data.user.name);
                
                // Show success and redirect
                submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Success!';
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 500);
            } else {
                // Show error message
                errorMessage.textContent = data.error || 'Invalid username or password. Please try again.';
                errorMessage.style.display = 'block';
                
                // Reset button
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
                
                // Shake animation for error
                loginForm.style.animation = 'shake 0.5s';
                setTimeout(() => {
                    loginForm.style.animation = '';
                }, 500);
            }
        } catch (error) {
            console.error('Login error:', error);
            errorMessage.textContent = 'Connection error. Please ensure the server is running.';
            errorMessage.style.display = 'block';
            
            // Reset button
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        }
    });
    
    // Clear error message on input
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            errorMessage.style.display = 'none';
        });
    });
});

// Verify token validity
async function verifyTokenAndRedirect(token) {
    try {
        const response = await fetch(`${API_URL}/api/verify`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            // Token is valid, redirect to dashboard
            window.location.href = 'dashboard.html';
        } else {
            // Token is invalid, clear it
            localStorage.removeItem('authToken');
            localStorage.removeItem('username');
            localStorage.removeItem('userName');
        }
    } catch (error) {
        console.error('Token verification error:', error);
    }
}

// Theme Toggle Functions for Login Page
function initializeLoginTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateLoginThemeIcon(savedTheme);
}

function toggleLoginTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateLoginThemeIcon(newTheme);
}

function updateLoginThemeIcon(theme) {
    const themeToggle = document.getElementById('themeToggleLogin');
    if (themeToggle) {
        const icon = themeToggle.querySelector('i');
        if (icon) {
            icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }
}

// Shake animation CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
        20%, 40%, 60%, 80% { transform: translateX(10px); }
    }
`;
document.head.appendChild(style);
