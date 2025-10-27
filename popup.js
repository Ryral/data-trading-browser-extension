// This function runs when the popup is clicked
document.addEventListener("DOMContentLoaded", async () => {
    // Generates lucide icons - makes whatever in lucide.js usable
    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }

    // Check authentication status
    await checkAuthStatus();
    
    // Set up event listeners
    setupEventListeners();
    
    // Update data worth display
    await updateDataWorth();
});

async function checkAuthStatus() {
    try {
        const response = await chrome.runtime.sendMessage({ action: 'getCurrentUser' });
        const user = response.user;
        
        if (user) {
            showAuthenticatedState(user);
        } else {
            showLoginState();
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
        showLoginState();
    }
}

function showAuthenticatedState(user) {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('auth-section').style.display = 'block';
    document.getElementById('main-content').style.display = 'block';
    
    // Update user info
    document.getElementById('user-name').textContent = user.name || 'User';
    document.getElementById('user-email').textContent = user.email || '';
}

function showLoginState() {
    document.getElementById('login-section').style.display = 'block';
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('main-content').style.display = 'none';
}

function setupEventListeners() {
    // Demo sign in button
    document.getElementById('sign-in').addEventListener('click', async () => {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'signInWithGoogle' });
            if (response.success) {
                showAuthenticatedState(response.user);
                await updateDataWorth();
            } else {
                alert('Sign in failed: ' + response.error);
            }
        } catch (error) {
            console.error('Sign in error:', error);
            alert('Sign in failed. Please try again.');
        }
    });

    // Show email form button
    document.getElementById('show-email-form').addEventListener('click', () => {
        const form = document.querySelector('.login-form');
        const button = document.getElementById('show-email-form');
        if (form.style.display === 'none') {
            form.style.display = 'block';
            button.textContent = 'Hide Email Form';
        } else {
            form.style.display = 'none';
            button.innerHTML = '<i data-lucide="mail"></i> Use Email Instead';
        }
        if (typeof lucide !== "undefined") {
            lucide.createIcons();
        }
    });

    // Email sign in button
    document.getElementById('sign-in-email').addEventListener('click', async () => {
        const email = document.getElementById('email-input').value;
        const name = document.getElementById('name-input').value;
        
        if (!email) {
            alert('Please enter your email');
            return;
        }
        
        try {
            const response = await chrome.runtime.sendMessage({ 
                action: 'signInWithEmail', 
                email: email, 
                name: name 
            });
            if (response.success) {
                showAuthenticatedState(response.user);
                await updateDataWorth();
            } else {
                alert('Sign in failed: ' + response.error);
            }
        } catch (error) {
            console.error('Sign in error:', error);
            alert('Sign in failed. Please try again.');
        }
    });

    // Sign out button
    document.getElementById('sign-out').addEventListener('click', async () => {
        try {
            await chrome.runtime.sendMessage({ action: 'signOut' });
            showLoginState();
        } catch (error) {
            console.error('Sign out error:', error);
        }
    });

    // Navigation buttons
    document.getElementById("marketplace").addEventListener("click", () => chrome.tabs.create({url: "marketplace.html"}));
    document.getElementById("dashboard").addEventListener("click", () => chrome.tabs.create({url: "dashboard.html"}));
    document.getElementById("browserhistory").addEventListener("click", () => chrome.tabs.create({url: "browserhistory.html"}));
    document.getElementById("settings").addEventListener("click", () => chrome.tabs.create({url: "settings.html"}));
}

async function updateDataWorth() {
    try {
        const response = await chrome.runtime.sendMessage({ action: 'calculateURLWorth' });
        if (response) {
            document.getElementById('data-worth').textContent = `$${response.worth}`;
            document.getElementById('url-count').textContent = `${response.count} URLs collected`;
        }
    } catch (error) {
        console.error('Error updating data worth:', error);
    }
}