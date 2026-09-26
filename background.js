/**
 * PageCraft - Background Service Worker (Manifest V3)
 * Handles context menus, keyboard commands, and dynamic script injection.
 */

// Create Right-Click Context Menu on Installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "pagecraft-inspect-element",
    title: "✨ Inspect & Edit with PageCraft",
    contexts: ["all"]
  });
});

// Handle Context Menu Clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "pagecraft-inspect-element" && tab && tab.id) {
    // Check for restricted URLs (Chrome internal pages)
    if (isRestrictedUrl(tab.url)) {
      return;
    }

    try {
      // Send message to active tab content script
      await chrome.tabs.sendMessage(tab.id, { action: "select_target" });
    } catch (err) {
      // Content script may not be running yet on pre-existing tabs, inject it dynamically
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"]
        });
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { action: "select_target" });
        }, 150);
      } catch (injectErr) {
        console.warn("Could not inject PageCraft into this tab:", injectErr);
      }
    }
  }
});

// Handle Global Keyboard Commands (e.g., Alt+E)
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-inspector") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || isRestrictedUrl(tab.url)) return;

    try {
      await chrome.tabs.sendMessage(tab.id, { action: "toggle_inspect" });
    } catch (err) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"]
        });
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { action: "toggle_inspect" });
        }, 150);
      } catch (injectErr) {
        console.warn("Could not inject PageCraft:", injectErr);
      }
    }
  }
});

function isRestrictedUrl(url) {
  if (!url) return true;
  return (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.includes("chromewebstore.google.com")
  );
}
