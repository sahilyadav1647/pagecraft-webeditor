/**
 * PageCraft - Popup Script
 * Interacts with the active tab and provides instant inspector activation & site memory controls.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const toggleBtn = document.getElementById('btn-toggle-inspect');
  const openDemoBtn = document.getElementById('btn-open-demo');
  const clearSiteBtn = document.getElementById('btn-clear-site');
  const siteNameEl = document.getElementById('pc-site-name');
  const siteStatEl = document.getElementById('pc-site-stat');

  let activeTab = null;

  if (typeof chrome !== 'undefined' && chrome.tabs) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      activeTab = tab;

      if (tab && tab.url) {
        try {
          const urlObj = new URL(tab.url);
          siteNameEl.textContent = urlObj.hostname || 'Active Webpage';

          // Query tab for site statistics
          chrome.tabs.sendMessage(tab.id, { action: 'get_site_stats' }, (response) => {
            if (chrome.runtime.lastError || !response) {
              siteStatEl.textContent = 'Ready to customize';
              return;
            }
            if (response.count > 0) {
              siteStatEl.textContent = `💾 ${response.count} saved customization(s) active`;
              siteStatEl.style.color = '#10b981';
            } else {
              siteStatEl.textContent = 'No saved customizations yet';
              siteStatEl.style.color = '#94a3b8';
            }
          });
        } catch (e) {
          siteNameEl.textContent = 'Active Page';
        }
      }
    } catch (e) {
      console.warn('Could not query active tab:', e);
    }
  }

  // Clear site customizations
  if (clearSiteBtn) {
    clearSiteBtn.addEventListener('click', async () => {
      if (!activeTab || !activeTab.id) return;
      if (confirm('Revert and forget all saved customizations for this website?')) {
        chrome.tabs.sendMessage(activeTab.id, { action: 'clear_site_memory' }, (response) => {
          siteStatEl.textContent = 'Customizations cleared';
          siteStatEl.style.color = '#f87171';
          setTimeout(() => window.close(), 800);
        });
      }
    });
  }

  // Toggle Inspector on the current active tab
  if (toggleBtn) {
    toggleBtn.addEventListener('click', async () => {
      try {
        if (!activeTab || !activeTab.id) return;

        // Check for Chrome restricted pages
        if (
          !activeTab.url ||
          activeTab.url.startsWith('chrome://') ||
          activeTab.url.startsWith('chrome-extension://') ||
          activeTab.url.startsWith('edge://') ||
          activeTab.url.startsWith('about:') ||
          activeTab.url.includes('chromewebstore.google.com')
        ) {
          alert('⚠️ Notice: Chrome restricts extensions on internal pages (like chrome://extensions or new tab).\n\nPlease open any regular website (e.g. google.com, wikipedia.org, or your local projects) to use PageCraft!');
          return;
        }

        try {
          await chrome.tabs.sendMessage(activeTab.id, { action: 'toggle_inspect' });
          window.close();
        } catch (msgErr) {
          // If content script was not yet loaded on this pre-existing tab, inject it on the fly!
          try {
            await chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
              files: ['content.js']
            });
            setTimeout(async () => {
              try {
                await chrome.tabs.sendMessage(activeTab.id, { action: 'toggle_inspect' });
              } catch (e) {}
              window.close();
            }, 120);
          } catch (injectErr) {
            console.error('Injection error:', injectErr);
            alert('Please refresh (F5) the webpage and try again.');
          }
        }
      } catch (err) {
        console.error('Popup error:', err);
      }
    });
  }

  // Open Interactive Demo Page
  if (openDemoBtn) {
    openDemoBtn.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.runtime) {
        chrome.tabs.create({ url: chrome.runtime.getURL('demo.html') });
      } else {
        window.open('demo.html', '_blank');
      }
    });
  }
});
