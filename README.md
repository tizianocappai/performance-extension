# PerfMonitor

A lightweight Chrome extension (Manifest V3) that displays real-time performance metrics for the active tab — JS heap RAM, frame rate, and long tasks — without any build tools or dependencies.

## Features

- **JS Heap RAM** — used/allocated/limit with a fill bar and color-coded alert (green < 200 MB, orange > 200 MB, red > 400 MB)
- **FPS** — live frame rate from `requestAnimationFrame`, color-coded (green ≥ 50, orange < 50, red < 30)
- **Long Tasks** — cumulative count of main-thread blocks exceeding 50 ms since the tab was opened
- **30-second history charts** — canvas-drawn area+line graphs for both FPS and RAM
- **RAM alert notification** — fires a browser notification when JS heap exceeds 500 MB (configurable)

## Installation

No build step required.

1. Clone or download this repository.
2. Open `chrome://extensions/` in Chrome.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the repository folder.

The extension icon appears in the toolbar. Click it on any page to open the popup.

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
| `content.js` | Injected into every page. Collects FPS via `requestAnimationFrame`, long tasks via `PerformanceObserver`, and heap memory via `performance.memory`. Sends a `PERF_DATA` message each second. |
| `background.js` | Service worker. Stores the latest snapshot per tab in `chrome.storage.session`. Fires a notification if RAM exceeds the threshold; resets the alert with a 50 MB hysteresis. Cleans up on tab close. |
| `popup.js` | Polls session storage for the active tab, maintains 30-point rolling histories, renders metric cards, progress bar, and two canvas charts. |

## Configuration

Both thresholds live in a single constant each:

| Setting | File | Default |
|---|---|---|
| RAM notification threshold | `background.js` line 4 (`RAM_ALERT_MB`) | `500` MB |
| Chart history length | `popup.js` line 2 (`HISTORY_LEN`) | `30` points |

## Permissions

| Permission | Why |
|---|---|
| `tabs` | Read the active tab's ID to key session storage entries |
| `storage` | `chrome.storage.session` for per-tab snapshots |
| `notifications` | RAM threshold alert |
| `scripting` | Reserved for future programmatic injection |
| `<all_urls>` | Content script must run on every page |

## Browser Compatibility

Requires a Chromium-based browser (Chrome, Edge, Brave, etc.) with Manifest V3 support. `performance.memory` is a non-standard Chrome API — FPS and long tasks work on all Chromium builds, but heap data is only available in Chrome/Chromium.

## License

MIT © 2026 Tiziano Cappai
