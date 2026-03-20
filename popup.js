// popup.js
const HISTORY_LEN = 30;
const fpsHistory = new Array(HISTORY_LEN).fill(0);
const ramHistory = new Array(HISTORY_LEN).fill(0);
const cpuHistory = new Array(HISTORY_LEN).fill(0);

let tabId;

// Ottieni la tab attiva e avvia il polling
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
	if (!tabs[0]) return;
	tabId = tabs[0].id;
	render(); // primo render immediato
	setInterval(render, 1000);
});

document.getElementById('reset-btn').addEventListener('click', () => {
	fpsHistory.fill(0);
	ramHistory.fill(0);
	cpuHistory.fill(0);
	if (tabId) chrome.storage.session.remove(`tab_${tabId}`);
});

async function render() {
	if (!tabId) return;

	const result = await chrome.storage.session.get([`tab_${tabId}`, 'cpu_usage']);
	const data = result[`tab_${tabId}`];
	const cpuPct = result['cpu_usage'] ?? 0;

	if (!data) return;

	// Aggiorna label URL
	const urlEl = document.getElementById('url-label');
	try {
		urlEl.textContent = new URL(data.url).hostname;
	} catch {
		urlEl.textContent = '';
	}

	// Aggiorna storico
	fpsHistory.push(data.fps || 0);
	fpsHistory.shift();
	ramHistory.push(data.ramMB || 0);
	ramHistory.shift();
	cpuHistory.push(cpuPct);
	cpuHistory.shift();

	// Costruisci HTML
	const ramPct = data.ramLimitMB
		? ((data.ramMB / data.ramLimitMB) * 100).toFixed(1)
		: 0;
	const ramColor =
		data.ramMB > 400 ? '#ef4444' : data.ramMB > 200 ? '#f59e0b' : '#22c55e';
	const fpsColor =
		data.fps < 30 ? '#ef4444' : data.fps < 50 ? '#f59e0b' : '#22c55e';
	const cpuColor =
		cpuPct > 80 ? '#ef4444' : cpuPct > 50 ? '#f59e0b' : '#22c55e';

	document.getElementById('main-content').innerHTML = `
    <div class="card">
      <div class="card-label">JS Heap RAM</div>
      <div class="metric-row">
        <span class="metric-val" style="color:${ramColor}">${data.ramMB}</span>
        <span class="metric-unit">MB</span>
        <span class="metric-unit">/ ${data.ramTotalMB} MB allocati</span>
      </div>
      <div class="metric-sub">Limite heap: ${data.ramLimitMB} MB</div>
      <div class="bar-wrap">
        <div class="bar-fill" style="width:${Math.min(ramPct, 100)}%;background:${ramColor}"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-label">FPS (frame rate)</div>
      <div class="metric-row">
        <span class="metric-val" style="color:${fpsColor}">${data.fps}</span>
        <span class="metric-unit">fps</span>
      </div>
      <canvas id="fps-chart" height="48"></canvas>
    </div>

    <div class="card">
      <div class="card-label">Long Tasks (totale sessione)</div>
      <div class="metric-row">
        <span class="metric-val" style="color:${data.longTasks > 10 ? '#ef4444' : '#e2e2e8'}">${data.longTasks}</span>
        <span class="metric-unit">task &gt;50ms</span>
      </div>
      <div class="metric-sub">Main thread bloccato per oltre 50ms</div>
    </div>

    <div class="card">
      <div class="card-label">RAM — andamento (30s)</div>
      <canvas id="ram-chart" height="48"></canvas>
    </div>

    <div class="card">
      <div class="card-label">CPU Usage</div>
      <div class="metric-row">
        <span class="metric-val" style="color:${cpuColor}">${cpuPct}</span>
        <span class="metric-unit">%</span>
      </div>
      <div class="bar-wrap">
        <div class="bar-fill" style="width:${Math.min(cpuPct, 100)}%;background:${cpuColor}"></div>
      </div>
      <canvas id="cpu-chart" height="48"></canvas>
    </div>
  `;

	drawChart('fps-chart', fpsHistory, fpsColor, 60);
	drawChart('ram-chart', ramHistory, ramColor, Math.max(...ramHistory, 100));
	drawChart('cpu-chart', cpuHistory, cpuColor, 100);

	const d = new Date(data.ts);
	document.getElementById('last-update').textContent =
		`Aggiornato: ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function drawChart(id, data, color, maxVal) {
	const canvas = document.getElementById(id);
	if (!canvas) return;
	const dpr = window.devicePixelRatio || 1;
	const W = canvas.offsetWidth || 292;
	const H = 48;
	canvas.width = W * dpr;
	canvas.height = H * dpr;
	const ctx = canvas.getContext('2d');
	ctx.scale(dpr, dpr);

	const step = W / (data.length - 1);

	// Area fill
	ctx.beginPath();
	ctx.moveTo(0, H);
	data.forEach((v, i) => {
		const x = i * step;
		const y = H - (v / maxVal) * (H - 4);
		i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
	});
	ctx.lineTo((data.length - 1) * step, H);
	ctx.closePath();
	ctx.fillStyle = color + '22';
	ctx.fill();

	// Line
	ctx.beginPath();
	data.forEach((v, i) => {
		const x = i * step;
		const y = H - (v / maxVal) * (H - 4);
		i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
	});
	ctx.strokeStyle = color;
	ctx.lineWidth = 1.5;
	ctx.lineJoin = 'round';
	ctx.stroke();
}
