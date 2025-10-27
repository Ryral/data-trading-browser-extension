// Settings page functionality
document.addEventListener("DOMContentLoaded", async () => {
    // Initialize Lucide icons
    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }

    // Load settings
    await loadSettings();
    
    // Set up event listeners
    setupEventListeners();
});

async function loadSettings() {
    try {
        // Load tracking status
        const trackingResponse = await chrome.runtime.sendMessage({ action: 'getSyncStatus' });
        if (trackingResponse) {
            updateTrackingToggle(trackingResponse.tracking);
        }
        
        // Load user info
        const userResponse = await chrome.runtime.sendMessage({ action: 'getCurrentUser' });
        if (userResponse && userResponse.user) {
            displayUserInfo(userResponse.user);
        } else {
            displayNoUser();
        }
        
    } catch (error) {
        console.error('Error loading settings:', error);
        showMessage('Error loading settings. Please try again.', 'error');
    }
}

function updateTrackingToggle(isEnabled) {
    const toggle = document.getElementById('tracking-toggle');
    const label = document.getElementById('tracking-label');
    
    if (isEnabled) {
        toggle.classList.add('active');
        label.textContent = 'URL tracking enabled';
    } else {
        toggle.classList.remove('active');
        label.textContent = 'URL tracking disabled';
    }
}

function displayUserInfo(user) {
    const userInfoDiv = document.getElementById('user-info');
    userInfoDiv.innerHTML = `
        <div>
            <div style="font-weight: bold; font-size: 16px;">${user.name || 'User'}</div>
            <div style="font-size: 14px; color: #666;">${user.email || ''}</div>
        </div>
    `;
}

function displayNoUser() {
    const userInfoDiv = document.getElementById('user-info');
    userInfoDiv.innerHTML = `
        <div class="message info">
            <i data-lucide="user"></i>
            Not signed in. Sign in from the main popup to manage your account.
        </div>
    `;
    
    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }
}

function setupEventListeners() {
    // Tracking toggle
    document.getElementById('tracking-toggle').addEventListener('click', async () => {
        await toggleTracking();
    });
    
    // Sign out button
    document.getElementById('sign-out').addEventListener('click', async () => {
        await signOut();
    });
    
    // Clear data button
    document.getElementById('clear-data').addEventListener('click', async () => {
        await clearAllData();
    });
}

async function toggleTracking() {
    try {
        const response = await chrome.runtime.sendMessage({ action: 'toggleTracking' });
        if (response) {
            updateTrackingToggle(response.tracking);
            showMessage(
                response.tracking ? 'URL tracking enabled' : 'URL tracking disabled',
                'success'
            );
        }
    } catch (error) {
        console.error('Error toggling tracking:', error);
        showMessage('Error updating tracking setting.', 'error');
    }
}

async function signOut() {
    if (confirm('Are you sure you want to sign out?')) {
        try {
            await chrome.runtime.sendMessage({ action: 'signOut' });
            showMessage('Signed out successfully.', 'success');
            displayNoUser();
        } catch (error) {
            console.error('Error signing out:', error);
            showMessage('Error signing out.', 'error');
        }
    }
}

async function clearAllData() {
    if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'clearData' });
            if (response.success) {
                showMessage('All data cleared successfully.', 'success');
                // Update tracking toggle to reflect cleared state
                updateTrackingToggle(true); // Reset to enabled state
            }
        } catch (error) {
            console.error('Error clearing data:', error);
            showMessage('Error clearing data.', 'error');
        }
    }
}

function showMessage(text, type) {
    const messageDiv = document.getElementById('status-message');
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    // Hide message after 5 seconds
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}
