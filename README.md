# PageCraft - Visual Web Editor & Inspector

> **A high-performance Chrome & Edge extension for live in-page visual inspection, direct document-style text editing, asset replacement, layout re-styling, and per-domain persistence.**  
> Built with Manifest V3 and isolated Shadow DOM architecture for zero CSS collision.

---

## Key Features

- **Direct In-Page Editing**: Highlight any text on any webpage or double-click to type directly in place, similar to modern document editors.
- **Floating Contextual Toolbar**: Selecting text on any webpage immediately reveals contextual actions:
  - `[ ✍️ Edit Text ]`: Enables in-place `contentEditable` typing.
  - `[ 🗑️ Remove Part ]`: Instantly purges the selected element or range from the DOM.
  - `[ 💾 Save ]`: Saves domain modifications to local extension storage.
- **Visual Element Inspector**: Click the floating launcher icon to inspect any button, card, headline, or layout container with bounding highlights, tag names, and computed dimensions.
- **Asset Replacement**: Swap images and media in real time via URL input or local file upload.
- **Design & Typography Controls**: Adjust font sizing, line height, text colors, background colors, padding, margins, border radii, and drop shadows.
- **Curated Style Presets**: Apply standardized styling presets (*Minimal Light, Obsidian, Glass, Clean Card, Emerald Accent*).
- **Per-Domain Persistence**: Modifications and element deletions are saved into `chrome.storage.local` under the website domain, automatically restoring on page refresh and subsequent visits.
- **Shadow DOM Encapsulation**: Complete host isolation prevents the target webpage's CSS from breaking the editor UI and ensures zero side effects on the inspected page.

---

## Installation Guide

### Option 1: Load from Source (Developer Mode)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/pagecraft-editor/pagecraft-webeditor.git
   ```
2. Open Google Chrome, Microsoft Edge, or any Chromium-based browser.
3. Navigate to `chrome://extensions` (or `edge://extensions`).
4. Enable the **Developer mode** toggle in the top-right corner.
5. Click **Load unpacked** and select the folder containing `manifest.json`.
6. The extension is now active on all websites.

---

## Usage Workflow

1. **Activate the Editor**: Click the floating launcher icon docked on the left or press `Alt + E`.
2. **Select Any Element**:
   - Highlight any text with your mouse to trigger the floating quick-action toolbar.
   - Or click any element on the page while the inspector is active.
3. **Modify Content**:
   - Edit the text in the panel textarea and click **`[ ✓ Confirm & Apply ]`**, or click **`[ ✍️ Edit Text ]`** to type directly on the page.
   - Click **`[ 🗑️ Remove This Part ]`** to delete unwanted elements, banners, or ads.
4. **Save Across Visits**:
   - Click **`[ 💾 Save For This Website ]`** to persist your changes permanently for that domain.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| **`Alt + E`** (or `Option + E`) | Toggle Inspector / Panel |
| **`Esc`** | Dismiss / Minimize Panel |
| **`Ctrl + Z`** (or `Cmd + Z`) | Undo last DOM modification |
| **`Ctrl + Shift + Z`** | Redo modification |

---

## Technical Architecture

```
pagecraft-webeditor/
├── manifest.json       # Manifest V3 configuration & permission scopes
├── content.js          # In-page inspector, selection controller & shadow host
├── content.css         # Shadow DOM styles
├── background.js       # Background service worker & context menu routing
├── popup.html          # Browser action popup UI
├── popup.css           # Popup stylesheet
├── popup.js            # Popup communication bridge
├── style.css           # Web-accessible stylesheet
├── demo.html           # Standalone component test canvas
└── icons/              # Extension icons (16px, 48px, 128px)
```

---

## License

MIT License. Free and open source.
