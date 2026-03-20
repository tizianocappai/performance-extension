// background.js — service worker
// Riceve dati dal content script, li salva e gestisce le notifiche

const RAM_ALERT_MB = 500; // soglia notifica RAM (modifica a piacere)
let notifiedTab = new Set();

// Ripristina notifiedTab dalla session storage al riavvio del service worker
chrome.storage.session.get('notifiedTab', (res) => {
	if (res.notifiedTab) notifiedTab = new Set(res.notifiedTab);
});

// CPU usage tracking
let prevCpuInfo = null;

function calcCpuUsage(prev, curr) {
	let totalDelta = 0, idleDelta = 0;
	curr.processors.forEach((proc, i) => {
		const p = prev.processors[i].usage;
		const c = proc.usage;
		totalDelta += c.total - p.total;
		idleDelta  += c.idle  - p.idle;
	});
	if (totalDelta <= 0 || idleDelta < 0) return 0;
	return parseFloat(((1 - idleDelta / totalDelta) * 100).toFixed(1));
}

setInterval(async () => {
	const info = await chrome.system.cpu.getInfo();
	if (prevCpuInfo) {
		const cpuPct = calcCpuUsage(prevCpuInfo, info);
		chrome.storage.session.set({ cpu_usage: cpuPct });
	}
	prevCpuInfo = info;
}, 1000);

// System memory polling
setInterval(async () => {
	const info = await chrome.system.memory.getInfo();
	const totalMB     = Math.round(info.capacity / 1048576);
	const availableMB = Math.round(info.availableCapacity / 1048576);
	chrome.storage.session.set({ system_memory: { totalMB, availableMB } });
}, 1000);

// Tab process memory — fires ~1s with memory included
if (chrome.processes?.onUpdatedWithMemory) {
	chrome.processes.onUpdatedWithMemory.addListener((processes) => {
		const updates = {};
		for (const proc of Object.values(processes)) {
			if (!proc.tabs?.length) continue;
			const memMB = Math.round((proc.privateMemory ?? 0) / 1048576);
			for (const tabId of proc.tabs) {
				updates[`tab_${tabId}_proc_mem`] = memMB;
			}
		}
		if (Object.keys(updates).length) chrome.storage.session.set(updates);
	});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	if (msg.type !== 'PERF_DATA') return;

	const { data } = msg;
	const tabId = sender.tab?.id;
	if (!tabId) { sendResponse({}); return true; }

	chrome.storage.session.get('cpu_usage', (res) => {
		sendResponse({ cpu_usage: res.cpu_usage ?? 0 });
	});

	chrome.storage.session.set({ [`tab_${tabId}`]: data });

	// Notifica se RAM supera soglia
	if (data.ramMB > RAM_ALERT_MB && !notifiedTab.has(tabId)) {
		notifiedTab.add(tabId);
		chrome.storage.session.set({ notifiedTab: [...notifiedTab] });
		chrome.notifications.create(`ram_${tabId}`, {
			type: 'basic',
			iconUrl: 'icons/icon48.png',
			title: 'PerfMonitor — RAM alta!',
			message: `La pagina usa ${data.ramMB} MB di JS Heap (soglia: ${RAM_ALERT_MB} MB)`,
		});
	}
	// Reset notifica se RAM torna sotto soglia
	if (data.ramMB < RAM_ALERT_MB - 50 && notifiedTab.has(tabId)) {
		notifiedTab.delete(tabId);
		chrome.storage.session.set({ notifiedTab: [...notifiedTab] });
	}

	return true; // keep message channel open for async sendResponse
});

// Pulisce i dati quando una tab viene chiusa
chrome.tabs.onRemoved.addListener((tabId) => {
	chrome.storage.session.remove([`tab_${tabId}`, `tab_${tabId}_proc_mem`]);
	notifiedTab.delete(tabId);
	chrome.storage.session.set({ notifiedTab: [...notifiedTab] });
});
