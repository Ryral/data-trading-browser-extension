
// Firebase configuration
const FIREBASE_PROJECT_ID = 'valyou-bc6d4';
const FIREBASE_API_KEY = 'AIzaSyAyd0nrr1Z2QnyH8Qbd1r3gpltWZ8jGbu0';
const URL_WORTH_PER_URL = 0.10; // $0.10 per URL


let currentUser = null;

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
      console.log('Updated existing URL:', urlEntry.url, 'visit count:', this.urls[existingIndex].visitCount);
    } else {
      // Add new URL entry
      this.urls.push(urlEntry);
      console.log('Added new URL:', urlEntry.url, 'total URLs:', this.urls.length);
    }

    this.save();
    console.log('URLs saved to storage, total count:', this.urls.length);
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
    if (changeInfo.status === 'complete' && tab.url && isValidUrl(tab.url)) {
      trackUrlVisit(tab);
    }
  });

  // Track when new tabs are created
  chrome.tabs.onCreated.addListener((tab) => {
    if (tab.url && isValidUrl(tab.url)) {
      trackUrlVisit(tab);
    }
  });

  // Track when tabs are activated (user switches between tabs)
  chrome.tabs.onActivated.addListener((activeInfo) => {
    handleTabActivation(activeInfo.tabId);
  });

  // Track when tabs are removed (calculate final visit duration)
  chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    handleTabRemoval(tabId);
  });
}

// Track a URL visit
function trackUrlVisit(tab) {
  console.log('trackUrlVisit called:', tab.url, 'isTracking:', isTracking, 'currentUser:', currentUser?.email);
  
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
    console.log('Skipping duplicate URL:', tab.url);
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

  console.log('Adding URL to repository:', urlData);

  // Add to local repository
  urlHistoryRepo.addURL(urlData);
  
  // Update current tab tracking
  if (tab.id === currentTabId) {
    visitStartTime = Date.now();
  }

  console.log('Tracked URL:', urlData.url);
  
  // Sync to Firebase immediately
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
        userId: { stringValue: currentUser?.email || 'anonymous' },
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

// This duplicate message listener is removed - see the main one below

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

// User repository for managing user data
class UserRepo {
  constructor() {
    this.key = 'user_data';
  }

  async get() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.key], (result) => {
        resolve(result[this.key] || null);
      });
    });
  }

  async save(userData) {
    chrome.storage.local.set({ [this.key]: userData });
  }

  async clear() {
    chrome.storage.local.remove([this.key]);
  }
}

// URL sale tracker
class URLSaleTracker {
  constructor() {
    this.key = 'url_sales';
  }

  async load() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.key], (result) => {
        resolve(result[this.key] || []);
      });
    });
  }

  async save(sales) {
    chrome.storage.local.set({ [this.key]: sales });
  }

  async addSale(saleData) {
    const sales = await this.load();
    sales.push(saleData);
    await this.save(sales);
    return sales;
  }

  async getTotalEarnings() {
    const sales = await this.load();
    return sales.reduce((total, sale) => total + (sale.amount || 0), 0);
  }
}

const userRepo = new UserRepo();
const saleTracker = new URLSaleTracker();

// Simple email-based authentication (no OAuth required)
async function signInWithGoogle() {
  // For demo purposes, create a mock user
  const mockUser = {
    email: 'demo@valyou.com',
    name: 'Demo User',
    uid: 'demo-user-123'
  };
  
  await userRepo.save(mockUser);
  currentUser = mockUser;
  
  // Sync user data to Firebase
  await syncUserToFirebase(mockUser);
  
  return mockUser;
}

// Alternative: Simple form-based authentication
async function signInWithEmail(email, name) {
  const userData = {
    email: email,
    name: name || 'User',
    uid: email.replace('@', '-').replace('.', '-')
  };
  
  await userRepo.save(userData);
  currentUser = userData;
  
  // Sync user data to Firebase
  await syncUserToFirebase(userData);
  
  return userData;
}

