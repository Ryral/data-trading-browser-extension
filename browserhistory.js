// Browser History page functionality
document.addEventListener("DOMContentLoaded", () => {
    // Initialize Lucide icons
    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }

    // Set up event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Chrome History button
    document.getElementById('chrome-history').addEventListener('click', () => {
        chrome.tabs.create({ url: 'chrome://history/' });
    });

    // Extension History button
    document.getElementById('extension-history').addEventListener('click', async () => {
        await loadTrackedURLs();
    });
}

async function loadTrackedURLs() {
    const trackedUrlsDiv = document.getElementById('tracked-urls');
    const urlsListDiv = document.getElementById('urls-list');
    
    try {
        // Show the tracked URLs section
        trackedUrlsDiv.style.display = 'block';
        
        // Load URLs from background script
        const response = await chrome.runtime.sendMessage({ action: 'getAllURLs' });
        
        if (response && response.length > 0) {
            urlsListDiv.innerHTML = '';
            
            // Sort URLs by timestamp (newest first)
            const sortedURLs = response.sort((a, b) => b.timestamp - a.timestamp);
            
            sortedURLs.forEach((urlEntry, index) => {
                const urlElement = createURLElement(urlEntry, index);
                urlsListDiv.appendChild(urlElement);
            });
            
            // Add summary
            const summaryDiv = document.createElement('div');
            summaryDiv.className = 'message info';
            summaryDiv.style.marginBottom = '20px';
            summaryDiv.innerHTML = `
                <i data-lucide="info"></i>
                Showing ${response.length} tracked URLs. These are the URLs ValYou has collected for data trading.
            `;
            urlsListDiv.insertBefore(summaryDiv, urlsListDiv.firstChild);
            
        } else {
            urlsListDiv.innerHTML = `
                <div class="message info">
                    <i data-lucide="info"></i>
                    No URLs tracked yet. Start browsing to see your tracked URLs here!
                </div>
            `;
        }
        
        // Re-initialize icons
        if (typeof lucide !== "undefined") {
            lucide.createIcons();
        }
        
    } catch (error) {
        console.error('Error loading tracked URLs:', error);
        urlsListDiv.innerHTML = `
            <div class="message error">
                <i data-lucide="alert-circle"></i>
                Error loading tracked URLs. Please try again.
            </div>
        `;
    }
}

function createURLElement(urlEntry, index) {
    const urlDiv = document.createElement('div');
    urlDiv.className = 'stat-card';
    urlDiv.style.marginBottom = '10px';
    urlDiv.style.textAlign = 'left';
    
    const date = new Date(urlEntry.timestamp);
    const formattedDate = date.toLocaleDateString();
    const formattedTime = date.toLocaleTimeString();
    
    // Truncate long URLs for display
    const displayUrl = urlEntry.url.length > 60 ? 
        urlEntry.url.substring(0, 60) + '...' : 
        urlEntry.url;
    
    urlDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="flex: 1; margin-right: 15px;">
                <div style="font-weight: bold; margin-bottom: 5px; word-break: break-all;">
                    ${urlEntry.title || 'Untitled Page'}
                </div>
                <div style="font-size: 12px; color: #666; margin-bottom: 5px; word-break: break-all;">
                    ${displayUrl}
                </div>
                <div style="font-size: 11px; color: #999;">
                    Visits: ${urlEntry.visitCount || 1}
                </div>
            </div>
            <div style="text-align: right; font-size: 11px; color: #999;">
                <div>${formattedDate}</div>
                <div>${formattedTime}</div>
            </div>
        </div>
    `;
    
    return urlDiv;
}
