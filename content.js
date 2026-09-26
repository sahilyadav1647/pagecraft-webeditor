/**
 * PageCraft Visual Web Editor & AI Stylist
 * Left-Docked Floating Inspector & Live Web Modifier.
 * 
 * Workflow:
 * 1. Click Left ✨ Icon -> Panel opens immediately on the left.
 * 2. Click "🎯 Select Text or Photo" -> Click any element on the website.
 * 3. Edit text, replace photos, pick colors, apply presets or AI prompts.
 * 4. Click "💾 SAVE FOR THIS WEBSITE" -> Auto-restores every time you visit!
 */

(function () {
  if (window.__pagecraft_injected) return;
  window.__pagecraft_injected = true;

  // Global State
  let isInspecting = false;
  let selectedElement = null;
  let hoveredElement = null;
  let lastRightClickedElement = null;
  let currentSelectionRange = null;
  let currentSelectedText = '';
  const modifiedElements = new Set();
  const deletedSelectors = new Set();
  const originalStates = new Map(); // element -> { style, text, html, src }
  const historyStack = [];
  let historyIndex = -1;

  // Cross-environment Storage (Chrome Extension Storage + LocalStorage Fallback)
  const siteStorage = {
    get: (key) => new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([key], (res) => resolve(res ? res[key] : null));
      } else {
        try {
          const val = localStorage.getItem(key);
          resolve(val ? JSON.parse(val) : null);
        } catch (e) { resolve(null); }
      }
    }),
    set: (key, val) => new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [key]: val }, resolve);
      } else {
        try {
          localStorage.setItem(key, JSON.stringify(val));
          resolve();
        } catch (e) { resolve(); }
      }
    }),
    remove: (key) => new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.remove([key], resolve);
      } else {
        try {
          localStorage.removeItem(key);
          resolve();
        } catch (e) { resolve(); }
      }
    })
  };

  function getSiteKey() {
    return 'pc_site_' + (window.location.hostname || 'local') + window.location.pathname;
  }

  // Unique CSS Selector Generator
  function getElementSelector(el) {
    if (!(el instanceof Element)) return '';
    if (el.id && document.querySelectorAll('#' + CSS.escape(el.id)).length === 1) {
      return '#' + CSS.escape(el.id);
    }
    const path = [];
    let curr = el;
    while (curr && curr.nodeType === Node.ELEMENT_NODE && curr !== document.documentElement) {
      let selector = curr.nodeName.toLowerCase();
      if (curr.id && document.querySelectorAll('#' + CSS.escape(curr.id)).length === 1) {
        path.unshift('#' + CSS.escape(curr.id));
        break;
      } else {
        let sib = curr, nth = 1;
        while ((sib = sib.previousElementSibling)) {
          if (sib.nodeName.toLowerCase() === selector) nth++;
        }
        selector += ':nth-of-type(' + nth + ')';
      }
      path.unshift(selector);
      curr = curr.parentNode;
    }
    return path.join(' > ');
  }

  // Track right-clicked elements for Context Menu
  window.addEventListener('contextmenu', (e) => {
    const path = e.composedPath();
    if (!path.includes(host) && e.target) {
      lastRightClickedElement = e.target;
    }
  }, true);

  // Initialize Shadow Host safely
  const host = document.createElement('div');
  host.id = 'pagecraft-root-host';
  host.setAttribute('style', [
    'position: fixed !important',
    'top: 0 !important',
    'left: 0 !important',
    'width: 0 !important',
    'height: 0 !important',
    'z-index: 2147483647 !important',
    'border: none !important',
    'margin: 0 !important',
    'padding: 0 !important',
    'pointer-events: none !important',
    'display: block !important',
    'overflow: visible !important'
  ].join('; '));

  function attachHostToDOM() {
    if (document.getElementById('pagecraft-root-host')) return;
    const target = document.body || document.documentElement;
    if (target) {
      target.appendChild(host);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        (document.body || document.documentElement).appendChild(host);
      });
    }
  }

  attachHostToDOM();
  const shadow = host.attachShadow({ mode: 'open' });

  // CSS Stylesheet embedded directly into Shadow DOM
  const styles = document.createElement('style');
  styles.textContent = `
    :host {
      all: initial !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
      font-size: 13px !important;
      line-height: 1.5 !important;
      color: #e2e8f0 !important;
      box-sizing: border-box !important;
    }

    *, *::before, *::after {
      box-sizing: border-box !important;
      margin: 0;
      padding: 0;
    }

    /* LEFT-SIDE LAUNCHER BUTTON */
    #pc-launcher {
      position: fixed !important;
      left: 18px;
      top: 50%;
      transform: translateY(-50%);
      width: 56px !important;
      height: 56px !important;
      border-radius: 18px !important;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%) !important;
      color: #ffffff !important;
      border: 2px solid rgba(255, 255, 255, 0.65) !important;
      box-shadow: 0 12px 32px -4px rgba(124, 58, 237, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.35) inset !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      cursor: grab !important;
      z-index: 2147483647 !important;
      pointer-events: auto !important;
      user-select: none !important;
      touch-action: none !important;
      transition: box-shadow 0.25s ease, filter 0.2s ease !important;
    }

    #pc-launcher * {
      pointer-events: none !important;
    }

    #pc-launcher:hover {
      box-shadow: 0 16px 42px rgba(124, 58, 237, 0.9) !important;
      filter: brightness(1.1) !important;
    }

    #pc-launcher.dragging {
      cursor: grabbing !important;
      transform: scale(1.1) !important;
      box-shadow: 0 20px 50px rgba(124, 58, 237, 0.95) !important;
      transition: none !important;
    }

    #pc-launcher.pc-pulse-pop {
      animation: pc-pulse-pop 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
    }

    @keyframes pc-pulse-pop {
      0% { transform: scale(1); }
      35% { transform: scale(0.84); }
      70% { transform: scale(1.18); }
      100% { transform: scale(1); }
    }

    #pc-launcher.inspecting {
      background: linear-gradient(135deg, #ef4444 0%, #f97316 100%) !important;
      box-shadow: 0 10px 30px -5px rgba(239, 68, 68, 0.7) !important;
      animation: pc-pulse-glow 1.5s infinite !important;
    }

    @keyframes pc-pulse-glow {
      0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
      70% { box-shadow: 0 0 0 16px rgba(239, 68, 68, 0); }
      100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }

    #pc-launcher .icon {
      font-size: 24px !important;
      line-height: 1 !important;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3)) !important;
    }

    #pc-launcher .badge {
      position: absolute !important;
      top: -4px !important;
      right: -4px !important;
      background: #10b981 !important;
      color: #ffffff !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      min-width: 20px !important;
      height: 20px !important;
      border-radius: 10px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 0 5px !important;
      border: 2px solid #0f172a !important;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4) !important;
    }

    .pc-tooltip {
      position: absolute !important;
      left: 64px !important;
      background: rgba(15, 23, 42, 0.96) !important;
      backdrop-filter: blur(8px) !important;
      color: #f8fafc !important;
      padding: 6px 12px !important;
      border-radius: 8px !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      white-space: nowrap !important;
      pointer-events: none !important;
      opacity: 0;
      transform: translateX(-8px);
      transition: all 0.2s ease !important;
      border: 1px solid rgba(255, 255, 255, 0.15) !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4) !important;
    }

    #pc-launcher:hover .pc-tooltip {
      opacity: 1 !important;
      transform: translateX(0) !important;
    }

    /* ELEMENT HIGHLIGHTER */
    #pc-highlighter {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      pointer-events: none !important;
      border: 2px solid #6366f1 !important;
      background: rgba(99, 102, 241, 0.18) !important;
      box-shadow: 0 0 16px rgba(99, 102, 241, 0.45) !important;
      border-radius: 4px !important;
      z-index: 2147483640 !important;
      transition: all 0.05s ease-out !important;
      display: none;
    }

    #pc-highlighter.active {
      display: block !important;
    }

    #pc-badge {
      position: absolute !important;
      top: -34px !important;
      left: 0 !important;
      background: rgba(15, 23, 42, 0.96) !important;
      backdrop-filter: blur(12px) !important;
      border: 1px solid rgba(255, 255, 255, 0.18) !important;
      color: #ffffff !important;
      padding: 4px 10px !important;
      border-radius: 6px !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      white-space: nowrap !important;
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5) !important;
      pointer-events: none !important;
    }

    #pc-badge .tag {
      color: #818cf8 !important;
      font-weight: 700 !important;
      font-family: monospace !important;
    }

    #pc-badge .classes {
      color: #94a3b8 !important;
      font-family: monospace !important;
      max-width: 140px !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }

    #pc-badge .dims {
      background: rgba(255, 255, 255, 0.12) !important;
      padding: 1px 6px !important;
      border-radius: 4px !important;
      color: #38bdf8 !important;
      font-family: monospace !important;
    }

    /* LEFT-SIDE EDITOR PANEL */
    #pc-panel {
      position: fixed !important;
      left: 84px;
      top: 30px;
      width: 390px !important;
      max-height: min(600px, calc(100vh - 30px)) !important;
      height: min(600px, calc(100vh - 30px)) !important;
      background: rgba(15, 19, 32, 0.98) !important;
      backdrop-filter: blur(28px) saturate(180%) !important;
      -webkit-backdrop-filter: blur(28px) saturate(180%) !important;
      border: 1px solid rgba(255, 255, 255, 0.16) !important;
      border-radius: 18px !important;
      box-shadow: 0 24px 70px -10px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.08) inset !important;
      display: none !important;
      flex-direction: column !important;
      z-index: 2147483646 !important;
      pointer-events: none !important;
      overflow: hidden !important;
      opacity: 0;
      transform: translateX(-16px) scale(0.97);
      transition: opacity 0.25s ease, transform 0.25s ease !important;
    }

    #pc-panel.visible {
      display: flex !important;
      pointer-events: auto !important;
      opacity: 1 !important;
      transform: translateX(0) scale(1) !important;
    }

    #pc-panel.minimized {
      max-height: 52px !important;
    }

    #pc-panel.minimized .pc-panel-body,
    #pc-panel.minimized .pc-tabs,
    #pc-panel.minimized .pc-breadcrumbs,
    #pc-panel.minimized .pc-footer {
      display: none !important;
    }

    .pc-header {
      padding: 12px 16px !important;
      background: rgba(255, 255, 255, 0.04) !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      cursor: grab !important;
      user-select: none !important;
    }

    .pc-header:active {
      cursor: grabbing !important;
    }

    .pc-header-title {
      display: flex !important;
      align-items: center !important;
      gap: 10px !important;
      font-weight: 700 !important;
      font-size: 14px !important;
      color: #f8fafc !important;
    }

    .pc-logo-icon {
      width: 24px !important;
      height: 24px !important;
      background: linear-gradient(135deg, #6366f1, #d946ef) !important;
      border-radius: 6px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 13px !important;
      color: #ffffff !important;
    }

    .pc-header-actions {
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
    }

    .pc-btn-icon {
      background: transparent !important;
      border: none !important;
      color: #94a3b8 !important;
      width: 28px !important;
      height: 28px !important;
      border-radius: 6px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      cursor: pointer !important;
      font-size: 14px !important;
      transition: all 0.15s ease !important;
    }

    .pc-btn-icon:hover {
      background: rgba(255, 255, 255, 0.12) !important;
      color: #ffffff !important;
    }

    /* COMPACT ACTIVE TARGET BADGE IN HEADER */
    .pc-target-badge {
      background: rgba(56, 189, 248, 0.15) !important;
      color: #38bdf8 !important;
      border: 1px solid rgba(56, 189, 248, 0.4) !important;
      padding: 2px 8px !important;
      border-radius: 6px !important;
      font-family: -apple-system, BlinkMacSystemFont, monospace !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      max-width: 170px !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      display: inline-block !important;
    }

    /* FLOATING IN-PAGE SELECTION TOOLBAR */
    #pc-floating-toolbar {
      position: fixed !important;
      z-index: 2147483647 !important;
      display: none;
      align-items: center !important;
      gap: 6px !important;
      padding: 6px 10px !important;
      background: rgba(15, 23, 42, 0.96) !important;
      backdrop-filter: blur(16px) !important;
      -webkit-backdrop-filter: blur(16px) !important;
      border: 1px solid rgba(255, 255, 255, 0.22) !important;
      border-radius: 12px !important;
      box-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(99, 102, 241, 0.4) !important;
      pointer-events: auto !important;
      user-select: none !important;
      opacity: 0;
      transform: translateY(6px) scale(0.96);
      transition: opacity 0.18s ease, transform 0.18s ease !important;
    }

    #pc-floating-toolbar.visible {
      display: flex !important;
      opacity: 1 !important;
      transform: translateY(0) scale(1) !important;
    }

    .pc-float-btn {
      display: inline-flex !important;
      align-items: center !important;
      gap: 5px !important;
      padding: 5px 12px !important;
      font-size: 12px !important;
      font-weight: 700 !important;
      color: #ffffff !important;
      border-radius: 8px !important;
      border: none !important;
      cursor: pointer !important;
      transition: all 0.15s ease !important;
      white-space: nowrap !important;
    }

    .pc-float-btn.primary {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%) !important;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4) !important;
    }
    .pc-float-btn.primary:hover {
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%) !important;
      transform: translateY(-1px) !important;
    }

    .pc-float-btn.danger {
      background: rgba(239, 68, 68, 0.25) !important;
      border: 1px solid rgba(239, 68, 68, 0.5) !important;
      color: #fca5a5 !important;
    }
    .pc-float-btn.danger:hover {
      background: rgba(239, 68, 68, 0.45) !important;
      color: #ffffff !important;
      transform: translateY(-1px) !important;
    }

    .pc-float-btn.success {
      background: linear-gradient(135deg, #059669 0%, #10b981 100%) !important;
      color: #ffffff !important;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4) !important;
    }
    .pc-float-btn.success:hover {
      background: linear-gradient(135deg, #047857 0%, #059669 100%) !important;
      transform: translateY(-1px) !important;
    }

    .pc-tabs {
      display: flex !important;
      background: rgba(0, 0, 0, 0.3) !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
      padding: 4px 8px !important;
      gap: 4px !important;
      margin-top: 8px !important;
    }

    .pc-tab-btn {
      flex: 1 !important;
      padding: 7px 10px !important;
      background: transparent !important;
      border: none !important;
      color: #94a3b8 !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      border-radius: 8px !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 6px !important;
      transition: all 0.18s ease !important;
    }

    .pc-tab-btn:hover {
      color: #e2e8f0 !important;
      background: rgba(255, 255, 255, 0.06) !important;
    }

    .pc-tab-btn.active {
      color: #ffffff !important;
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.35) 0%, rgba(139, 92, 246, 0.25) 100%) !important;
      border: 1px solid rgba(99, 102, 241, 0.35) !important;
    }

    .pc-panel-body {
      flex: 1 1 auto !important;
      min-height: 0 !important;
      overflow-y: auto !important;
      padding: 14px 16px !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 14px !important;
      scrollbar-width: thin !important;
      scrollbar-color: rgba(255, 255, 255, 0.2) transparent !important;
    }

    .pc-panel-body::-webkit-scrollbar { width: 6px !important; }
    .pc-panel-body::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2) !important; border-radius: 3px !important; }

    .pc-tab-pane {
      display: none !important;
      flex-direction: column !important;
      gap: 14px !important;
    }

    .pc-tab-pane.active {
      display: flex !important;
    }

    .pc-section {
      display: flex !important;
      flex-direction: column !important;
      gap: 8px !important;
    }

    .pc-section-title {
      font-size: 11px !important;
      font-weight: 700 !important;
      text-transform: uppercase !important;
      letter-spacing: 0.06em !important;
      color: #94a3b8 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
    }

    .pc-row {
      display: flex !important;
      align-items: center !important;
      gap: 10px !important;
    }

    .pc-row > * { flex: 1 !important; }

    .pc-field {
      display: flex !important;
      flex-direction: column !important;
      gap: 5px !important;
    }

    .pc-label {
      font-size: 11px !important;
      font-weight: 500 !important;
      color: #cbd5e1 !important;
    }

    .pc-input, .pc-textarea, .pc-select {
      background: rgba(0, 0, 0, 0.35) !important;
      border: 1px solid rgba(255, 255, 255, 0.14) !important;
      border-radius: 8px !important;
      color: #f8fafc !important;
      padding: 8px 10px !important;
      font-size: 12px !important;
      font-family: inherit !important;
      width: 100% !important;
      outline: none !important;
    }

    .pc-input:focus, .pc-textarea:focus, .pc-select:focus {
      border-color: #818cf8 !important;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3) !important;
      background: rgba(0, 0, 0, 0.5) !important;
    }

    .pc-textarea {
      resize: vertical !important;
      min-height: 75px !important;
      line-height: 1.4 !important;
    }

    .pc-select { cursor: pointer !important; }

    /* IMAGE REPLACER BOX */
    .pc-image-box {
      background: rgba(0, 0, 0, 0.3) !important;
      border: 1px solid rgba(255, 255, 255, 0.12) !important;
      border-radius: 10px !important;
      padding: 10px !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 8px !important;
    }

    .pc-image-preview-wrap {
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
    }

    .pc-image-preview {
      width: 54px !important;
      height: 54px !important;
      border-radius: 8px !important;
      object-fit: cover !important;
      border: 1px solid rgba(255, 255, 255, 0.25) !important;
    }

    .pc-color-group {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      background: rgba(0, 0, 0, 0.3) !important;
      border: 1px solid rgba(255, 255, 255, 0.12) !important;
      padding: 5px 8px !important;
      border-radius: 8px !important;
    }

    .pc-color-preview {
      width: 24px !important;
      height: 24px !important;
      border-radius: 6px !important;
      border: 1px solid rgba(255, 255, 255, 0.3) !important;
      position: relative !important;
      overflow: hidden !important;
      cursor: pointer !important;
      flex-shrink: 0 !important;
    }

    .pc-color-input-native {
      position: absolute !important;
      top: -5px !important;
      left: -5px !important;
      width: 40px !important;
      height: 40px !important;
      opacity: 0 !important;
      cursor: pointer !important;
    }

    .pc-color-text {
      background: transparent !important;
      border: none !important;
      color: #f1f5f9 !important;
      font-family: monospace !important;
      font-size: 12px !important;
      width: 100% !important;
      outline: none !important;
    }

    .pc-slider {
      flex: 1 !important;
      -webkit-appearance: none !important;
      height: 5px !important;
      border-radius: 3px !important;
      background: rgba(255, 255, 255, 0.2) !important;
      outline: none !important;
    }

    .pc-slider::-webkit-slider-thumb {
      -webkit-appearance: none !important;
      width: 16px !important;
      height: 16px !important;
      border-radius: 50% !important;
      background: #818cf8 !important;
      box-shadow: 0 0 8px rgba(99, 102, 241, 0.8) !important;
      cursor: pointer !important;
      border: 2px solid #ffffff !important;
    }

    .pc-slider-val {
      min-width: 46px !important;
      text-align: right !important;
      font-family: monospace !important;
      font-size: 11px !important;
      color: #94a3b8 !important;
    }

    .pc-presets-grid {
      display: grid !important;
      grid-template-columns: repeat(2, 1fr) !important;
      gap: 8px !important;
    }

    .pc-preset-card {
      padding: 10px !important;
      border-radius: 10px !important;
      border: 1px solid rgba(255, 255, 255, 0.12) !important;
      background: rgba(255, 255, 255, 0.04) !important;
      cursor: pointer !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 4px !important;
      transition: all 0.2s ease !important;
      text-align: left !important;
    }

    .pc-preset-card:hover {
      background: rgba(255, 255, 255, 0.1) !important;
      border-color: rgba(99, 102, 241, 0.6) !important;
      transform: translateY(-2px) !important;
    }

    .pc-preset-title {
      font-size: 12px !important;
      font-weight: 600 !important;
      color: #f1f5f9 !important;
    }

    .pc-preset-desc {
      font-size: 10px !important;
      color: #94a3b8 !important;
    }

    .pc-ai-box {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(217, 70, 239, 0.1) 100%) !important;
      border: 1px solid rgba(99, 102, 241, 0.35) !important;
      border-radius: 12px !important;
      padding: 12px !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 10px !important;
    }

    .pc-ai-textarea {
      min-height: 70px !important;
      background: rgba(0, 0, 0, 0.45) !important;
      border: 1px solid rgba(99, 102, 241, 0.4) !important;
      border-radius: 10px !important;
      padding: 10px !important;
      color: #ffffff !important;
      font-size: 12px !important;
      resize: none !important;
      font-family: inherit !important;
      outline: none !important;
    }

    .pc-ai-chips {
      display: flex !important;
      flex-wrap: wrap !important;
      gap: 6px !important;
    }

    .pc-ai-chip {
      background: rgba(255, 255, 255, 0.08) !important;
      border: 1px solid rgba(255, 255, 255, 0.14) !important;
      color: #cbd5e1 !important;
      padding: 4px 8px !important;
      border-radius: 6px !important;
      font-size: 10px !important;
      cursor: pointer !important;
      transition: all 0.15s ease !important;
    }

    .pc-ai-chip:hover {
      background: rgba(99, 102, 241, 0.25) !important;
      color: #ffffff !important;
    }

    .pc-actions-grid {
      display: grid !important;
      grid-template-columns: repeat(2, 1fr) !important;
      gap: 8px !important;
    }

    .pc-action-btn {
      padding: 8px 10px !important;
      background: rgba(255, 255, 255, 0.06) !important;
      border: 1px solid rgba(255, 255, 255, 0.12) !important;
      border-radius: 8px !important;
      color: #e2e8f0 !important;
      font-size: 11px !important;
      font-weight: 500 !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 6px !important;
    }

    .pc-action-btn:hover {
      background: rgba(255, 255, 255, 0.14) !important;
      color: #ffffff !important;
    }

    .pc-action-btn.danger {
      color: #f87171 !important;
      border-color: rgba(239, 68, 68, 0.3) !important;
    }

    .pc-action-btn.danger:hover {
      background: rgba(239, 68, 68, 0.2) !important;
      border-color: #ef4444 !important;
    }

    /* FOOTER WITH BIG SAVE BUTTON */
    .pc-footer {
      flex-shrink: 0 !important;
      padding: 12px 16px !important;
      background: rgba(0, 0, 0, 0.4) !important;
      border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 8px !important;
    }

    .pc-footer-row {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 8px !important;
    }

    .pc-btn-save-big {
      background: linear-gradient(135deg, #059669 0%, #10b981 100%) !important;
      color: #ffffff !important;
      border: none !important;
      padding: 11px 16px !important;
      border-radius: 10px !important;
      font-size: 13px !important;
      font-weight: 700 !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 8px !important;
      width: 100% !important;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4) !important;
      transition: all 0.2s ease !important;
    }

    .pc-btn-save-big:hover {
      box-shadow: 0 6px 22px rgba(16, 185, 129, 0.6) !important;
      transform: translateY(-1px) !important;
    }

    #pc-toast {
      position: fixed !important;
      bottom: 24px !important;
      left: 20px !important;
      background: rgba(15, 23, 42, 0.96) !important;
      backdrop-filter: blur(12px) !important;
      color: #ffffff !important;
      border: 1px solid rgba(99, 102, 241, 0.45) !important;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6) !important;
      padding: 9px 16px !important;
      border-radius: 8px !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
    }

    #pc-toast.show {
      opacity: 1 !important;
      transform: translateY(0) !important;
    }
  `;
  shadow.appendChild(styles);

  // Construct UI Template
  const container = document.createElement('div');
  container.className = 'pc-app';
  container.innerHTML = `
    <!-- LEFT-SIDE LAUNCHER ICON -->
    <div id="pc-launcher" title="Click to Open PageCraft Editor (Left Side)">
      <span class="icon">✨</span>
      <span class="badge" id="pc-mod-count" style="display: none;">0</span>
      <div class="pc-tooltip">PageCraft Web Editor</div>
    </div>

    <!-- ELEMENT HIGHLIGHTER -->
    <div id="pc-highlighter">
      <div id="pc-badge">
        <span class="tag">div</span>
        <span class="classes"></span>
        <span class="dims">0 × 0</span>
      </div>
    </div>

    <!-- FLOATING IN-PAGE SELECTION TOOLBAR (Direct on selection) -->
    <div id="pc-floating-toolbar">
      <button class="pc-float-btn primary" id="pc-float-edit" title="Click to edit text directly on webpage or in panel">
        <span>✍️</span> Edit Text
      </button>
      <button class="pc-float-btn danger" id="pc-float-delete" title="Remove selected text or block from page">
        <span>🗑️</span> Remove Part
      </button>
      <button class="pc-float-btn success" id="pc-float-save" title="Save this website">
        <span>💾</span> Save
      </button>
    </div>

    <!-- LEFT-SIDE EDITOR PANEL -->
    <div id="pc-panel">
      <!-- Header -->
      <div class="pc-header" id="pc-panel-header">
        <div class="pc-header-title">
          <div class="pc-logo-icon">✨</div>
          <span style="font-weight: 700;">PageCraft</span>
          <span class="pc-target-badge" id="pc-header-target" title="Selected item on page">Ready</span>
        </div>
        <div class="pc-header-actions">
          <button class="pc-btn-icon" id="pc-btn-minimize" title="Minimize Panel">─</button>
          <button class="pc-btn-icon" id="pc-btn-close" title="Close Panel">✕</button>
        </div>
      </div>

      <!-- PARENT ELEMENT SELECTOR (EXPAND SELECTION) -->
      <div id="pc-element-nav-bar" style="display: none; margin: 6px 14px 0 14px; padding: 6px 10px; background: rgba(30, 41, 59, 0.75); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; align-items: center; justify-content: space-between; font-size: 11px;">
        <span style="color: #94a3b8; font-size: 11px;">Selected:</span>
        <button id="pc-btn-select-parent" style="background: rgba(99, 102, 241, 0.25); border: 1px solid rgba(99, 102, 241, 0.5); color: #c7d2fe; padding: 3px 9px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 4px; transition: all 0.15s ease;">
          <span>⬆️</span>
          <span id="pc-parent-tag-label">Select Outer Container</span>
        </button>
      </div>

      <!-- Navigation Tabs -->
      <div class="pc-tabs">
        <button class="pc-tab-btn active" data-tab="content">✍️ Text & Photo</button>
        <button class="pc-tab-btn" data-tab="design">🎨 Design</button>
        <button class="pc-tab-btn" data-tab="ai">🪄 Magic AI</button>
        <button class="pc-tab-btn" data-tab="structure">🧱 Tools</button>
      </div>

      <!-- Panel Body -->
      <div class="pc-panel-body">
        
        <!-- Tab 1: Content (Text & Photo) -->
        <div class="pc-tab-pane active" id="tab-content">
          <!-- Text Editing -->
          <div class="pc-section">
            <div class="pc-section-title">
              <span>Text Content</span>
              <label style="font-size: 10px; cursor: pointer; text-transform: none; color: #818cf8;">
                <input type="checkbox" id="pc-html-mode"> HTML Mode
              </label>
            </div>
            <textarea class="pc-textarea" id="pc-text-input" placeholder="Click 'Select Text or Photo' then click anything on the page..."></textarea>
            
            <!-- CONFIRM TEXT BUTTON -->
            <button class="pc-btn-save-big" id="pc-btn-confirm-text" style="margin-top: 8px; width: 100%; justify-content: center; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); font-weight: 700;">
              <span>✔️</span>
              <span id="pc-btn-confirm-text-label">CONFIRM & CHANGE TEXT</span>
            </button>

            <!-- REMOVE THIS PART BUTTON -->
            <button class="pc-action-btn danger" id="pc-btn-remove-part" style="margin-top: 8px; width: 100%; padding: 10px; font-weight: 700; font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 6px; background: rgba(239, 68, 68, 0.16); border: 1px solid rgba(239, 68, 68, 0.45); color: #fca5a5; border-radius: 8px; cursor: pointer;">
              <span>🗑️</span>
              <span>Remove This Part (Delete from Page)</span>
            </button>
          </div>

          <!-- Photo / Image Replacement -->
          <div class="pc-section" id="pc-img-section" style="display: none;">
            <div class="pc-section-title">🖼️ Replace Photo / Image</div>
            <div class="pc-image-box">
              <div class="pc-image-preview-wrap">
                <img id="pc-img-preview" class="pc-image-preview" src="" alt="Thumbnail">
                <div style="display: flex; flex-direction: column; gap: 4px; flex: 1;">
                  <span style="font-size: 11px; font-weight: 600; color: #f8fafc;">Upload Replacement</span>
                  <input type="file" id="pc-img-file" accept="image/*" class="pc-input" style="padding: 4px; font-size: 11px;">
                </div>
              </div>
              <div class="pc-field" style="margin-top: 4px;">
                <label class="pc-label">Or Image Web URL</label>
                <input type="text" class="pc-input" id="pc-img-src" placeholder="https://example.com/photo.jpg">
              </div>
              <button class="pc-btn-save-big" id="pc-btn-confirm-img" style="margin-top: 8px; background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%);">
                <span>🖼️</span>
                <span>CONFIRM & REPLACE PHOTO</span>
              </button>
            </div>
          </div>

          <!-- Link Controls -->
          <div class="pc-section" id="pc-link-section" style="display: none;">
            <div class="pc-section-title">🔗 Link URL</div>
            <div class="pc-field">
              <input type="text" class="pc-input" id="pc-link-href" placeholder="https://...">
            </div>
          </div>
        </div>

        <!-- Tab 2: Design -->
        <div class="pc-tab-pane" id="tab-design">
          <div class="pc-section">
            <div class="pc-section-title">Instant 1-Click Styles</div>
            <div class="pc-presets-grid">
              <button class="pc-preset-card" data-preset="glass">
                <span class="pc-preset-title">✨ Glassmorphism</span>
                <span class="pc-preset-desc">Blur + soft translucent border</span>
              </button>
              <button class="pc-preset-card" data-preset="gradient">
                <span class="pc-preset-title">🚀 Vibrant CTA</span>
                <span class="pc-preset-desc">Indigo gradient & glow</span>
              </button>
              <button class="pc-preset-card" data-preset="cyber">
                <span class="pc-preset-title">🔥 Cyber Neon</span>
                <span class="pc-preset-desc">Cyan glow & dark finish</span>
              </button>
              <button class="pc-preset-card" data-preset="dark">
                <span class="pc-preset-title">🌙 Obsidian Dark</span>
                <span class="pc-preset-desc">Charcoal luxury card</span>
              </button>
            </div>
          </div>

          <div class="pc-section">
            <div class="pc-section-title">Colors</div>
            <div class="pc-row">
              <div class="pc-field">
                <label class="pc-label">Text Color</label>
                <div class="pc-color-group">
                  <div class="pc-color-preview" id="pc-color-text-prev">
                    <input type="color" class="pc-color-input-native" id="pc-color-text">
                  </div>
                  <input type="text" class="pc-color-text" id="pc-color-text-val" value="#ffffff">
                </div>
              </div>
              <div class="pc-field">
                <label class="pc-label">Background</label>
                <div class="pc-color-group">
                  <div class="pc-color-preview" id="pc-color-bg-prev">
                    <input type="color" class="pc-color-input-native" id="pc-color-bg">
                  </div>
                  <input type="text" class="pc-color-text" id="pc-color-bg-val" value="#000000">
                </div>
              </div>
            </div>
          </div>

          <div class="pc-section">
            <div class="pc-section-title">Font Size & Corners</div>
            <div class="pc-field">
              <div style="display: flex; justify-content: space-between;">
                <label class="pc-label">Font Size</label>
                <span class="pc-slider-val" id="pc-font-size-val">16px</span>
              </div>
              <input type="range" class="pc-slider" id="pc-font-size" min="8" max="96" value="16">
            </div>

            <div class="pc-field">
              <div style="display: flex; justify-content: space-between;">
                <label class="pc-label">Corner Rounding</label>
                <span class="pc-slider-val" id="pc-radius-val">0px</span>
              </div>
              <input type="range" class="pc-slider" id="pc-radius" min="0" max="50" value="0">
            </div>
          </div>
        </div>

        <!-- Tab 3: Magic AI -->
        <div class="pc-tab-pane" id="tab-ai">
          <div class="pc-ai-box">
            <div style="font-size: 12px; font-weight: 700; color: #ffffff;">
              <span>🪄 AI Prompt</span>
            </div>
            <textarea class="pc-ai-textarea" id="pc-ai-prompt" placeholder="e.g. 'Make this text larger and bold emerald green' or 'Make button Apple style'"></textarea>
            <button class="pc-btn-save-big" id="pc-ai-submit" style="background: linear-gradient(135deg, #6366f1, #d946ef);">
              <span>✨ Apply AI Style</span>
            </button>
            <div class="pc-ai-chips">
              <span class="pc-ai-chip" data-prompt="Make this button look like a sleek Apple CTA with rounded pill shape">🍎 Apple Button</span>
              <span class="pc-ai-chip" data-prompt="Make this element modern glassmorphic with blur and soft border">✨ Glass Card</span>
              <span class="pc-ai-chip" data-prompt="Make font larger, extra bold, and vibrant blue">💎 Bold & Blue</span>
              <span class="pc-ai-chip" data-prompt="Add high-energy cyberpunk dark theme with glowing cyan borders">🔥 Cyberpunk</span>
            </div>
          </div>
        </div>

        <!-- Tab 4: Structure Tools -->
        <div class="pc-tab-pane" id="tab-structure">
          <div class="pc-actions-grid">
            <button class="pc-action-btn" id="pc-act-duplicate"><span>📋</span> Duplicate</button>
            <button class="pc-action-btn" id="pc-act-hide"><span>👁️</span> Hide / Show</button>
            <button class="pc-action-btn" id="pc-act-moveup"><span>⬆️</span> Move Up</button>
            <button class="pc-action-btn" id="pc-act-movedown"><span>⬇️</span> Move Down</button>
            <button class="pc-action-btn danger" id="pc-act-delete" style="grid-column: span 2;"><span>🗑️</span> Delete Item</button>
          </div>

          <div style="margin-top: 10px;">
            <button class="pc-action-btn danger" id="pc-btn-clear-site-memory" style="width: 100%;">
              <span>🧹</span> Forget All Changes on this Site
            </button>
          </div>
        </div>
      </div>

      <!-- FOOTER WITH BIG SAVE BUTTON -->
      <div class="pc-footer">
        <button class="pc-btn-save-big" id="pc-btn-save-site">
          <span>💾</span>
          <span>SAVE FOR THIS WEBSITE</span>
        </button>

        <div class="pc-footer-row">
          <div style="display: flex; gap: 4px;">
            <button class="pc-btn-icon" id="pc-btn-undo" title="Undo (Ctrl+Z)">↩️</button>
            <button class="pc-btn-icon" id="pc-btn-redo" title="Redo (Ctrl+Y)">↪️</button>
          </div>
          <span style="font-size: 11px; color: #94a3b8;" id="pc-saved-indicator">Auto-loads on reload</span>
          <button class="pc-btn-icon" id="pc-btn-copy-css" title="Copy CSS">📋</button>
        </div>
      </div>
    </div>

    <!-- Floating Notification -->
    <div id="pc-toast">✨ Notification</div>
  `;

  shadow.appendChild(container);

  // Cached Elements
  const launcher = shadow.querySelector('#pc-launcher');
  const modCountBadge = shadow.querySelector('#pc-mod-count');
  const highlighter = shadow.querySelector('#pc-highlighter');
  const badgeTag = shadow.querySelector('#pc-badge .tag');
  const badgeClasses = shadow.querySelector('#pc-badge .classes');
  const badgeDims = shadow.querySelector('#pc-badge .dims');
  const panel = shadow.querySelector('#pc-panel');
  const panelHeader = shadow.querySelector('#pc-panel-header');
  const headerTarget = shadow.querySelector('#pc-header-target');
  const toast = shadow.querySelector('#pc-toast');
  const floatingToolbar = shadow.querySelector('#pc-floating-toolbar');
  const floatBtnEdit = shadow.querySelector('#pc-float-edit');
  const floatBtnDelete = shadow.querySelector('#pc-float-delete');
  const floatBtnSave = shadow.querySelector('#pc-float-save');

  // Input Controls
  const textInput = shadow.getElementById('pc-text-input');
  const htmlModeCheckbox = shadow.getElementById('pc-html-mode');
  const btnConfirmText = shadow.getElementById('pc-btn-confirm-text');
  const btnConfirmTextLabel = shadow.getElementById('pc-btn-confirm-text-label');
  const btnRemovePart = shadow.getElementById('pc-btn-remove-part');
  const elementNavBar = shadow.getElementById('pc-element-nav-bar');
  const btnSelectParent = shadow.getElementById('pc-btn-select-parent');
  const parentTagLabel = shadow.getElementById('pc-parent-tag-label');
  const imgSection = shadow.getElementById('pc-img-section');
  const imgPreview = shadow.getElementById('pc-img-preview');
  const imgSrcInput = shadow.getElementById('pc-img-src');
  const imgFileInput = shadow.getElementById('pc-img-file');
  const btnConfirmImg = shadow.getElementById('pc-btn-confirm-img');
  const linkSection = shadow.getElementById('pc-link-section');
  const linkHrefInput = shadow.getElementById('pc-link-href');

  // Design Controls
  const colorTextInput = shadow.getElementById('pc-color-text');
  const colorTextVal = shadow.getElementById('pc-color-text-val');
  const colorTextPrev = shadow.getElementById('pc-color-text-prev');
  const colorBgInput = shadow.getElementById('pc-color-bg');
  const colorBgVal = shadow.getElementById('pc-color-bg-val');
  const colorBgPrev = shadow.getElementById('pc-color-bg-prev');
  const fontSizeSlider = shadow.getElementById('pc-font-size');
  const fontSizeVal = shadow.getElementById('pc-font-size-val');
  const radiusSlider = shadow.getElementById('pc-radius');
  const radiusVal = shadow.getElementById('pc-radius-val');

  // AI Controls
  const aiPrompt = shadow.getElementById('pc-ai-prompt');
  const aiSubmit = shadow.getElementById('pc-ai-submit');

  // Toast Helper
  let toastTimer = null;
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function updateModCount() {
    const count = modifiedElements.size + deletedSelectors.size;
    if (count > 0) {
      modCountBadge.textContent = count;
      modCountBadge.style.display = 'flex';
    } else {
      modCountBadge.style.display = 'none';
    }
  }

  function rgbToHex(rgb) {
    if (!rgb || rgb === 'transparent' || rgb.startsWith('rgba(0, 0, 0, 0)')) return '#000000';
    const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return '#ffffff';
    const hex = (x) => ('0' + parseInt(x).toString(16)).slice(-2);
    return '#' + hex(match[1]) + hex(match[2]) + hex(match[3]);
  }

  function setElementStyle(propName, value) {
    if (!selectedElement) return;
    const kebab = propName.replace(/([A-Z])/g, '-$1').toLowerCase();
    if (value === '' || value === null) {
      selectedElement.style.removeProperty(kebab);
    } else {
      selectedElement.style.setProperty(kebab, value, 'important');
    }
  }

  // --- SAVE FOR THIS WEBSITE ---
  async function saveChangesForThisWebsite() {
    if (modifiedElements.size === 0 && deletedSelectors.size === 0 && !selectedElement) {
      showToast('⚠️ No modifications to save yet! Select and edit an item first.');
      return;
    }

    const payload = [];

    // Collect modified elements
    for (const el of modifiedElements) {
      if (!document.contains(el)) continue;
      const selector = getElementSelector(el);
      if (!selector) continue;

      payload.push({
        type: 'modify',
        selector: selector,
        style: el.getAttribute('style') || '',
        innerText: el.innerText,
        innerHTML: el.innerHTML,
        tagName: el.tagName,
        src: el.tagName === 'IMG' ? el.src : null,
        href: el.tagName === 'A' ? el.getAttribute('href') : null
      });
    }

    // Collect deleted selectors so they stay deleted across reloads!
    for (const delSel of deletedSelectors) {
      payload.push({
        type: 'delete',
        selector: delSel
      });
    }

    if (payload.length === 0) {
      showToast('⚠️ Nothing to save.');
      return;
    }

    const key = getSiteKey();
    await siteStorage.set(key, payload);

    // Save button visual confirmation animation
    const saveBtn = shadow.getElementById('pc-btn-save-site');
    if (saveBtn) {
      const origHtml = saveBtn.innerHTML;
      const origBg = saveBtn.style.background;
      saveBtn.innerHTML = '<span>✅</span> <span>SAVED FOR THIS WEBSITE!</span>';
      saveBtn.style.background = 'linear-gradient(135deg, #047857 0%, #10b981 100%)';
      setTimeout(() => {
        saveBtn.innerHTML = origHtml;
        saveBtn.style.background = origBg;
      }, 2000);
    }

    showToast(`💾 Saved ${payload.length} modification(s) & removal(s) for this website!`);
    launcher.style.boxShadow = '0 0 20px #10b981 !important';
    shadow.getElementById('pc-saved-indicator').textContent = 'Saved to site memory ✅';
  }

  // Restore saved modifications when visiting the website
  async function restoreSavedSiteChanges() {
    const key = getSiteKey();
    const saved = await siteStorage.get(key);
    if (!saved || !Array.isArray(saved) || saved.length === 0) return;

    let appliedCount = 0;
    saved.forEach(item => {
      try {
        if (item.type === 'delete') {
          const el = document.querySelector(item.selector);
          if (el) {
            deletedSelectors.add(item.selector);
            el.remove();
            appliedCount++;
          }
        } else {
          const el = document.querySelector(item.selector);
          if (el) {
            if (!originalStates.has(el)) {
              originalStates.set(el, {
                style: el.getAttribute('style') || '',
                innerHTML: el.innerHTML,
                textContent: el.textContent
              });
            }

            if (item.style) el.setAttribute('style', item.style);
            if (item.innerHTML && item.tagName !== 'IMG') {
              el.innerHTML = item.innerHTML;
            } else if (item.innerText && item.tagName !== 'IMG') {
              el.innerText = item.innerText;
            }
            if (item.src && item.tagName === 'IMG') el.src = item.src;
            if (item.href && item.tagName === 'A') el.setAttribute('href', item.href);

            modifiedElements.add(el);
            appliedCount++;
          }
        }
      } catch (err) {}
    });

    if (appliedCount > 0) {
      updateModCount();
      showToast(`✨ Restored ${appliedCount} saved customization(s) on this website!`);
    }
  }

  async function clearSiteMemory() {
    const key = getSiteKey();
    await siteStorage.remove(key);
    for (const [el, orig] of originalStates.entries()) {
      if (document.contains(el)) {
        el.setAttribute('style', orig.style);
        el.innerHTML = orig.innerHTML;
      }
    }
    modifiedElements.clear();
    deletedSelectors.clear();
    updateModCount();
    if (selectedElement && document.contains(selectedElement)) syncEditorWithElement(selectedElement);
    showToast('🧹 Cleared memory for this site! Reload to restore removed elements.');
  }

  restoreSavedSiteChanges();

  // Attach Save Button
  shadow.getElementById('pc-btn-save-site').addEventListener('click', saveChangesForThisWebsite);
  shadow.getElementById('pc-btn-clear-site-memory').addEventListener('click', clearSiteMemory);

  // --- SMART PANEL POSITIONING BESIDE LAUNCHER ---
  function positionPanelBesideLauncher() {
    const lRect = launcher.getBoundingClientRect();
    const pWidth = 390;
    const pad = 14;

    // Horizontal positioning:
    // If launcher is on left half of screen, place panel to the right of launcher
    // If launcher is on right half of screen, place panel to the left of launcher
    let pLeft;
    if (lRect.left + lRect.width / 2 < window.innerWidth / 2) {
      pLeft = lRect.right + pad;
      if (pLeft + pWidth > window.innerWidth - 10) {
        pLeft = Math.max(10, window.innerWidth - pWidth - 10);
      }
    } else {
      pLeft = lRect.left - pWidth - pad;
      if (pLeft < 10) {
        pLeft = 10;
      }
    }

    // Vertical positioning:
    // Align panel top with launcher top, constrained within viewport
    let pTop = lRect.top - 20;
    const maxTop = Math.max(15, window.innerHeight - 560);
    pTop = Math.max(15, Math.min(maxTop, pTop));

    panel.style.left = `${Math.round(pLeft)}px`;
    panel.style.top = `${Math.round(pTop)}px`;
  }

  // --- DRAGGABLE LAUNCHER ICON CONTROLLER ---
  let isDownOnLauncher = false;
  let isDraggingLauncher = false;
  let hasMovedDistance = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let initLauncherLeft = 0;
  let initLauncherTop = 0;
  let justToggled = false;

  // Restore saved position if any
  try {
    const saved = JSON.parse(localStorage.getItem('pagecraft_launcher_xy'));
    if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
      const maxX = Math.max(10, window.innerWidth - 68);
      const maxY = Math.max(10, window.innerHeight - 68);
      launcher.style.setProperty('left', `${Math.max(10, Math.min(maxX, saved.x))}px`, 'important');
      launcher.style.setProperty('top', `${Math.max(10, Math.min(maxY, saved.y))}px`, 'important');
      launcher.style.setProperty('transform', 'none', 'important');
    }
  } catch (e) {}

  launcher.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isDownOnLauncher = true;
    isDraggingLauncher = false;
    hasMovedDistance = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const rect = launcher.getBoundingClientRect();
    initLauncherLeft = rect.left;
    initLauncherTop = rect.top;
    e.stopPropagation();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDownOnLauncher) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;

    if (!isDraggingLauncher && Math.hypot(dx, dy) >= 8) {
      isDraggingLauncher = true;
      hasMovedDistance = true;
      launcher.classList.add('dragging');
      launcher.style.setProperty('transform', 'none', 'important');
    }

    if (isDraggingLauncher) {
      let nextLeft = initLauncherLeft + dx;
      let nextTop = initLauncherTop + dy;

      const maxLeft = window.innerWidth - launcher.offsetWidth - 8;
      const maxTop = window.innerHeight - launcher.offsetHeight - 8;
      nextLeft = Math.max(8, Math.min(maxLeft, nextLeft));
      nextTop = Math.max(8, Math.min(maxTop, nextTop));

      launcher.style.setProperty('left', `${nextLeft}px`, 'important');
      launcher.style.setProperty('top', `${nextTop}px`, 'important');

      if (panel.classList.contains('visible')) {
        positionPanelBesideLauncher();
      }
    }
  });

  function finishPointerInteraction() {
    if (!isDownOnLauncher) return;
    isDownOnLauncher = false;
    launcher.classList.remove('dragging');

    if (isDraggingLauncher || hasMovedDistance) {
      isDraggingLauncher = false;
      hasMovedDistance = false;
      try {
        const rect = launcher.getBoundingClientRect();
        localStorage.setItem('pagecraft_launcher_xy', JSON.stringify({
          x: Math.round(rect.left),
          y: Math.round(rect.top)
        }));
      } catch (err) {}
      justToggled = true;
      setTimeout(() => { justToggled = false; }, 200);
      return;
    }

    // Moved less than 8px -> IT IS AN INTENTIONAL CLICK!
    justToggled = true;
    setTimeout(() => { justToggled = false; }, 250);
    togglePanel();
  }

  window.addEventListener('mouseup', finishPointerInteraction);

  // Touch Support for mobile / touchscreens
  launcher.addEventListener('touchstart', (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    isDownOnLauncher = true;
    isDraggingLauncher = false;
    hasMovedDistance = false;
    dragStartX = e.touches[0].clientX;
    dragStartY = e.touches[0].clientY;
    const rect = launcher.getBoundingClientRect();
    initLauncherLeft = rect.left;
    initLauncherTop = rect.top;
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!isDownOnLauncher || !e.touches || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStartX;
    const dy = e.touches[0].clientY - dragStartY;

    if (!isDraggingLauncher && Math.hypot(dx, dy) >= 8) {
      isDraggingLauncher = true;
      hasMovedDistance = true;
      launcher.classList.add('dragging');
      launcher.style.setProperty('transform', 'none', 'important');
    }

    if (isDraggingLauncher) {
      let nextLeft = initLauncherLeft + dx;
      let nextTop = initLauncherTop + dy;
      const maxLeft = window.innerWidth - launcher.offsetWidth - 8;
      const maxTop = window.innerHeight - launcher.offsetHeight - 8;
      nextLeft = Math.max(8, Math.min(maxLeft, nextLeft));
      nextTop = Math.max(8, Math.min(maxTop, nextTop));
      launcher.style.setProperty('left', `${nextLeft}px`, 'important');
      launcher.style.setProperty('top', `${nextTop}px`, 'important');
      if (panel.classList.contains('visible')) {
        positionPanelBesideLauncher();
      }
    }
  }, { passive: true });

  window.addEventListener('touchend', finishPointerInteraction);

  // Click fallback listener (e.g. keyboard navigation)
  launcher.addEventListener('click', (e) => {
    e.stopPropagation();
    if (justToggled || hasMovedDistance) return;
    togglePanel(e);
  });

  // LAUNCHER CLICK -> OPENS PANEL WITH INTERACTIVE RESPONSE!
  function togglePanel(e) {
    if (hasMovedDistance || isDraggingLauncher) return;
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }

    // Interactive button animation response
    launcher.classList.remove('pc-pulse-pop');
    void launcher.offsetWidth; // trigger reflow
    launcher.classList.add('pc-pulse-pop');

    const willOpen = !panel.classList.contains('visible');
    if (willOpen) {
      positionPanelBesideLauncher();
      panel.classList.add('visible');
      showToast('✨ PageCraft Panel Opened!');
    } else {
      panel.classList.remove('visible');
      showToast('Panel Minimized');
    }
  }

  // --- FLOATING IN-PAGE SELECTION TOOLBAR CONTROLLER ---
  function positionFloatingToolbar(range) {
    if (!range) {
      hideFloatingToolbar();
      return;
    }
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      hideFloatingToolbar();
      return;
    }

    const tbWidth = 270;
    const tbHeight = 44;
    let left = rect.left + (rect.width / 2) - (tbWidth / 2);
    let top = rect.top - tbHeight - 10;

    // Constrain within viewport
    const maxLeft = window.innerWidth - tbWidth - 12;
    left = Math.max(12, Math.min(maxLeft, left));

    if (top < 12) {
      top = rect.bottom + 10;
    }

    floatingToolbar.style.left = `${Math.round(left)}px`;
    floatingToolbar.style.top = `${Math.round(top)}px`;
    floatingToolbar.classList.add('visible');
  }

  function hideFloatingToolbar() {
    floatingToolbar.classList.remove('visible');
  }

  // --- DIRECT IN-PAGE TEXT EDITING (TYPE DIRECTLY ON WEBPAGE) ---
  let activeEditableElement = null;

  function makeElementDirectlyEditable(el) {
    if (!el || el === host || host.contains(el)) return;
    if (activeEditableElement && activeEditableElement !== el) {
      finishDirectEditing(activeEditableElement);
    }

    activeEditableElement = el;
    el.contentEditable = 'true';
    el.spellcheck = false;
    el.style.setProperty('outline', '2px dashed #6366f1', 'important');
    el.style.setProperty('outline-offset', '3px', 'important');
    el.focus();

    showToast('✍️ Type directly on the page! Click outside or Save when done.');

    const onInput = () => {
      modifiedElements.add(el);
      updateModCount();
      textInput.value = el.innerText;
    };

    const onBlur = () => {
      finishDirectEditing(el);
      el.removeEventListener('input', onInput);
      el.removeEventListener('blur', onBlur);
    };

    el.addEventListener('input', onInput);
    el.addEventListener('blur', onBlur);
  }

  function finishDirectEditing(el) {
    if (!el) return;
    el.contentEditable = 'false';
    el.style.removeProperty('outline');
    el.style.removeProperty('outline-offset');
    pushHistory(el, 'Direct in-page text edit');
    if (activeEditableElement === el) activeEditableElement = null;
  }

  // --- FLOATING TOOLBAR BUTTON ACTIONS ---
  floatBtnEdit.addEventListener('click', (e) => {
    e.stopPropagation();
    hideFloatingToolbar();
    if (selectedElement) {
      makeElementDirectlyEditable(selectedElement);
      if (!panel.classList.contains('visible')) {
        positionPanelBesideLauncher();
        panel.classList.add('visible');
      }
    }
  });

  floatBtnDelete.addEventListener('click', (e) => {
    e.stopPropagation();
    hideFloatingToolbar();
    if (!selectedElement) return;

    if (currentSelectionRange && currentSelectedText && document.contains(currentSelectionRange.commonAncestorContainer)) {
      try {
        currentSelectionRange.deleteContents();
        selectedElement.normalize();
        pushHistory(selectedElement, 'Delete Selected Text');
        showToast('🗑️ Text removed from page! Click Save to keep it permanent.');
        currentSelectionRange = null;
        currentSelectedText = '';
        return;
      } catch (err) {}
    }

    // Remove the whole element if range wasn't applicable
    const elToRemove = selectedElement;
    const sel = getElementSelector(elToRemove);
    if (sel) deletedSelectors.add(sel);
    pushHistory(elToRemove, 'Remove Element');
    elToRemove.remove();
    modifiedElements.delete(elToRemove);
    selectedElement = null;
    updateModCount();
    showToast('🗑️ Part removed from page! Click Save to keep it permanent.');
  });

  floatBtnSave.addEventListener('click', (e) => {
    e.stopPropagation();
    hideFloatingToolbar();
    saveChangesForThisWebsite();
  });

  // --- NATIVE TEXT SELECTION LISTENER (MOUSE DRAG / HIGHLIGHT) ---
  let wasTextSelection = false;

  document.addEventListener('mouseup', (e) => {
    const path = e.composedPath ? e.composedPath() : [];
    if (path.includes(host)) return; // Ignore inside PageCraft host

    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : '';

    if (text && text.length > 0) {
      wasTextSelection = true;
      setTimeout(() => { wasTextSelection = false; }, 350);

      try {
        const range = sel.getRangeAt(0);
        let container = range.commonAncestorContainer;
        if (container.nodeType === Node.TEXT_NODE) {
          container = container.parentElement;
        }

        if (container && container !== host && !host.contains(container)) {
          selectedElement = container;
          currentSelectionRange = range.cloneRange();
          currentSelectedText = text;

          syncEditorWithElement(container);
          textInput.value = text;
          headerTarget.textContent = `Selected: "${text.slice(0, 14)}${text.length > 14 ? '...' : ''}"`;
          
          if (elementNavBar) {
            elementNavBar.style.display = 'flex';
            if (parentTagLabel && container.parentElement) {
              parentTagLabel.textContent = `Select Outer <${container.parentElement.tagName.toLowerCase()}>`;
            }
          }

          // Show floating toolbar directly above highlighted text on the page!
          positionFloatingToolbar(range);

          // Open PageCraft panel beside launcher if not already open
          if (!panel.classList.contains('visible')) {
            positionPanelBesideLauncher();
            panel.classList.add('visible');
          }

          showToast(`🎯 Selected: "${text.slice(0, 24)}${text.length > 24 ? '...' : ''}"`);
          return;
        }
      } catch (err) {}
    } else {
      // If clicked without selecting text and didn't click inside floating toolbar, hide toolbar
      if (!path.includes(floatingToolbar)) {
        hideFloatingToolbar();
      }
    }

    // Direct click to select an element on page when panel is open
    if (panel.classList.contains('visible') && !path.includes(host) && !wasTextSelection) {
      const target = e.target;
      if (target && target !== document.body && target !== document.documentElement && target !== host) {
        currentSelectionRange = null;
        currentSelectedText = '';
        selectElement(target);
      }
    }
  });

  // Double-click on any text on the webpage to edit it directly in-page!
  document.addEventListener('dblclick', (e) => {
    const path = e.composedPath ? e.composedPath() : [];
    if (path.includes(host)) return;
    if (e.target && e.target !== document.body && e.target !== document.documentElement && e.target !== host) {
      selectElement(e.target);
      makeElementDirectlyEditable(e.target);
    }
  });

  // Keep floating toolbar positioned when scrolling
  window.addEventListener('scroll', () => {
    if (floatingToolbar.classList.contains('visible') && currentSelectionRange) {
      positionFloatingToolbar(currentSelectionRange);
    }
  }, { passive: true });

  // Track Mouse movement for Inspector Highlight when panel is open
  window.addEventListener('mousemove', (e) => {
    if (!panel.classList.contains('visible')) {
      highlighter.classList.remove('active');
      return;
    }

    const path = e.composedPath ? e.composedPath() : [];
    if (path.includes(host)) {
      highlighter.classList.remove('active');
      return;
    }

    const target = e.target;
    if (!target || target === document.body || target === document.documentElement || target === host) {
      highlighter.classList.remove('active');
      return;
    }

    hoveredElement = target;
    const rect = target.getBoundingClientRect();

    highlighter.style.top = `${rect.top}px`;
    highlighter.style.left = `${rect.left}px`;
    highlighter.style.width = `${rect.width}px`;
    highlighter.style.height = `${rect.height}px`;
    highlighter.classList.add('active');

    badgeTag.textContent = target.tagName.toLowerCase();
    const classes = Array.from(target.classList).slice(0, 2).map(c => `.${c}`).join('');
    const id = target.id ? `#${target.id}` : '';
    badgeClasses.textContent = (id + classes) || '';
    badgeDims.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)} px`;
  }, true);

  // Click handler to prevent page navigation while editing
  window.addEventListener('click', (e) => {
    const path = e.composedPath ? e.composedPath() : [];
    if (path.includes(host)) return;

    if (wasTextSelection) {
      return;
    }

    if (panel.classList.contains('visible')) {
      if (e.target.closest('a') || e.target.closest('button')) {
        e.preventDefault();
      }
      if (e.target && e.target !== document.body && e.target !== document.documentElement && e.target !== host) {
        selectElement(e.target);
      }
    }
  }, true);

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      if (e.shiftKey) redoAction();
      else undoAction();
    }
  });

  // Select an Element and populate Editor UI
  function selectElement(el) {
    if (!el || el === host) return;
    selectedElement = el;

    if (!originalStates.has(el)) {
      originalStates.set(el, {
        style: el.getAttribute ? (el.getAttribute('style') || '') : '',
        innerHTML: el.innerHTML || '',
        textContent: el.textContent || ''
      });
    }

    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const firstClass = el.classList && el.classList.length ? `.${el.classList[0]}` : '';
    headerTarget.textContent = `<${tag}${id || firstClass}>`;

    // Parent container navigation bar
    if (elementNavBar) {
      if (el.parentElement && el.parentElement !== document.body && el.parentElement !== document.documentElement && el.parentElement !== host) {
        elementNavBar.style.display = 'flex';
        const pTag = el.parentElement.tagName.toLowerCase();
        const pId = el.parentElement.id ? `#${el.parentElement.id}` : '';
        if (parentTagLabel) {
          parentTagLabel.textContent = `Select Outer <${pTag}${pId}> Box`;
        }
      } else {
        elementNavBar.style.display = 'none';
      }
    }

    syncEditorWithElement(el);
    positionPanelBesideLauncher();
    panel.classList.add('visible');
  }

  function syncEditorWithElement(el) {
    const comp = window.getComputedStyle(el);

    htmlModeCheckbox.checked = false;
    textInput.value = el.innerText || el.textContent || '';

    // Image / Photo Controls
    if (el.tagName === 'IMG') {
      imgSection.style.display = 'flex';
      imgSrcInput.value = el.src || '';
      imgPreview.src = el.src || '';
    } else {
      imgSection.style.display = 'none';
    }

    // Link Controls
    if (el.tagName === 'A') {
      linkSection.style.display = 'flex';
      linkHrefInput.value = el.getAttribute('href') || '';
    } else {
      linkSection.style.display = 'none';
    }

    // Colors
    const textHex = rgbToHex(comp.color);
    colorTextInput.value = textHex;
    colorTextVal.value = textHex;
    colorTextPrev.style.background = comp.color;

    const bgHex = rgbToHex(comp.backgroundColor);
    colorBgInput.value = bgHex;
    colorBgVal.value = bgHex;
    colorBgPrev.style.background = comp.backgroundColor;

    // Font Size
    const fSize = parseInt(comp.fontSize) || 16;
    fontSizeSlider.value = fSize;
    fontSizeVal.textContent = `${fSize}px`;

    // Radius
    const rad = parseInt(comp.borderRadius) || 0;
    radiusSlider.value = rad;
    radiusVal.textContent = `${rad}px`;
  }

  function pushHistory(el, desc) {
    if (!el) return;
    if (document.contains(el)) {
      modifiedElements.add(el);
    }
    updateModCount();

    if (historyIndex < historyStack.length - 1) {
      historyStack.splice(historyIndex + 1);
    }

    historyStack.push({
      element: el,
      parent: el.parentNode,
      nextSibling: el.nextSibling,
      style: el.getAttribute ? (el.getAttribute('style') || '') : '',
      innerHTML: el.innerHTML || '',
      src: el.src || '',
      href: el.getAttribute ? el.getAttribute('href') : '',
      description: desc
    });

    historyIndex = historyStack.length - 1;
  }

  function undoAction() {
    if (historyIndex > 0) {
      historyIndex--;
      applySnapshot(historyStack[historyIndex]);
      showToast(`↩️ Undo: ${historyStack[historyIndex].description || ''}`);
    } else if (historyIndex === 0) {
      const snapshot = historyStack[0];
      const orig = originalStates.get(snapshot.element);
      if (orig) {
        if (!document.contains(snapshot.element) && snapshot.parent) {
          snapshot.parent.insertBefore(snapshot.element, snapshot.nextSibling);
          const sel = getElementSelector(snapshot.element);
          if (sel) deletedSelectors.delete(sel);
        }
        if (snapshot.element.setAttribute) {
          snapshot.element.setAttribute('style', orig.style);
        }
        snapshot.element.innerHTML = orig.innerHTML;
      }
      historyIndex = -1;
      updateModCount();
      showToast('↩️ Reverted to original');
    }
  }

  function redoAction() {
    if (historyIndex < historyStack.length - 1) {
      historyIndex++;
      applySnapshot(historyStack[historyIndex]);
      showToast(`↪️ Redo`);
    }
  }

  function applySnapshot(snapshot) {
    if (!snapshot || !snapshot.element) return;
    
    // If element was removed from DOM, restore it into its parent
    if (!document.contains(snapshot.element) && snapshot.parent) {
      snapshot.parent.insertBefore(snapshot.element, snapshot.nextSibling);
      const sel = getElementSelector(snapshot.element);
      if (sel) deletedSelectors.delete(sel);
    }

    if (snapshot.element.setAttribute && snapshot.style !== undefined) {
      snapshot.element.setAttribute('style', snapshot.style);
    }
    if (snapshot.innerHTML !== undefined) {
      snapshot.element.innerHTML = snapshot.innerHTML;
    }
    if (snapshot.src && snapshot.element.tagName === 'IMG') {
      snapshot.element.src = snapshot.src;
    }
    if (snapshot.href && snapshot.element.tagName === 'A') {
      snapshot.element.setAttribute('href', snapshot.href);
    }
    if (selectedElement === snapshot.element) {
      syncEditorWithElement(snapshot.element);
    }
    updateModCount();
  }

  // --- CONFIRM & CHANGE TEXT ACTION ---
  btnConfirmText.addEventListener('click', () => {
    if (!selectedElement) {
      showToast('⚠️ Please highlight text or click an item on the page first!');
      return;
    }

    const newText = textInput.value;

    if (currentSelectionRange && currentSelectedText && document.contains(currentSelectionRange.commonAncestorContainer)) {
      try {
        currentSelectionRange.deleteContents();
        const textNode = document.createTextNode(newText);
        currentSelectionRange.insertNode(textNode);
        selectedElement.normalize();
        pushHistory(selectedElement, 'Change Selected Text');
        currentSelectionRange = null;
        currentSelectedText = '';
      } catch (err) {
        if (htmlModeCheckbox.checked) {
          selectedElement.innerHTML = newText;
        } else {
          selectedElement.innerText = newText;
        }
        pushHistory(selectedElement, 'Confirm Text');
      }
    } else {
      if (htmlModeCheckbox.checked) {
        selectedElement.innerHTML = newText;
      } else {
        selectedElement.innerText = newText;
      }
      pushHistory(selectedElement, 'Confirm Text');
    }

    // High-contrast emerald pulse outline for instant confirmation
    const prevOutline = selectedElement.style.outline;
    selectedElement.style.outline = '3px solid #10b981';
    setTimeout(() => {
      selectedElement.style.outline = prevOutline;
    }, 1200);

    // Button visual feedback animation
    const origBg = btnConfirmText.style.background;
    btnConfirmText.style.background = 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
    if (btnConfirmTextLabel) btnConfirmTextLabel.textContent = 'TEXT CHANGED! ✔️';
    setTimeout(() => {
      btnConfirmText.style.background = origBg;
      if (btnConfirmTextLabel) btnConfirmTextLabel.textContent = 'CONFIRM & CHANGE TEXT';
    }, 1500);

    showToast('✔️ Text changed! Click "SAVE FOR THIS WEBSITE" to keep it permanent.');
  });

  // --- REMOVE THIS PART (DELETE FROM PAGE) ACTION ---
  btnRemovePart.addEventListener('click', () => {
    if (!selectedElement) {
      showToast('⚠️ Please click or select an item on the page to remove!');
      return;
    }

    // If user highlighted a specific text selection, remove that text
    if (currentSelectionRange && currentSelectedText && document.contains(currentSelectionRange.commonAncestorContainer)) {
      try {
        currentSelectionRange.deleteContents();
        selectedElement.normalize();
        pushHistory(selectedElement, 'Delete Selected Text');
        currentSelectionRange = null;
        currentSelectedText = '';
        textInput.value = selectedElement.innerText || '';
        headerTarget.textContent = `<${selectedElement.tagName.toLowerCase()}>`;
        showToast('🗑️ Selected text removed! Click "SAVE FOR THIS WEBSITE" to keep it permanent.');
        return;
      } catch (err) {}
    }

    const elToRemove = selectedElement;
    const selector = getElementSelector(elToRemove);
    if (selector) {
      deletedSelectors.add(selector);
    }

    pushHistory(elToRemove, 'Remove Element');

    elToRemove.remove();
    modifiedElements.delete(elToRemove);
    selectedElement = null;
    currentSelectionRange = null;
    currentSelectedText = '';

    textInput.value = '';
    headerTarget.textContent = 'Ready';
    if (elementNavBar) elementNavBar.style.display = 'none';

    updateModCount();
    showToast('🗑️ Part removed from page! Click "SAVE FOR THIS WEBSITE" to keep it removed.');
  });

  // --- CONFIRM & REPLACE PHOTO ACTION ---
  btnConfirmImg.addEventListener('click', () => {
    if (!selectedElement || selectedElement.tagName !== 'IMG') {
      showToast('⚠️ Please select an image first!');
      return;
    }

    const newSrc = imgSrcInput.value.trim();
    if (!newSrc) {
      showToast('⚠️ Please enter an image URL or choose a file!');
      return;
    }

    selectedElement.src = newSrc;
    imgPreview.src = newSrc;
    pushHistory(selectedElement, 'Confirm Image');

    const origBg = btnConfirmImg.style.background;
    btnConfirmImg.style.background = 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
    btnConfirmImg.innerHTML = '<span>✅</span> <span>PHOTO REPLACED!</span>';
    setTimeout(() => {
      btnConfirmImg.style.background = origBg;
      btnConfirmImg.innerHTML = '<span>🖼️</span> <span>CONFIRM & REPLACE PHOTO</span>';
    }, 1500);

    showToast('🖼️ Photo updated! Click "SAVE FOR THIS WEBSITE" to keep it permanent.');
  });

  // --- SELECT PARENT CONTAINER ACTION ---
  if (btnSelectParent) {
    btnSelectParent.addEventListener('click', () => {
      if (selectedElement && selectedElement.parentElement && 
          selectedElement.parentElement !== document.body && 
          selectedElement.parentElement !== document.documentElement && 
          selectedElement.parentElement !== host) {
        selectElement(selectedElement.parentElement);
        showToast(`⬆️ Selected outer <${selectedElement.tagName.toLowerCase()}> container`);
      } else {
        showToast('⚠️ Already at outermost container');
      }
    });
  }

  // Live text input (instant preview while typing)
  textInput.addEventListener('input', () => {
    if (!selectedElement) return;
    if (htmlModeCheckbox.checked) {
      selectedElement.innerHTML = textInput.value;
    } else {
      selectedElement.innerText = textInput.value;
    }
    pushHistory(selectedElement, 'Update Text');
  });

  htmlModeCheckbox.addEventListener('change', () => {
    if (!selectedElement) return;
    textInput.value = htmlModeCheckbox.checked ? selectedElement.innerHTML : selectedElement.innerText;
  });

  // Image URL Input
  imgSrcInput.addEventListener('input', () => {
    if (selectedElement && selectedElement.tagName === 'IMG') {
      selectedElement.src = imgSrcInput.value;
      imgPreview.src = imgSrcInput.value;
      pushHistory(selectedElement, 'Update Image URL');
    }
  });

  // Image Local File Upload
  imgFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && selectedElement && selectedElement.tagName === 'IMG') {
      const reader = new FileReader();
      reader.onload = (event) => {
        selectedElement.src = event.target.result;
        imgPreview.src = event.target.result;
        imgSrcInput.value = event.target.result;
        pushHistory(selectedElement, 'Uploaded New Image');
        showToast('🖼️ Photo replaced successfully!');
      };
      reader.readAsDataURL(file);
    }
  });

  // Link Href
  linkHrefInput.addEventListener('input', () => {
    if (selectedElement && selectedElement.tagName === 'A') {
      selectedElement.setAttribute('href', linkHrefInput.value);
      pushHistory(selectedElement, 'Update Link');
    }
  });

  // Colors
  function applyTextColor(val) {
    if (!selectedElement) return;
    setElementStyle('color', val);
    colorTextVal.value = val;
    colorTextPrev.style.background = val;
    pushHistory(selectedElement, 'Text Color');
  }
  colorTextInput.addEventListener('input', (e) => applyTextColor(e.target.value));
  colorTextVal.addEventListener('change', (e) => applyTextColor(e.target.value));

  function applyBgColor(val) {
    if (!selectedElement) return;
    setElementStyle('backgroundColor', val);
    colorBgVal.value = val;
    colorBgPrev.style.background = val;
    pushHistory(selectedElement, 'Background Color');
  }
  colorBgInput.addEventListener('input', (e) => applyBgColor(e.target.value));
  colorBgVal.addEventListener('change', (e) => applyBgColor(e.target.value));

  // Font Size
  fontSizeSlider.addEventListener('input', (e) => {
    if (!selectedElement) return;
    const val = `${e.target.value}px`;
    fontSizeVal.textContent = val;
    setElementStyle('fontSize', val);
  });
  fontSizeSlider.addEventListener('change', () => pushHistory(selectedElement, 'Font Size'));

  // Corner Radius
  radiusSlider.addEventListener('input', (e) => {
    if (!selectedElement) return;
    const val = `${e.target.value}px`;
    radiusVal.textContent = val;
    setElementStyle('borderRadius', val);
  });
  radiusSlider.addEventListener('change', () => pushHistory(selectedElement, 'Border Radius'));

  // Presets
  const presets = {
    glass: {
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      backdropFilter: 'blur(16px)',
      webkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.3)',
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
      color: '#ffffff'
    },
    gradient: {
      backgroundImage: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%)',
      color: '#ffffff',
      border: 'none',
      borderRadius: '12px',
      boxShadow: '0 8px 25px rgba(99, 102, 241, 0.5)',
      fontWeight: '600'
    },
    cyber: {
      backgroundColor: '#0a0f1d',
      color: '#00f2fe',
      border: '2px solid #00f2fe',
      borderRadius: '8px',
      boxShadow: '0 0 18px rgba(0, 242, 254, 0.6)',
      fontFamily: 'monospace'
    },
    dark: {
      backgroundColor: '#18181b',
      color: '#f4f4f5',
      border: '1px solid #27272a',
      borderRadius: '12px',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)'
    }
  };

  shadow.querySelectorAll('.pc-preset-card').forEach(card => {
    card.addEventListener('click', () => {
      if (!selectedElement) return;
      const p = presets[card.dataset.preset];
      if (p) {
        for (const [key, val] of Object.entries(p)) {
          setElementStyle(key, val);
        }
        syncEditorWithElement(selectedElement);
        pushHistory(selectedElement, `Preset: ${card.dataset.preset}`);
        showToast(`✨ Applied Preset: ${card.querySelector('.pc-preset-title').textContent}`);
      }
    });
  });

  // AI Prompt Logic
  function parseAndApplyAIPrompt(prompt) {
    if (!selectedElement || !prompt.trim()) return;
    const lower = prompt.toLowerCase();
    let count = 0;

    const textMatch = lower.match(/(?:change text to|set text to|text:)\s*["']?([^"'\n,]+)["']?/i);
    if (textMatch && textMatch[1]) {
      selectedElement.innerText = textMatch[1].trim();
      count++;
    }

    if (lower.includes('glass')) {
      for (const [k, v] of Object.entries(presets.glass)) setElementStyle(k, v);
      count++;
    }
    if (lower.includes('apple')) {
      setElementStyle('backgroundColor', '#0071e3');
      setElementStyle('color', '#ffffff');
      setElementStyle('borderRadius', '980px');
      setElementStyle('padding', '12px 24px');
      setElementStyle('border', 'none');
      count++;
    }
    if (lower.includes('blue')) { setElementStyle('color', '#3b82f6'); count++; }
    if (lower.includes('green') || lower.includes('emerald')) { setElementStyle('color', '#10b981'); count++; }
    if (lower.includes('red')) { setElementStyle('color', '#ef4444'); count++; }
    if (lower.includes('bold')) { setElementStyle('fontWeight', '700'); count++; }
    if (lower.includes('larger') || lower.includes('bigger')) {
      const curr = parseInt(window.getComputedStyle(selectedElement).fontSize) || 16;
      setElementStyle('fontSize', `${curr + 6}px`);
      count++;
    }

    syncEditorWithElement(selectedElement);
    pushHistory(selectedElement, 'AI Style');
    showToast(`🪄 AI applied ${count || 1} change(s)!`);
  }

  aiSubmit.addEventListener('click', () => parseAndApplyAIPrompt(aiPrompt.value));
  shadow.querySelectorAll('.pc-ai-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      aiPrompt.value = chip.dataset.prompt;
      parseAndApplyAIPrompt(chip.dataset.prompt);
    });
  });

  // Tab switching
  shadow.querySelectorAll('.pc-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      shadow.querySelectorAll('.pc-tab-btn').forEach(b => b.classList.remove('active'));
      shadow.querySelectorAll('.pc-tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const targetPane = shadow.getElementById(`tab-${btn.dataset.tab}`);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  shadow.getElementById('pc-btn-minimize').addEventListener('click', () => panel.classList.toggle('minimized'));
  shadow.getElementById('pc-btn-close').addEventListener('click', () => panel.classList.remove('visible'));

  // Draggable Panel Header
  let isDragging = false;
  let dragX, dragY, pX, pY;
  panelHeader.addEventListener('mousedown', (e) => {
    if (e.target.closest('.pc-btn-icon')) return;
    isDragging = true;
    dragX = e.clientX;
    dragY = e.clientY;
    const rect = panel.getBoundingClientRect();
    pX = rect.left;
    pY = rect.top;
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    panel.style.left = `${pX + (e.clientX - dragX)}px`;
    panel.style.top = `${pY + (e.clientY - dragY)}px`;
  });
  window.addEventListener('mouseup', () => { isDragging = false; });

  // DOM Tools
  shadow.getElementById('pc-act-duplicate').addEventListener('click', () => {
    if (!selectedElement || !selectedElement.parentElement) return;
    const clone = selectedElement.cloneNode(true);
    selectedElement.parentElement.insertBefore(clone, selectedElement.nextSibling);
    pushHistory(clone, 'Duplicate');
    selectElement(clone);
    showToast('📋 Duplicated element!');
  });

  shadow.getElementById('pc-act-hide').addEventListener('click', () => {
    if (!selectedElement) return;
    if (selectedElement.style.display === 'none') {
      setElementStyle('display', '');
      showToast('👁️ Item visible');
    } else {
      setElementStyle('display', 'none');
      showToast('👁️ Item hidden');
    }
  });

  shadow.getElementById('pc-act-moveup').addEventListener('click', () => {
    if (!selectedElement || !selectedElement.previousElementSibling) return;
    selectedElement.parentElement.insertBefore(selectedElement, selectedElement.previousElementSibling);
    showToast('⬆️ Moved up');
  });

  shadow.getElementById('pc-act-movedown').addEventListener('click', () => {
    if (!selectedElement || !selectedElement.nextElementSibling) return;
    selectedElement.parentElement.insertBefore(selectedElement.nextElementSibling, selectedElement);
    showToast('⬇️ Moved down');
  });

  shadow.getElementById('pc-act-delete').addEventListener('click', () => {
    if (!selectedElement) return;
    const elToRemove = selectedElement;
    const sel = getElementSelector(elToRemove);
    if (sel) deletedSelectors.add(sel);
    pushHistory(elToRemove, 'Delete Element');
    elToRemove.remove();
    modifiedElements.delete(elToRemove);
    selectedElement = null;
    headerTarget.textContent = 'Ready';
    if (elementNavBar) elementNavBar.style.display = 'none';
    updateModCount();
    showToast('🗑️ Item deleted (Ctrl+Z to undo, click Save to persist)');
  });

  shadow.getElementById('pc-btn-undo').addEventListener('click', undoAction);
  shadow.getElementById('pc-btn-redo').addEventListener('click', redoAction);
  shadow.getElementById('pc-btn-copy-css').addEventListener('click', () => {
    if (!selectedElement) return;
    const sel = getElementSelector(selectedElement);
    const css = `${sel} {\n  ${(selectedElement.getAttribute('style') || '').split(';').map(s => s.trim()).filter(Boolean).join(';\n  ')};\n}`;
    navigator.clipboard.writeText(css).then(() => showToast('📋 Copied CSS!'));
  });
  // Handle messages from Extension Popup or Background
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'toggle_inspect' || request.action === 'open_panel') {
        positionPanelBesideLauncher();
        panel.classList.add('visible');
        sendResponse({ success: true });
      } else if (request.action === 'select_target') {
        positionPanelBesideLauncher();
        panel.classList.add('visible');
        if (lastRightClickedElement) {
          selectElement(lastRightClickedElement);
        }
        sendResponse({ success: true });
      } else if (request.action === 'get_site_stats') {
        sendResponse({ count: modifiedElements.size });
      } else if (request.action === 'clear_site_memory') {
        clearSiteMemory().then(() => sendResponse({ success: true }));
        return true;
      }
    });
  }

})();

