# Privacy Policy — PerfMonitor

_Last updated: March 20, 2026_

## What data is collected

PerfMonitor reads the following performance metrics from the currently active browser tab:

- **JS Heap memory** (used, allocated, and limit) via the `performance.memory` API
- **Frame rate (FPS)** via `requestAnimationFrame`
- **Long Tasks** (count, duration in ms, and timestamp of each block > 50 ms) via `PerformanceObserver`
- **CPU usage** (system-wide percentage) via the `chrome.system.cpu` API
- **Page URL** (used solely to display the hostname in the popup and in exported snapshots)

## How data is stored and used

| Storage | What is stored | Persistence |
|---|---|---|
| `chrome.storage.session` | Per-tab performance snapshots, CPU usage, RAM alert state | Cleared when the browser closes |
| `chrome.storage.local` | Overlay visibility preference (`true`/`false`) | Persists across browser sessions |

No data is ever transmitted to any external server, shared with third parties, or used for advertising or analytics.

## Export snapshot

The "Export snapshot" feature generates an HTML file containing the current metrics and chart images and saves it **locally on the user's device**. No data is uploaded or shared. The exported file is created entirely in-browser and is under the user's full control.

## Data retention

- Session data for a tab is deleted immediately when that tab is closed.
- The overlay visibility preference stored in `chrome.storage.local` is a single boolean value with no personal information. It can be cleared at any time by removing the extension.
- Clicking "Reset contatori" in the popup clears all in-memory history and the session snapshot for the active tab.

## Permissions justification

| Permission | Purpose |
|---|---|
| `activeTab` | Access the currently active tab to display its hostname |
| `tabs` | Listen for tab close events to clean up session data |
| `storage` | Store performance snapshots in session storage and the overlay preference in local storage |
| `notifications` | Alert the user when JS heap RAM exceeds the configured threshold |
| `scripting` | Inject the content script into pages to collect metrics and render the overlay widget |
| `system.cpu` | Read system CPU usage to display in the popup and overlay |
| `<all_urls>` | Allow the content script to run on every page |

## Third-party services

PerfMonitor does not use any third-party SDKs, analytics libraries, or external APIs. No network requests are made by the extension.

## GDPR (EU users)

**Data controller:** Tiziano Cappai — contact via [GitHub Issues](https://github.com/tizianocappai/performance-extension/issues).

**Legal basis for processing:** Legitimate interest (Article 6(1)(f) GDPR) — the extension processes only local technical metrics strictly necessary to provide the service the user has installed.

**Your rights:** Under the GDPR you have the right to access, rectification, erasure, restriction of processing, and data portability. Since PerfMonitor stores no data outside your own device, these rights are fulfilled by design. For any inquiry, open an issue on GitHub.

**Data transfers:** No data is transferred outside your device. No third countries are involved.

## Contact

For questions or concerns, open an issue at [github.com/tizianocappai/performance-extension](https://github.com/tizianocappai/performance-extension/issues).
