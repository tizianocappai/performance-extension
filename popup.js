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
	chrome.tabs.sendMessage(tabId, { type: 'PM_SHOW_OVERLAY' }, () => void chrome.runtime.lastError);
	render();
	setInterval(render, 1000);
});

document.getElementById('export-btn').addEventListener('click', exportSnapshot);

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
      ${(data.recentLongTasks?.length > 0) ? `
      <div style="margin-top:8px;display:flex;flex-direction:column;gap:3px;">
        ${[...data.recentLongTasks].reverse().map(t => `
          <div style="display:flex;justify-content:space-between;align-items:center;background:#252530;border-radius:5px;padding:3px 8px;">
            <span style="font-size:10px;color:#555">${new Date(t.ts).toLocaleTimeString()}</span>
            <span style="font-size:11px;font-weight:600;color:${t.duration > 200 ? '#ef4444' : t.duration > 100 ? '#f59e0b' : '#e2e2e8'}">${t.duration} ms</span>
          </div>`).join('')}
      </div>` : ''}
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

async function exportSnapshot() {
	if (!tabId) return;
	const result = await chrome.storage.session.get([`tab_${tabId}`, 'cpu_usage']);
	const data = result[`tab_${tabId}`];
	const cpuPct = result['cpu_usage'] ?? 0;
	if (!data) return;

	const ts = new Date(data.ts);
	const tsStr = ts.toLocaleString();
	const fileName = `perfmonitor-${ts.toISOString().replace(/[:.]/g, '-')}.html`;

	const fpsImg  = document.getElementById('fps-chart')?.toDataURL() ?? '';
	const ramImg  = document.getElementById('ram-chart')?.toDataURL() ?? '';
	const cpuImg  = document.getElementById('cpu-chart')?.toDataURL() ?? '';

	const ramColor = data.ramMB > 400 ? '#ef4444' : data.ramMB > 200 ? '#f59e0b' : '#22c55e';
	const fpsColor = data.fps < 30 ? '#ef4444' : data.fps < 50 ? '#f59e0b' : '#22c55e';
	const cpuColor = cpuPct > 80 ? '#ef4444' : cpuPct > 50 ? '#f59e0b' : '#22c55e';
	const ramPct   = data.ramLimitMB ? Math.min((data.ramMB / data.ramLimitMB) * 100, 100).toFixed(1) : 0;

	const tasksRows = (data.recentLongTasks ?? []).reverse().map(t => {
		const c = t.duration > 200 ? '#ef4444' : t.duration > 100 ? '#f59e0b' : '#e2e2e8';
		return `<tr><td>${new Date(t.ts).toLocaleTimeString()}</td><td style="color:${c};font-weight:600">${t.duration} ms</td></tr>`;
	}).join('');

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>PerfMonitor Snapshot — ${tsStr}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0f0f11;color:#e2e2e8;font-family:system-ui,sans-serif;font-size:13px;padding:32px;max-width:600px;margin:0 auto}
    h1{font-size:18px;font-weight:700;margin-bottom:4px}
    .meta{font-size:11px;color:#44445a;margin-bottom:24px}
    .card{background:#1a1a1f;border:1px solid #2a2a35;border-radius:10px;padding:14px 16px;margin-bottom:12px}
    .label{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#6b6b80;margin-bottom:6px}
    .val{font-size:28px;font-weight:700;line-height:1}
    .unit{font-size:13px;color:#888;margin-left:4px}
    .sub{font-size:11px;color:#555;margin-top:3px}
    .bar-wrap{background:#252530;border-radius:4px;height:6px;margin-top:8px;overflow:hidden}
    .bar-fill{height:100%;border-radius:4px}
    img{display:block;width:100%;margin-top:8px;border-radius:4px}
    table{width:100%;border-collapse:collapse;margin-top:10px}
    td{padding:4px 8px;font-size:11px;background:#252530;border-bottom:1px solid #1a1a1f}
    td:last-child{text-align:right}
    .footer{margin-top:24px;font-size:10px;color:#333;text-align:center}
  </style>
</head>
<body>
  <h1>PerfMonitor — Snapshot</h1>
  <div class="meta">${tsStr} &nbsp;·&nbsp; ${data.url}</div>

  <div class="card">
    <div class="label">JS Heap RAM</div>
    <div><span class="val" style="color:${ramColor}">${data.ramMB}</span><span class="unit">MB / ${data.ramTotalMB} MB allocati</span></div>
    <div class="sub">Limite heap: ${data.ramLimitMB} MB</div>
    <div class="bar-wrap"><div class="bar-fill" style="width:${ramPct}%;background:${ramColor}"></div></div>
  </div>

  <div class="card">
    <div class="label">FPS</div>
    <div><span class="val" style="color:${fpsColor}">${data.fps}</span><span class="unit">fps</span></div>
    ${fpsImg ? `<img src="${fpsImg}" alt="FPS chart"/>` : ''}
  </div>

  <div class="card">
    <div class="label">CPU Usage</div>
    <div><span class="val" style="color:${cpuColor}">${cpuPct}</span><span class="unit">%</span></div>
    <div class="bar-wrap"><div class="bar-fill" style="width:${Math.min(cpuPct,100)}%;background:${cpuColor}"></div></div>
    ${cpuImg ? `<img src="${cpuImg}" alt="CPU chart"/>` : ''}
  </div>

  <div class="card">
    <div class="label">Long Tasks — totale sessione: ${data.longTasks}</div>
    ${tasksRows ? `<table>${tasksRows}</table>` : '<div class="sub" style="margin-top:6px">Nessun long task registrato</div>'}
  </div>

  <div class="card">
    <div class="label">RAM — andamento (30s)</div>
    ${ramImg ? `<img src="${ramImg}" alt="RAM chart"/>` : ''}
  </div>

  <div class="footer">Generated by PerfMonitor</div>
</body>
</html>`;

	const blob = new Blob([html], { type: 'text/html' });
	const url  = URL.createObjectURL(blob);
	const a    = document.createElement('a');
	a.href = url;
	a.download = fileName;
	a.click();
	URL.revokeObjectURL(url);
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
