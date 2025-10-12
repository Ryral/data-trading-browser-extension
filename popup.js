// This function runs when the popup is clicked
document.addEventListener("DOMContentLoaded", () => {
    // Generates lucide icons - makes whatever in lucide.js usable
    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }

    document.getElementById("marketplace").addEventListener("click", () => chrome.tabs.create({url: "marketplace.html"}));
    document.getElementById("dashboard").addEventListener("click", () => chrome.tabs.create({url: "dashboard.html"}));
    document.getElementById("browserhistory").addEventListener("click", () => chrome.tabs.create({url: "browserhistory.html"}));
    document.getElementById("settings").addEventListener("click", () => chrome.tabs.create({url: "settings.html"}));
});