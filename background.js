// Background service worker for ValYou Chrome Extension
// Handles URL tracking and data collection

// Firebase configuration
const FIREBASE_PROJECT_ID = 'valyou-bc6d4';
const FIREBASE_API_KEY = 'AIzaSyAyd0nrr1Z2QnyH8Qbd1r3gpltWZ8jGbu0';

// Simple URL History Repository
class URLHistoryRepo {
  constructor() {
    this.key = 'visited_urls';
    this.urls = [];
  }

  load() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.key], (result) => {
        resolve(result[this.key] || []);
      });
    });
  }

  save() {
    chrome.storage.local.set({ [this.key]: this.urls });
  }

  async addURL(urlData) {
    this.urls = await this.load();
    const urlEntry = {
      url: urlData.url,
      title: urlData.title || '',
      timestamp: urlData.timestamp || Date.now(),
      visitCount: urlData.visitCount || 1,
      domain: urlData.domain || this.extractDomain(urlData.url)
    };

    // Check if URL already exists
    const existingIndex = this.urls.findIndex(entry => entry.url === urlEntry.url);
    
    if (existingIndex !== -1) {
      // Update existing entry
      this.urls[existingIndex].timestamp = urlEntry.timestamp;
      this.urls[existingIndex].visitCount = (this.urls[existingIndex].visitCount || 1) + 1;
    } else {
      // Add new URL entry
      this.urls.push(urlEntry);
    }

    this.save();
  }

  async getAllURLs() {
    this.urls = await this.load();
    return this.urls.sort((a, b) => b.timestamp - a.timestamp);
  }

  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return '';
    }
  }

  async getStats() {
    this.urls = await this.load();
    const domains = new Set();
    this.urls.forEach(urlEntry => {
      try {
        const domain = new URL(urlEntry.url).hostname;
        domains.add(domain);
      } catch (e) {
        // Skip invalid URLs
      }
    });
    
    const totalVisits = this.urls.reduce((sum, url) => sum + (url.visitCount || 1), 0);
    
    return {
      totalURLs: this.urls.length,
      uniqueDomains: domains.size,
      totalVisits: totalVisits,
      oldestVisit: this.urls.length > 0 ? Math.min(...this.urls.map(u => u.timestamp)) : null,
      newestVisit: this.urls.length > 0 ? Math.max(...this.urls.map(u => u.timestamp)) : null
    };
  }

  clear() {
    this.urls = [];
    this.save();
  }
}

// Initialize URL history repository
const urlHistoryRepo = new URLHistoryRepo();

// URL tracking variables
let currentTabId = null;
let visitStartTime = null;
let isTracking = true;
let trackedUrls = new Set(); // Track URLs to avoid duplicates

// Initialize the background service worker
chrome.runtime.onStartup.addListener(() => {
  console.log('ValYou extension started');
  initializeTracking();
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('ValYou extension installed');
  initializeTracking();
});

// Initialize URL tracking functionality
function initializeTracking() {
  console.log('Starting URL tracking for new visits only');
  setupTabListeners();
}

// Set up Chrome tab event listeners
function setupTabListeners() {
  console.log('Setting up tab listeners...');
  
  // Track when tabs are updated (user navigates to new page)
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    console.log('Tab updated event:', tabId, changeInfo.status, tab.url);
    if (changeInfo.status === 'complete' && tab.url && isValidUrl(tab.url)) {
      console.log('Tracking URL visit from tab update:', tab.url);
      trackUrlVisit(tab);
    }
  });

  // Track when new tabs are created
  chrome.tabs.onCreated.addListener((tab) => {
    console.log('New tab created:', tab.url);
    if (tab.url && isValidUrl(tab.url)) {
      console.log('Tracking URL visit from new tab:', tab.url);
      trackUrlVisit(tab);
    }
  });

  // Track when tabs are activated (user switches between tabs)
  chrome.tabs.onActivated.addListener((activeInfo) => {
    console.log('Tab activated:', activeInfo.tabId);
    handleTabActivation(activeInfo.tabId);
  });

  // Track when tabs are removed (calculate final visit duration)
  chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    console.log('Tab removed:', tabId);
    handleTabRemoval(tabId);
  });
}

