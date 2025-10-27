// Dashboard page functionality
document.addEventListener("DOMContentLoaded", async () => {
    // Initialize Lucide icons
    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }

    // Load dashboard data
    await loadDashboardData();
});

async function loadDashboardData() {
    try {
        // Load multiple data points in parallel
        const [statsResponse, earningsResponse, currentDataResponse] = await Promise.all([
            chrome.runtime.sendMessage({ action: 'getStats' }),
            chrome.runtime.sendMessage({ action: 'getTotalEarnings' }),
            chrome.runtime.sendMessage({ action: 'calculateURLWorth' })
        ]);

        // Update stats
        if (statsResponse) {
            document.getElementById('total-urls').textContent = statsResponse.totalURLs || 0;
        }

        if (earningsResponse) {
            document.getElementById('total-earnings').textContent = `$${earningsResponse.earnings.toFixed(2)}`;
        }

        if (currentDataResponse) {
            document.getElementById('current-urls').textContent = currentDataResponse.count;
            document.getElementById('current-value').textContent = `$${currentDataResponse.worth}`;
        }

        // Load sales history
        await loadSalesHistory();

    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError('Error loading dashboard data. Please try again.');
    }
}

async function loadSalesHistory() {
    try {
        // Get sales data from background script
        const response = await chrome.runtime.sendMessage({ action: 'getSalesHistory' });
        
        const salesHistoryDiv = document.getElementById('sales-history');
        
        if (response && response.sales && response.sales.length > 0) {
            salesHistoryDiv.innerHTML = '';
            
            response.sales.forEach((sale, index) => {
                const saleElement = createSaleElement(sale, index);
                salesHistoryDiv.appendChild(saleElement);
            });
        } else {
            salesHistoryDiv.innerHTML = `
                <div class="message info">
                    <i data-lucide="info"></i>
                    No sales yet. Visit some websites and sell your URLs in the marketplace to start earning!
                </div>
            `;
        }
        
        // Re-initialize icons
        if (typeof lucide !== "undefined") {
            lucide.createIcons();
        }
        
    } catch (error) {
        console.error('Error loading sales history:', error);
        document.getElementById('sales-history').innerHTML = `
            <div class="message error">
                <i data-lucide="alert-circle"></i>
                Error loading sales history.
            </div>
        `;
    }
}

function createSaleElement(sale, index) {
    const saleDiv = document.createElement('div');
    saleDiv.className = 'stat-card';
    saleDiv.style.marginBottom = '15px';
    
    const date = new Date(sale.timestamp);
    const formattedDate = date.toLocaleDateString();
    const formattedTime = date.toLocaleTimeString();
    
    saleDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <div style="font-size: 18px; font-weight: bold; color: #2e7d32;">
                    +$${sale.amount.toFixed(2)}
                </div>
                <div style="font-size: 14px; color: #666;">
                    ${sale.count} URLs sold
                </div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 12px; color: #666;">
                    ${formattedDate}
                </div>
                <div style="font-size: 12px; color: #999;">
                    ${formattedTime}
                </div>
            </div>
        </div>
    `;
    
    return saleDiv;
}

function showError(message) {
    const salesHistoryDiv = document.getElementById('sales-history');
    salesHistoryDiv.innerHTML = `
        <div class="message error">
            <i data-lucide="alert-circle"></i>
            ${message}
        </div>
    `;
    
    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }
}
