// Marketplace page functionality
document.addEventListener("DOMContentLoaded", async () => {
    // Initialize Lucide icons
    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }

    // Load current data
    await updateMarketplaceData();
    
    // Set up event listeners
    setupEventListeners();
});

async function updateMarketplaceData() {
    try {
        const response = await chrome.runtime.sendMessage({ action: 'calculateURLWorth' });
        if (response) {
            const urlCount = response.count;
            const dataValue = response.worth;
            
            // Update display
            document.getElementById('url-count').textContent = urlCount;
            document.getElementById('data-value').textContent = `$${dataValue}`;
            
            // Update sell button
            const sellButton = document.getElementById('sell-button');
            if (urlCount > 0) {
                sellButton.disabled = false;
                sellButton.innerHTML = `<i data-lucide="dollar-sign"></i> Sell URLs ($${dataValue})`;
            } else {
                sellButton.disabled = true;
                sellButton.innerHTML = `<i data-lucide="dollar-sign"></i> Sell URLs ($0.00)`;
            }
            
            // Re-initialize icons after updating button content
            if (typeof lucide !== "undefined") {
                lucide.createIcons();
            }
        }
    } catch (error) {
        console.error('Error updating marketplace data:', error);
        showMessage('Error loading data. Please try again.', 'error');
    }
}

function setupEventListeners() {
    // Sell button
    document.getElementById('sell-button').addEventListener('click', async () => {
        await sellURLs();
    });
}

async function sellURLs() {
    const sellButton = document.getElementById('sell-button');
    const sellMessage = document.getElementById('sell-message');
    
    try {
        // Disable button during sale
        sellButton.disabled = true;
        sellButton.innerHTML = '<i data-lucide="loader"></i> Selling...';
        
        // Re-initialize icons
        if (typeof lucide !== "undefined") {
            lucide.createIcons();
        }
        
        // Send sell request to background script
        const response = await chrome.runtime.sendMessage({ action: 'sellURLs' });
        
        if (response.success) {
            const soldData = response.sold;
            showMessage(
                `Successfully sold ${soldData.count} URLs for $${soldData.amount.toFixed(2)}!`,
                'success'
            );
            
            // Update display after successful sale
            await updateMarketplaceData();
        } else {
            showMessage('Failed to sell URLs. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error selling URLs:', error);
        showMessage('Error occurred while selling URLs.', 'error');
    } finally {
        // Re-enable button
        sellButton.disabled = false;
        await updateMarketplaceData(); // This will update the button text
    }
}

function showMessage(text, type) {
    const messageDiv = document.getElementById('sell-message');
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    // Hide message after 5 seconds
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}
