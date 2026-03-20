// content.js — iniettato in ogni pagina
// Raccoglie: JS Heap RAM, FPS, Long Tasks

let fps = 0,
	frameCount = 0,
	lastFpsTime = performance.now();
let longTasks = 0;
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
			longTasks += list.getEntries().length;
		});
		obs.observe({ type: 'longtask', buffered: true });
	} catch (e) {}
}

// RAM + dati -> background ogni secondo
setInterval(() => {
	if (performance.memory) {
		ramMB = parseFloat((performance.memory.usedJSHeapSize / 1048576).toFixed(1));
		ramTotalMB = parseFloat((performance.memory.totalJSHeapSize / 1048576).toFixed(1));
		ramLimitMB = parseFloat((performance.memory.jsHeapSizeLimit / 1048576).toFixed(0));
	}

	chrome.runtime
		.sendMessage({
			type: 'PERF_DATA',
			data: {
				fps,
				longTasks,
				ramMB,
				ramTotalMB,
				ramLimitMB,
				url: location.href,
				ts: Date.now(),
			},
		})
		.catch(() => {}); // ignora se popup chiuso
}, 1000);
