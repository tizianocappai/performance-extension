# PerfMonitor

A lightweight Chrome extension (Manifest V3) that displays real-time performance metrics for the active tab — JS heap RAM, frame rate, CPU, network, Core Web Vitals, and more — without any build tools or dependencies.

## Features

- **JS Heap RAM** — used/allocated/limit with a fill bar and color-coded alert (green < 200 MB, orange > 200 MB, red > 400 MB)
- **Tab process memory** — private RAM used by the tab's renderer process via `chrome.processes`
- **System RAM** — total and available system memory via `chrome.system.memory`
- **FPS** — live frame rate from `requestAnimationFrame`, color-coded (green ≥ 50, orange < 50, red < 30)
- **CPU Usage** — system-wide percentage sampled every second via `chrome.system.cpu`, color-coded (green ≤ 50%, orange ≤ 80%, red > 80%)
- **Long Tasks** — count and detail log of every main-thread block exceeding 50 ms; on Chrome 123+ includes script attribution via the Long Animation Frames API (source file, function name, invoker such as `BUTTON#save.onclick`)
- **Core Web Vitals** — FCP, LCP, CLS, INP with Google threshold color coding (good/needs improvement/poor)
- **Network** — estimated downlink (Mbps), RTT (ms), and connection type (`4g`/`3g`/`2g`) via `navigator.connection`
- **30-second history charts** — canvas-drawn area+line graphs for FPS, RAM, and CPU
- **Always-visible overlay** — draggable widget injected into every page so metrics stay visible while you interact with the site
- **Export snapshot** — downloads a self-contained HTML performance report with charts, stats table (avg/min/max), long task log, and 30-second raw history
- **RAM alert notification** — fires a browser notification when JS heap exceeds 500 MB (configurable)

## Installation

### From the Chrome Web Store

Search for **PerfMonitor** in the [Chrome Web Store](https://chrome.google.com/webstore) and click **Add to Chrome**.

### Manual installation (without the Web Store)

No build step required. Works on Chrome, Edge, and any Chromium-based browser.

1. [Download the repository](https://github.com/tizianocappai/performance-extension/archive/refs/heads/main.zip) as a ZIP and extract it — or clone it:
   ```bash
   git clone https://github.com/tizianocappai/performance-extension.git
   ```
2. Open `chrome://extensions/` in Chrome (or `edge://extensions/` in Edge).
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked** and select the folder you just extracted.

The extension icon appears in the toolbar. Click it on any page to open the popup.

> **Note:** Browser updates do not remove manually loaded extensions, but a browser restart may require you to re-enable developer mode on some systems. The extension will also show a "Developer mode" warning banner on startup — this is normal for unpacked extensions and can be dismissed.

## How It Works

```
content.js ──(chrome.runtime.sendMessage every 1s)──► background.js
                                                            │
                                               chrome.storage.session (per-tab)
                                                            │
                                         popup.js polls every 1s ──► renders UI
```

| File | Role |
|---|---|
| `content.js` | Injected into every page. Collects FPS, heap memory, Core Web Vitals (FCP/LCP/CLS/INP), network conditions, and long tasks — using `long-animation-frame` on Chrome 123+ for script attribution, falling back to `longtask`. Sends `PERF_DATA` each second. Renders the draggable overlay widget. |
| `background.js` | Service worker. Receives `PERF_DATA`, samples CPU (`chrome.system.cpu`), system RAM (`chrome.system.memory`), and tab process memory (`chrome.processes.onUpdatedWithMemory`). Stores all data per-tab in `chrome.storage.session`. Fires RAM alert notification with hysteresis. Cleans up on tab close. |
| `popup.js` | Polls session storage for the active tab, maintains 30-point rolling histories for RAM, FPS, and CPU, renders all metric cards and three canvas charts. Handles export snapshot and sends `PM_SHOW_OVERLAY` to the content script on open. |

## Configuration

Both thresholds live in a single constant each:

| Setting | File | Default |
|---|---|---|
| RAM notification threshold | `background.js` line 4 (`RAM_ALERT_MB`) | `500` MB |
| Chart history length | `popup.js` line 2 (`HISTORY_LEN`) | `30` points |

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Access the currently active tab to display its hostname |
| `tabs` | Listen for tab close events to clean up session data |
| `storage` | `chrome.storage.session` for per-tab snapshots; `chrome.storage.local` for overlay visibility preference |
| `notifications` | RAM threshold alert |
| `scripting` | Inject the content script to collect metrics and render the overlay widget |
| `system.cpu` | Read system CPU usage to display in popup, overlay, and exported reports |
| `system.memory` | Read total and available system RAM |
| `processes` | Read per-tab renderer process memory via `chrome.processes.onUpdatedWithMemory` |
| `<all_urls>` | Content script must run on every page |

## Browser Compatibility

Requires a Chromium-based browser (Chrome, Edge, Brave, etc.) with Manifest V3 support. `performance.memory` is a non-standard Chrome API — FPS and long tasks work on all Chromium builds, but heap data is only available in Chrome/Chromium.

## License

MIT © 2026 Tiziano Cappai