// Track a URL visit
function trackUrlVisit(tab) {
  console.log('trackUrlVisit called with:', tab.url);
  
  if (!isTracking) {
    console.log('Tracking is disabled');
    return;
  }
  
  if (!tab.url) {
    console.log('No URL provided');
    return;
  }

  // Avoid tracking duplicate URLs within a short time window
  const urlKey = `${tab.url}_${Math.floor(Date.now() / 10000)}`; // 10-second window
  if (trackedUrls.has(urlKey)) {
    console.log('Skipping duplicate URL visit:', tab.url);
    return;
  }
  
  trackedUrls.add(urlKey);
  
  // Clean up old entries (keep only last 100)
  if (trackedUrls.size > 100) {
    const entries = Array.from(trackedUrls);
    trackedUrls.clear();
    entries.slice(-50).forEach(entry => trackedUrls.add(entry));
  }

  const urlData = {
    url: tab.url,
    title: tab.title || '',
    timestamp: Date.now(),
    visitCount: 1,
    tabId: tab.id,
    domain: extractDomain(tab.url)
  };

  console.log('Processing URL data:', urlData);

  // Add to local repository
  urlHistoryRepo.addURL(urlData);
  
  // Update current tab tracking
  if (tab.id === currentTabId) {
    visitStartTime = Date.now();
  }

  console.log('Successfully tracked URL visit:', urlData.url);
  
  // Sync to Firebase immediately (as you preferred)
  syncToFirebase(urlData);
}

// Handle tab activation
async function handleTabActivation(tabId) {
  // Calculate visit duration for previous tab
  if (currentTabId && visitStartTime) {
    const duration = Date.now() - visitStartTime;
    updateVisitDuration(currentTabId, duration);
  }

  // Start tracking new tab
  currentTabId = tabId;
  visitStartTime = Date.now();

  // Get current tab info and track if valid
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url && isValidUrl(tab.url)) {
      trackUrlVisit(tab);
    }
  } catch (error) {
    console.error('Error getting tab info:', error);
  }
}

// Handle tab removal
function handleTabRemoval(tabId) {
  if (tabId === currentTabId) {
    // Calculate final visit duration
    if (visitStartTime) {
      const duration = Date.now() - visitStartTime;
      updateVisitDuration(tabId, duration);
    }
    
    currentTabId = null;
    visitStartTime = null;
  }
}

// Update visit duration for a specific tab
function updateVisitDuration(tabId, duration) {
  // Update in local storage
  urlHistoryRepo.getAllURLs().then(urls => {
    const urlEntry = urls.find(url => url.tabId === tabId);
    if (urlEntry) {
      urlEntry.visitDuration = duration;
      urlHistoryRepo.save();
    }
  });
}

// Check if URL is valid for tracking
function isValidUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

// Extract domain from URL
function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return '';
  }
}

// Sync data to Firebase using REST API
async function syncToFirebase(urlData) {
  try {
    const firebaseUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/urlVisits?key=${FIREBASE_API_KEY}`;
    
    const docData = {
      fields: {
        url: { stringValue: urlData.url },
        title: { stringValue: urlData.title || '' },
        timestamp: { integerValue: urlData.timestamp.toString() },
        visitCount: { integerValue: urlData.visitCount.toString() },
        domain: { stringValue: urlData.domain || '' },
        syncedAt: { stringValue: new Date().toISOString() },
        userId: { stringValue: 'anonymous' },
        source: { stringValue: 'chrome-extension' }
      }
    };
    
    const response = await fetch(firebaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(docData)
    });
    
    if (response.ok) {
      console.log('Synced to Firebase:', urlData.url);
    } else {
      console.error('Firebase sync failed:', response.statusText);
    }
  } catch (error) {
    console.error('Firebase sync error:', error);
  }
}

// Handle messages from popup/content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);
  
  switch (request.action) {
    case 'ping':
      sendResponse({ status: 'pong', timestamp: Date.now() });
      break;
      
    case 'getStats':
      urlHistoryRepo.getStats().then(stats => {
        console.log('Sending stats:', stats);
        sendResponse(stats);
      });
      return true; // Keep message channel open for async response
      
    case 'getAllURLs':
      urlHistoryRepo.getAllURLs().then(urls => {
        console.log('Sending URLs:', urls.length);
        sendResponse(urls);
      });
      return true; // Keep message channel open for async response
      
    case 'clearData':
      urlHistoryRepo.clear();
      chrome.storage.local.clear();
      sendResponse({ success: true });
      break;
      
    case 'toggleTracking':
      isTracking = !isTracking;
      sendResponse({ tracking: isTracking });
      break;
      
    case 'getSyncStatus':
      sendResponse({
        tracking: isTracking,
        trackedUrlsCount: trackedUrls.size
      });
      break;
      
    default:
      console.log('Unknown action:', request.action);
      sendResponse({ error: 'Unknown action' });
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  console.log('Extension icon clicked');
});

// Cleanup on extension shutdown
chrome.runtime.onSuspend.addListener(() => {
  console.log('ValYou extension suspended');
  
  // Calculate final visit duration if needed
  if (currentTabId && visitStartTime) {
    const duration = Date.now() - visitStartTime;
    updateVisitDuration(currentTabId, duration);
  }
});

console.log('ValYou background service worker loaded');
console.log('Extension is ready for URL tracking');

// Test message to verify extension is working
setTimeout(() => {
  console.log('ValYou extension test - if you see this, the background script is running!');
}, 1000);