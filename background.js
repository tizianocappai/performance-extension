// background.js — service worker
// Riceve dati dal content script, li salva e gestisce le notifiche

const RAM_ALERT_MB = 500; // soglia notifica RAM (modifica a piacere)
let notifiedTab = new Set();

chrome.runtime.onMessage.addListener((msg, sender) => {
	if (msg.type !== 'PERF_DATA') return;

	const { data } = msg;
	const tabId = sender.tab?.id;
	if (!tabId) return;

	// Salva ultimo snapshot per questa tab
	chrome.storage.session.set({ [`tab_${tabId}`]: data });

	// Notifica se RAM supera soglia
	if (data.ramMB > RAM_ALERT_MB && !notifiedTab.has(tabId)) {
		notifiedTab.add(tabId);
		chrome.notifications.create(`ram_${tabId}`, {
			type: 'basic',
			iconUrl: 'icons/icon48.png',
			title: 'PerfMonitor — RAM alta!',
			message: `La pagina usa ${data.ramMB} MB di JS Heap (soglia: ${RAM_ALERT_MB} MB)`,
		});
	}
	// Reset notifica se RAM torna sotto soglia
	if (data.ramMB < RAM_ALERT_MB - 50) notifiedTab.delete(tabId);
});

// Pulisce i dati quando una tab viene chiusa
chrome.tabs.onRemoved.addListener((tabId) => {
	chrome.storage.session.remove(`tab_${tabId}`);
	notifiedTab.delete(tabId);
});
