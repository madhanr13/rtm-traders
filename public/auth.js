// Authentication Logic
let API_URL = 'https://rtm-traders-api.onrender.com';

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

document.addEventListener('DOMContentLoaded', async function () {
    await fetchConfig();

    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');

    // Check if user is already logged in with valid token
    const token = localStorage.getItem('authToken');
    if (token) {
        verifyTokenAndRedirect(token);
    }

    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        e.stopPropagation();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const submitBtn = loginForm.querySelector('.submit-btn');

        // Validate input
        if (!username || !password) {
            errorMessage.textContent = 'Please enter both email and password.';
            errorMessage.style.display = 'block';
            return;
        }

        // Disable button and show loading
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In…';

        try {
            const response = await fetch(`${API_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('username', data.user.username);
                localStorage.setItem('userName', data.user.name);

                submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Success!';
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 500);
            } else {
                errorMessage.textContent = data.error || 'Invalid username or password. Please try again.';
                errorMessage.style.display = 'block';

                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>Sign In</span><i class="fas fa-arrow-right" style="font-size:12px;"></i>';

                loginForm.style.animation = 'shake 0.5s';
                setTimeout(() => { loginForm.style.animation = ''; }, 500);
            }
        } catch (error) {
            console.error('Login error:', error);
            errorMessage.textContent = 'Connection error. Please ensure the server is running.';
            errorMessage.style.display = 'block';

            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Sign In</span><i class="fas fa-arrow-right" style="font-size:12px;"></i>';
        }
    });

    // Clear error on input
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', () => {
            errorMessage.style.display = 'none';
        });
    });
});

// Verify token validity
async function verifyTokenAndRedirect(token) {
    try {
        const response = await fetch(`${API_URL}/api/verify`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            window.location.href = 'dashboard.html';
        } else {
            localStorage.removeItem('authToken');
            localStorage.removeItem('username');
            localStorage.removeItem('userName');
        }
    } catch (error) {
        console.error('Token verification error:', error);
    }
}
