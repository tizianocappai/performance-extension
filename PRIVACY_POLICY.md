# Privacy Policy — PerfMonitor

_Last updated: March 20, 2026_

## What data is collected

PerfMonitor reads the following performance metrics from the currently active browser tab:

- **JS Heap memory** (used, allocated, and limit) via the `performance.memory` API
- **Frame rate (FPS)** via `requestAnimationFrame`
- **Long Tasks count** (main-thread blocks > 50 ms) via `PerformanceObserver`
- **CPU usage** (system-wide percentage) via the `chrome.system.cpu` API
- **Page URL** (used solely to display the hostname in the popup)

## How data is stored and used

All data is stored exclusively in **`chrome.storage.session`** — a temporary, in-memory store local to your browser that is automatically cleared when the browser is closed. No data is written to disk beyond the browser session.

Data is used only to render the metrics displayed in the extension popup. It is never transmitted to any external server, never shared with third parties, and never used for advertising or analytics.

## Data retention

Session data for a tab is deleted immediately when that tab is closed. Clicking "Reset contatori" in the popup clears all in-memory history instantly.

## Permissions justification

| Permission | Purpose |
|---|---|
| `activeTab` | Access the currently active tab to display its hostname |
| `tabs` | Listen for tab close events to clean up session data |
| `storage` | Store performance snapshots in `chrome.storage.session` |
| `notifications` | Alert the user when JS heap RAM exceeds the configured threshold |
| `scripting` | Inject the content script into pages to collect metrics |
| `system.cpu` | Read system CPU usage to display in the popup |
| `<all_urls>` | Allow the content script to run on every page |

## Third-party services

PerfMonitor does not use any third-party SDKs, analytics libraries, or external APIs. No network requests are made by the extension.

## GDPR (EU users)

**Data controller:** Tiziano Cappai — contact via [GitHub Issues](https://github.com/tizianocappai/performance-extension/issues).

**Legal basis for processing:** Legitimate interest (Article 6(1)(f) GDPR) — the extension processes only local, session-scoped technical metrics strictly necessary to provide the service the user has installed.

**Your rights:** Under the GDPR you have the right to access, rectification, erasure, restriction of processing, and data portability. Since PerfMonitor stores no data outside your own device and all data is cleared automatically at session end, these rights are fulfilled by design. For any inquiry, open an issue on GitHub.

**Data transfers:** No data is transferred outside your device. No third countries are involved.

## Contact

For questions or concerns, open an issue at [github.com/tizianocappai/performance-extension](https://github.com/tizianocappai/performance-extension/issues).
