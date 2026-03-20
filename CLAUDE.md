# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PerfMonitor is a Chrome extension (Manifest V3) that displays real-time performance metrics — JS heap RAM, FPS, and long tasks — for the current web page. It is vanilla JavaScript with no build tools or dependencies.

## Loading the Extension

No build step required. To test changes:

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this directory
4. After code changes, click the reload icon on the extension card

## Architecture

Three-component pipeline:

**[content.js](content.js)** — Injected into every page. Uses `requestAnimationFrame` for FPS, `PerformanceObserver` for long tasks (>50ms), and `performance.memory` for heap data. Sends a `PERF_DATA` message via `chrome.runtime.sendMessage()` every 1 second.

**[background.js](background.js)** — Service worker. Receives `PERF_DATA` messages and stores the latest snapshot per tab in `chrome.storage.session`. Fires a notification when RAM exceeds the threshold (`RAM_ALERT_THRESHOLD_MB = 500`). Cleans up on tab close.

**[popup.js](popup.js) / [popup.html](popup.html)** — Polls `chrome.storage.session` every 1 second for the active tab's data. Renders metric cards and two canvas-based charts (FPS and RAM) showing the last 30 data points.

### Data flow

```
content.js → chrome.runtime.sendMessage → background.js → chrome.storage.session
                                                                      ↑
                                               popup.js polls every 1s
```

## Key Configuration Values

| Constant | Location | Default |
|---|---|---|
| RAM alert threshold | [background.js:4](background.js#L4) | 500 MB |
| Chart history length | [popup.js](popup.js) | 30 points (~30s) |
| RAM color thresholds | [popup.js:48-49](popup.js#L48-L49) | >400 red, >200 orange |
| FPS color thresholds | [popup.js:50-51](popup.js#L50-L51) | <30 red, <50 orange |
