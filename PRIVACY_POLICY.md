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
| `tabs` | Identify the active tab to key per-tab metrics in session storage |
| `storage` | Store performance snapshots in `chrome.storage.session` |
| `notifications` | Alert the user when JS heap RAM exceeds the configured threshold |
| `scripting` | Reserved for future programmatic script injection |
| `system.cpu` | Read system CPU usage to display in the popup |
| `<all_urls>` | Inject the content script into every page to collect metrics |

## Third-party services

PerfMonitor does not use any third-party SDKs, analytics libraries, or external APIs. No network requests are made by the extension.

## Contact

For questions or concerns, open an issue at the project repository.