// Sync user data to Firebase
async function syncUserToFirebase(userData) {
  try {
    const firebaseUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users?key=${FIREBASE_API_KEY}`;
    
    const docData = {
      fields: {
        email: { stringValue: userData.email },
        name: { stringValue: userData.name || '' },
        uid: { stringValue: userData.uid || '' },
        syncedAt: { stringValue: new Date().toISOString() },
        source: { stringValue: 'chrome-extension' }
      }
    };
    
    const response = await fetch(firebaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(docData)
    });
    
    if (response.ok) {
      console.log('User synced to Firebase:', userData.email);
    } else {
      console.error('User Firebase sync failed:', response.statusText);
    }
  } catch (error) {
    console.error('User Firebase sync error:', error);
  }
}

// Sync sale data to Firebase
async function syncSaleToFirebase(saleData) {
  try {
    const firebaseUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/sales?key=${FIREBASE_API_KEY}`;
    
    const docData = {
      fields: {
        userId: { stringValue: currentUser?.email || 'anonymous' },
        amount: { doubleValue: saleData.amount },
        urlCount: { integerValue: saleData.count.toString() },
        timestamp: { integerValue: saleData.timestamp.toString() },
        syncedAt: { stringValue: new Date().toISOString() },
        source: { stringValue: 'chrome-extension' }
      }
    };
    
    const response = await fetch(firebaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(docData)
    });
    
    if (response.ok) {
      console.log('Sale synced to Firebase:', saleData.amount);
    } else {
      console.error('Sale Firebase sync failed:', response.statusText);
    }
  } catch (error) {
    console.error('Sale Firebase sync error:', error);
  }
}

function signOut() {
  userRepo.clear();
  currentUser = null;
  chrome.identity.getAuthToken({ 'interactive': false }, (token) => {
    if (token) {
      chrome.identity.removeCachedAuthToken({ token }, () => {});
    }
  });
}

// Calculate URL worth
function calculateURLWorth(urlCount) {
  return (urlCount * URL_WORTH_PER_URL).toFixed(2);
}

// Handle messages from popup/content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'ping':
      sendResponse({ status: 'pong', timestamp: Date.now() });
      break;
      
    case 'getStats':
      urlHistoryRepo.getStats().then(stats => {
        sendResponse(stats);
      });
      return true; // Keep message channel open for async response
      
    case 'getAllURLs':
      urlHistoryRepo.getAllURLs().then(urls => {
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

    case 'signInWithGoogle':
      signInWithGoogle().then(user => {
        sendResponse({ success: true, user });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;

    case 'signInWithEmail':
      const { email, name } = request;
      signInWithEmail(email, name).then(user => {
        sendResponse({ success: true, user });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;

    case 'signOut':
      signOut();
      sendResponse({ success: true });
      break;

    case 'getCurrentUser':
      userRepo.get().then(user => {
        sendResponse({ user });
      });
      return true;

    case 'calculateURLWorth':
      urlHistoryRepo.getAllURLs().then(urls => {
        const worth = calculateURLWorth(urls.length);
        sendResponse({ count: urls.length, worth });
      });
      return true;

    case 'sellURLs':
      urlHistoryRepo.getAllURLs().then(async urls => {
        const worth = parseFloat(calculateURLWorth(urls.length));
        const saleData = {
          amount: worth,
          count: urls.length,
          timestamp: Date.now()
        };
        await saleTracker.addSale(saleData);
        
        // Sync sale to Firebase
        await syncSaleToFirebase(saleData);
        
        urlHistoryRepo.clear();
        sendResponse({ success: true, sold: saleData });
      });
      return true;

    case 'getTotalEarnings':
      saleTracker.getTotalEarnings().then(earnings => {
        sendResponse({ earnings });
      });
      return true;

    case 'getURLCount':
      urlHistoryRepo.getAllURLs().then(urls => {
        sendResponse({ count: urls.length });
      });
      return true;

    case 'getSalesHistory':
      saleTracker.load().then(sales => {
        sendResponse({ sales: sales.sort((a, b) => b.timestamp - a.timestamp) });
      });
      return true;
      
    default:
      console.log('Unknown action:', request.action);
      sendResponse({ error: 'Unknown action' });
  }
});

// Initialize on startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('ValYou extension started');
  currentUser = await userRepo.get();
  initializeTracking();
});

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('ValYou extension installed', details.reason);
  currentUser = await userRepo.get();
  
  if (details.reason === 'install') {
    // Trigger Google sign-in on first install
    chrome.tabs.create({ url: 'popup.html' });
  }
  
  initializeTracking();
});

console.log('ValYou background service worker loaded');
console.log('Extension is ready for URL tracking');

// Test message to verify extension is working
setTimeout(() => {
  console.log('ValYou extension test - if you see this, the background script is running!');
}, 1000);