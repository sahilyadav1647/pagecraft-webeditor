# ✨ PageCraft - Visual Web Editor & AI Stylist

> **Inspect, visually edit text, swap photos, customize styles, remove unwanted elements, and permanently save changes on any website in Google Chrome & Edge.**  
> Built with Manifest V3 and isolated Shadow DOM architecture.

---

## 🌟 Features

- 🖱️ **Direct In-Page Editing**: Highlight any text on any webpage or double-click to type directly like a Word document or Google Doc.
- 🪄 **Floating Selection Toolbar**: Select any text on a webpage to instantly bring up the in-page quick-action toolbar:
  - `[ ✍️ Edit Text ]`: Activates in-place typing.
  - `[ 🗑️ Remove Part ]`: Instantly deletes the highlighted text or section.
  - `[ 💾 Save ]`: Saves changes immediately.
- 🎯 **Visual Element Inspector**: Click the floating launcher icon to inspect any button, card, header, or image with live bounding highlights, tag names, and computed dimensions.
- 🖼️ **Image & Photo Swapper**: Replace photos on any website by pasting an image URL or uploading a local image from your computer.
- 🎨 **Live Design & Style Controls**: Adjust typography, font sizes, text & background colors, margins, padding, border radiuses, and box shadows.
- ⚡ **1-Click Modern Presets**: Apply curated styles instantly: *Glassmorphism, Cyber Neon, Obsidian Dark, Minimal Luxe, Vibrant CTA, and Emerald*.
- 💾 **Per-Website Permanent Memory**: Click **"SAVE FOR THIS WEBSITE"** — all your text edits, style customizations, and removed sections are stored in `chrome.storage.local` and automatically restore every time you visit or refresh that website!
- 🛡️ **Shadow DOM Isolation**: The editor UI runs inside an isolated Shadow Root so that host website styles can never break PageCraft, and PageCraft never interferes with the website's layout.

---

## 🚀 How to Install (For Anyone)

Anyone can install and use PageCraft on Google Chrome, Brave, Microsoft Edge, or any Chromium browser in 30 seconds:

### Step 1: Download the Repository
- Click the green **Code** button at the top of this repository and select **Download ZIP** (or clone via Git):
  ```bash
  git clone https://github.com/sahilyadav1647/pagecraft-webeditor.git
  ```
- Unzip the downloaded file on your computer.

### Step 2: Open Extensions in Chrome
- Open Google Chrome and enter `chrome://extensions` in the address bar.
- Turn **ON** the **Developer mode** toggle in the top-right corner.

### Step 3: Load the Extension
1. Click the **Load unpacked** button in the top-left corner.
2. Select the unzipped project folder containing `manifest.json`.
3. 🎉 **Done!** PageCraft is now installed and active on all websites.

---

## 🎮 How to Use

1. **Open Any Webpage**: Go to any website (e.g. Wikipedia, blogs, or local sites).
2. **Select Text**:
   - Highlight any text with your mouse.
   - Use the **Floating Toolbar** directly above your selection or use the **PageCraft Panel** on the left.
3. **Edit or Remove**:
   - Type your new text in the panel and click **`[ ✓ CONFIRM & CHANGE TEXT ]`**, or click **`[ ✍️ Edit Text ]`** to type directly on the page.
   - Click **`[ 🗑️ Remove Part ]`** to delete unwanted banners, ads, or sections.
4. **Save Permanently**:
   - Click **`[ 💾 SAVE FOR THIS WEBSITE ]`**.
   - Your modifications are remembered and re-applied automatically every time you visit!

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| **`Alt + E`** (or `Option + E`) | Toggle Element Inspector on/off |
| **`Esc`** | Minimize Editor Panel |
| **`Ctrl + Z`** (or `Cmd + Z`) | Undo last styling or text modification |
| **`Ctrl + Shift + Z`** | Redo action |

---

## 📁 Repository Structure

```
pagecraft-webeditor/
├── manifest.json       # Chrome Extension Manifest V3 configuration
├── content.js          # In-page inspector, selection toolbar, shadow DOM & storage
├── content.css         # Stylesheet for isolated Shadow DOM elements
├── background.js       # Background service worker & context menu handlers
├── popup.html          # Browser toolbar action popup UI
├── popup.css           # Popup styles
├── popup.js            # Popup controls & activeTab messaging
├── style.css           # Web-accessible stylesheet
├── demo.html           # Standalone SaaS testing canvas
├── icons/              # Extension icons (16px, 48px, 128px)
└── README.md           # Documentation & user guide
```

---

## 📄 License

MIT License. Free to use, modify, and distribute.
