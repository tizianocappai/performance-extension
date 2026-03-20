// content.js — iniettato in ogni pagina
// Raccoglie: JS Heap RAM, FPS, Long Tasks + overlay flottante always-on-top

// Evita doppia iniezione se il content script viene re-iniettato
if (document.getElementById('__perfmonitor_overlay__')) {
	throw new Error('PerfMonitor already injected');
}

function isContextValid() {
	try { return !!chrome.runtime?.id; } catch { return false; }
}

let fps = 0,
	frameCount = 0,
	lastFpsTime = performance.now();
let longTasks = 0;
const recentLongTasks = []; // ultimi 10 task: { duration, ts }
let ramMB = 0,
	ramTotalMB = 0,
	ramLimitMB = 0;

// FPS counter
function countFPS() {
	frameCount++;
	const now = performance.now();
	if (now - lastFpsTime >= 1000) {
		fps = frameCount;
		frameCount = 0;
		lastFpsTime = now;
	}
	requestAnimationFrame(countFPS);
}
requestAnimationFrame(countFPS);

// Long Tasks observer
if ('PerformanceObserver' in window) {
	try {
		const obs = new PerformanceObserver((list) => {
			list.getEntries().forEach((entry) => {
				longTasks++;
				recentLongTasks.push({ duration: Math.round(entry.duration), ts: Date.now() });
				if (recentLongTasks.length > 10) recentLongTasks.shift();
			});
		});
		obs.observe({ type: 'longtask', buffered: true });
	} catch (e) {}
}

// ── Overlay flottante ────────────────────────────────────────────────────────

const overlay = document.createElement('div');
overlay.id = '__perfmonitor_overlay__';
overlay.innerHTML = `
  <div id="__pm_header__">
    <span id="__pm_title__">⬛ Perf</span>
    <button id="__pm_close__" title="Nascondi">✕</button>
  </div>
  <div id="__pm_body__">
    <div class="__pm_row__">
      <span class="__pm_label__">RAM</span>
      <span class="__pm_val__" id="__pm_ram__">—</span>
      <span class="__pm_unit__">MB</span>
    </div>
    <div class="__pm_row__">
      <span class="__pm_label__">FPS</span>
      <span class="__pm_val__" id="__pm_fps__">—</span>
    </div>
    <div class="__pm_row__">
      <span class="__pm_label__">Tasks</span>
      <span class="__pm_val__" id="__pm_lt__">—</span>
    </div>
  </div>
`;

const style = document.createElement('style');
style.textContent = `
  #__perfmonitor_overlay__ {
    all: initial;
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 2147483647;
    background: rgba(15, 15, 17, 0.92);
    border: 1px solid #2a2a35;
    border-radius: 10px;
    font-family: system-ui, monospace;
    font-size: 12px;
    color: #e2e2e8;
    min-width: 110px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.5);
    backdrop-filter: blur(8px);
    user-select: none;
    cursor: default;
  }
  #__pm_header__ {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px 4px;
    border-bottom: 1px solid #2a2a35;
    cursor: grab;
  }
  #__pm_header__:active { cursor: grabbing; }
  #__pm_title__ { font-size: 11px; font-weight: 700; color: #888; letter-spacing: 0.05em; }
  #__pm_close__ {
    all: unset;
    color: #555;
    font-size: 10px;
    cursor: pointer;
    line-height: 1;
    padding: 2px 4px;
    border-radius: 4px;
  }
  #__pm_close__:hover { color: #aaa; background: #2a2a35; }
  #__pm_body__ { padding: 8px 10px; display: flex; flex-direction: column; gap: 5px; }
  .__pm_row__ { display: flex; align-items: baseline; gap: 5px; }
  .__pm_label__ { font-size: 10px; color: #555; width: 34px; text-transform: uppercase; letter-spacing: 0.05em; }
  .__pm_val__ { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; min-width: 36px; }
  .__pm_unit__ { font-size: 10px; color: #666; }
`;

document.documentElement.appendChild(style);
document.documentElement.appendChild(overlay);

// ── Drag ────────────────────────────────────────────────────────────────────

const header = overlay.querySelector('#__pm_header__');
let dragging = false, ox = 0, oy = 0;

header.addEventListener('mousedown', (e) => {
	dragging = true;
	ox = e.clientX - overlay.getBoundingClientRect().left;
	oy = e.clientY - overlay.getBoundingClientRect().top;
	e.preventDefault();
});
document.addEventListener('mousemove', (e) => {
	if (!dragging) return;
	overlay.style.right = 'auto';
	overlay.style.left = (e.clientX - ox) + 'px';
	overlay.style.top  = (e.clientY - oy) + 'px';
});
document.addEventListener('mouseup', () => { dragging = false; });

// ── Chiudi ───────────────────────────────────────────────────────────────────

overlay.querySelector('#__pm_close__').addEventListener('click', () => {
	overlay.style.display = 'none';
	chrome.storage.local.set({ pm_overlay_visible: false });
});

// ── Mostra su richiesta dal popup ────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
	if (msg.type !== 'PM_SHOW_OVERLAY') return;
	overlay.style.display = '';
	chrome.storage.local.set({ pm_overlay_visible: true });
});

// ── Stato iniziale ───────────────────────────────────────────────────────────

chrome.storage.local.get('pm_overlay_visible', (res) => {
	if (res.pm_overlay_visible === false) overlay.style.display = 'none';
});

// ── Aggiorna overlay ─────────────────────────────────────────────────────────

function color(val, redAbove, orangeAbove, invert = false) {
	if (!invert) {
		return val > redAbove ? '#ef4444' : val > orangeAbove ? '#f59e0b' : '#22c55e';
	} else {
		return val < redAbove ? '#ef4444' : val < orangeAbove ? '#f59e0b' : '#22c55e';
	}
}

function updateOverlay() {
	const ramEl = overlay.querySelector('#__pm_ram__');
	const fpsEl = overlay.querySelector('#__pm_fps__');
	const ltEl  = overlay.querySelector('#__pm_lt__');

	ramEl.textContent = ramMB;
	ramEl.style.color = color(ramMB, 400, 200);

	fpsEl.textContent = fps;
	fpsEl.style.color = color(fps, 30, 50, true);

	ltEl.textContent  = longTasks;
	ltEl.style.color  = longTasks > 10 ? '#ef4444' : '#e2e2e8';
}

// ── RAM + send + overlay ogni secondo ───────────────────────────────────────

setInterval(() => {
	if (!isContextValid()) return;

	if (performance.memory) {
		ramMB = parseFloat((performance.memory.usedJSHeapSize / 1048576).toFixed(1));
		ramTotalMB = parseFloat((performance.memory.totalJSHeapSize / 1048576).toFixed(1));
		ramLimitMB = parseFloat((performance.memory.jsHeapSizeLimit / 1048576).toFixed(0));
	}

	chrome.runtime.sendMessage(
		{ type: 'PERF_DATA', data: { fps, longTasks, recentLongTasks: [...recentLongTasks], ramMB, ramTotalMB, ramLimitMB, url: location.href, ts: Date.now() } },
		() => {
			void chrome.runtime.lastError;
			updateOverlay();
		}
	);
}, 1000);
