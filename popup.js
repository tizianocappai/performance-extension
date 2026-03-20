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

	const result = await chrome.storage.session.get([`tab_${tabId}`, 'cpu_usage', 'system_memory', `tab_${tabId}_proc_mem`]);
	const data = result[`tab_${tabId}`];
	const cpuPct = result['cpu_usage'] ?? 0;
	const sysMem = result['system_memory'] ?? null;
	const procMemMB = result[`tab_${tabId}_proc_mem`] ?? null;

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

	// Network
	const downlinkColor = !data.downlink ? '#555' : data.downlink < 1 ? '#ef4444' : data.downlink < 10 ? '#f59e0b' : '#22c55e';

	// CWV colors (Google thresholds)
	const fcpColor = !data.fcp ? '#555' : data.fcp >= 3000 ? '#ef4444' : data.fcp >= 1800 ? '#f59e0b' : '#22c55e';
	const lcpColor = !data.lcp ? '#555' : data.lcp >= 4000 ? '#ef4444' : data.lcp >= 2500 ? '#f59e0b' : '#22c55e';
	const clsColor = data.cls  >= 0.25  ? '#ef4444' : data.cls  >= 0.1   ? '#f59e0b' : '#22c55e';
	const inpColor = !data.inp  ? '#555' : data.inp  >= 500   ? '#ef4444' : data.inp  >= 200   ? '#f59e0b' : '#22c55e';

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

    ${procMemMB !== null ? `
    <div class="card">
      <div class="card-label">Memoria processo tab</div>
      <div class="metric-row">
        <span class="metric-val" style="color:${procMemMB > 400 ? '#ef4444' : procMemMB > 200 ? '#f59e0b' : '#22c55e'}">${procMemMB}</span>
        <span class="metric-unit">MB (RAM privata del processo)</span>
      </div>
    </div>` : ''}

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

    ${sysMem ? `
    <div class="card">
      <div class="card-label">RAM di sistema</div>
      <div class="metric-row">
        <span class="metric-val" style="color:${sysMem.availableMB < 512 ? '#ef4444' : sysMem.availableMB < 2048 ? '#f59e0b' : '#22c55e'}">${sysMem.availableMB}</span>
        <span class="metric-unit">MB disponibili</span>
      </div>
      <div class="metric-sub">Totale: ${sysMem.totalMB} MB</div>
      <div class="bar-wrap">
        <div class="bar-fill" style="width:${Math.min(((sysMem.totalMB - sysMem.availableMB) / sysMem.totalMB) * 100, 100).toFixed(1)}%;background:${sysMem.availableMB < 512 ? '#ef4444' : sysMem.availableMB < 2048 ? '#f59e0b' : '#22c55e'}"></div>
      </div>
    </div>` : ''}

    <div class="card">
      <div class="card-label">Network</div>
      <div class="metric-row">
        <span class="metric-val" style="color:${downlinkColor}">${data.downlink || '—'}</span>
        <span class="metric-unit">Mbps</span>
        ${data.effectiveType ? `<span class="metric-unit" style="margin-left:6px;background:#1a1a2e;padding:1px 6px;border-radius:4px">${data.effectiveType}</span>` : ''}
      </div>
      ${data.netRtt ? `<div class="metric-sub">RTT stimato: ${data.netRtt} ms</div>` : ''}
    </div>

    <div class="card">
      <div class="card-label">Core Web Vitals</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:4px">
        <div>
          <div style="font-size:10px;color:#555;text-transform:uppercase;letter-spacing:.05em">FCP</div>
          <div style="font-size:18px;font-weight:700;color:${fcpColor}">${data.fcp ? data.fcp + ' ms' : '—'}</div>
          <div style="font-size:10px;color:#444">First Contentful Paint</div>
        </div>
        <div>
          <div style="font-size:10px;color:#555;text-transform:uppercase;letter-spacing:.05em">LCP</div>
          <div style="font-size:18px;font-weight:700;color:${lcpColor}">${data.lcp ? data.lcp + ' ms' : '—'}</div>
          <div style="font-size:10px;color:#444">Largest Contentful Paint</div>
        </div>
        <div>
          <div style="font-size:10px;color:#555;text-transform:uppercase;letter-spacing:.05em">CLS</div>
          <div style="font-size:18px;font-weight:700;color:${clsColor}">${data.cls.toFixed(3)}</div>
          <div style="font-size:10px;color:#444">Cumulative Layout Shift</div>
        </div>
        <div>
          <div style="font-size:10px;color:#555;text-transform:uppercase;letter-spacing:.05em">INP</div>
          <div style="font-size:18px;font-weight:700;color:${inpColor}">${data.inp ? data.inp + ' ms' : '—'}</div>
          <div style="font-size:10px;color:#444">Interaction to Next Paint</div>
        </div>
      </div>
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

	const fpsImg = document.getElementById('fps-chart')?.toDataURL() ?? '';
	const ramImg = document.getElementById('ram-chart')?.toDataURL() ?? '';
	const cpuImg = document.getElementById('cpu-chart')?.toDataURL() ?? '';

	const ramPct    = data.ramLimitMB ? Math.min((data.ramMB / data.ramLimitMB) * 100, 100).toFixed(1) : 0;
	const ramStatus = data.ramMB > 400 ? ['Critical', '#b91c1c'] : data.ramMB > 200 ? ['Warning', '#b45309'] : ['Good', '#15803d'];
	const fpsStatus = data.fps < 30   ? ['Critical', '#b91c1c'] : data.fps < 50   ? ['Warning', '#b45309'] : ['Good', '#15803d'];
	const cpuStatus = cpuPct > 80     ? ['Critical', '#b91c1c'] : cpuPct > 50     ? ['Warning', '#b45309'] : ['Good', '#15803d'];
	const ltStatus  = data.longTasks > 10 ? ['High', '#b91c1c'] : data.longTasks > 0 ? ['Present', '#b45309'] : ['None', '#15803d'];

	const avgFps = fpsHistory.filter(v => v > 0);
	const avgRam = ramHistory.filter(v => v > 0);
	const avgCpu = cpuHistory.filter(v => v > 0);
	const avg = arr => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : '—';
	const min = arr => arr.length ? Math.min(...arr).toFixed(1) : '—';
	const max = arr => arr.length ? Math.max(...arr).toFixed(1) : '—';

	const historyRows = Array.from({ length: HISTORY_LEN }, (_, i) => {
		const label = `${HISTORY_LEN - i}s ago`;
		return `<tr>
      <td>${label}</td>
      <td>${ramHistory[i] || '—'}</td>
      <td>${fpsHistory[i] || '—'}</td>
      <td>${cpuHistory[i] || '—'}</td>
    </tr>`;
	}).join('');

	const tasksRows = (data.recentLongTasks ?? []).length > 0
		? [...data.recentLongTasks].reverse().map((t, i) => {
			const sev = t.duration > 200 ? ['Critical', '#fef2f2', '#b91c1c'] : t.duration > 100 ? ['Warning', '#fffbeb', '#b45309'] : ['Normal', '#f0fdf4', '#15803d'];
			return `<tr>
        <td>${i + 1}</td>
        <td>${new Date(t.ts).toLocaleTimeString()}</td>
        <td><strong>${t.duration} ms</strong></td>
        <td><span style="background:${sev[1]};color:${sev[2]};padding:1px 8px;border-radius:99px;font-size:11px;font-weight:600">${sev[0]}</span></td>
      </tr>`;
		}).join('')
		: `<tr><td colspan="4" style="text-align:center;color:#6b7280">No long tasks recorded during this session</td></tr>`;

	const badge = (label, status, color) =>
		`<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px">
      <span style="font-size:13px;color:#374151;font-weight:500">${label}</span>
      <span style="font-size:12px;font-weight:700;color:${color};background:${color}18;padding:2px 10px;border-radius:99px">${status}</span>
    </div>`;

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Performance Report — ${new URL(data.url).hostname}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; font-size: 14px; color: #111827; background: #fff; line-height: 1.6; }
    .page { max-width: 860px; margin: 0 auto; padding: 48px 40px; }

    /* Header */
    .report-header { border-bottom: 2px solid #111827; padding-bottom: 24px; margin-bottom: 36px; }
    .report-title { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 6px; }
    .report-subtitle { font-size: 13px; color: #6b7280; }
    .report-subtitle a { color: #2563eb; text-decoration: none; }
    .report-meta { display: flex; gap: 32px; margin-top: 16px; flex-wrap: wrap; }
    .report-meta-item { font-size: 12px; color: #6b7280; }
    .report-meta-item strong { color: #111827; display: block; font-size: 13px; }

    /* Sections */
    h2 { font-size: 16px; font-weight: 700; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; color: #111827; }
    section { margin-bottom: 40px; }

    /* Summary grid */
    .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }

    /* Metric blocks */
    .metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .metric-block { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; }
    .metric-block .label { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #9ca3af; margin-bottom: 4px; }
    .metric-block .value { font-size: 28px; font-weight: 800; line-height: 1; }
    .metric-block .unit { font-size: 12px; color: #6b7280; margin-top: 2px; }

    /* Stats table */
    .stats-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px; }
    .stats-table th { text-align: left; padding: 8px 12px; background: #f3f4f6; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
    .stats-table td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; }
    .stats-table tr:last-child td { border-bottom: none; }
    .stats-table tr:hover td { background: #f9fafb; }

    /* Progress bar */
    .bar-track { background: #e5e7eb; border-radius: 99px; height: 8px; margin-top: 8px; }
    .bar-fill { height: 100%; border-radius: 99px; }

    /* Charts */
    .chart-wrap { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; margin-bottom: 12px; }
    .chart-wrap .chart-label { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #9ca3af; margin-bottom: 8px; }
    .chart-wrap img { display: block; width: 100%; border-radius: 4px; }

    /* Footer */
    .report-footer { border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; }

    @media print {
      body { font-size: 12px; }
      .page { padding: 24px; }
      section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="report-header">
    <div class="report-title">Performance Report</div>
    <div class="report-subtitle">
      <a href="${data.url}" target="_blank">${data.url}</a>
    </div>
    <div class="report-meta">
      <div class="report-meta-item"><strong>${tsStr}</strong>Recorded at</div>
      <div class="report-meta-item"><strong>${new URL(data.url).hostname}</strong>Page</div>
      <div class="report-meta-item"><strong>${HISTORY_LEN}s</strong>History window</div>
      <div class="report-meta-item"><strong>${data.longTasks}</strong>Total long tasks</div>
    </div>
  </div>

  <!-- Summary -->
  <section>
    <h2>Summary</h2>
    <div class="summary-grid">
      ${badge('JS Heap RAM', `${ramStatus[0]} — ${data.ramMB} MB`, ramStatus[1])}
      ${badge('Frame Rate', `${fpsStatus[0]} — ${data.fps} fps`, fpsStatus[1])}
      ${badge('CPU Usage', `${cpuStatus[0]} — ${cpuPct}%`, cpuStatus[1])}
      ${badge('Long Tasks', `${ltStatus[0]} — ${data.longTasks} task${data.longTasks !== 1 ? 's' : ''}`, ltStatus[1])}
    </div>
  </section>

  <!-- Snapshot -->
  <section>
    <h2>Snapshot at ${tsStr}</h2>
    <div class="metrics-grid">
      <div class="metric-block">
        <div class="label">JS Heap RAM</div>
        <div class="value" style="color:${ramStatus[1]}">${data.ramMB}</div>
        <div class="unit">MB used</div>
        <div class="bar-track"><div class="bar-fill" style="width:${ramPct}%;background:${ramStatus[1]}"></div></div>
      </div>
      <div class="metric-block">
        <div class="label">Frame Rate</div>
        <div class="value" style="color:${fpsStatus[1]}">${data.fps}</div>
        <div class="unit">fps</div>
      </div>
      <div class="metric-block">
        <div class="label">CPU Usage</div>
        <div class="value" style="color:${cpuStatus[1]}">${cpuPct}</div>
        <div class="unit">%</div>
      </div>
      <div class="metric-block">
        <div class="label">Long Tasks</div>
        <div class="value" style="color:${ltStatus[1]}">${data.longTasks}</div>
        <div class="unit">total &gt;50 ms</div>
      </div>
    </div>

    <table class="stats-table">
      <thead><tr><th>Metric</th><th>Current</th><th>Avg (30s)</th><th>Min</th><th>Max</th><th>Details</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>JS Heap RAM</strong></td>
          <td>${data.ramMB} MB</td>
          <td>${avg(avgRam)} MB</td>
          <td>${min(avgRam)} MB</td>
          <td>${max(avgRam)} MB</td>
          <td>${data.ramTotalMB} MB allocated · ${data.ramLimitMB} MB limit</td>
        </tr>
        <tr>
          <td><strong>Frame Rate</strong></td>
          <td>${data.fps} fps</td>
          <td>${avg(avgFps)} fps</td>
          <td>${min(avgFps)} fps</td>
          <td>${max(avgFps)} fps</td>
          <td>Target: 60 fps</td>
        </tr>
        <tr>
          <td><strong>CPU Usage</strong></td>
          <td>${cpuPct}%</td>
          <td>${avg(avgCpu)}%</td>
          <td>${min(avgCpu)}%</td>
          <td>${max(avgCpu)}%</td>
          <td>System-wide average</td>
        </tr>
      </tbody>
    </table>
  </section>

  <!-- Charts -->
  <section>
    <h2>30-second History Charts</h2>
    ${fpsImg ? `<div class="chart-wrap"><div class="chart-label">Frame Rate (fps)</div><img src="${fpsImg}"/></div>` : ''}
    ${ramImg ? `<div class="chart-wrap"><div class="chart-label">JS Heap RAM (MB)</div><img src="${ramImg}"/></div>` : ''}
    ${cpuImg ? `<div class="chart-wrap"><div class="chart-label">CPU Usage (%)</div><img src="${cpuImg}"/></div>` : ''}
  </section>

  <!-- Long Tasks -->
  <section>
    <h2>Long Tasks Detail</h2>
    <p style="font-size:13px;color:#6b7280;margin-bottom:16px">
      A long task is any main-thread operation exceeding 50 ms that blocks user interaction.
      ${data.longTasks > 0 ? `<strong style="color:#111827">${data.longTasks} total tasks</strong> were recorded during this session.` : 'No long tasks were recorded during this session.'}
    </p>
    <table class="stats-table">
      <thead><tr><th>#</th><th>Time</th><th>Duration</th><th>Severity</th></tr></thead>
      <tbody>${tasksRows}</tbody>
    </table>
  </section>

  <!-- Raw history -->
  <section>
    <h2>Raw History Data (last ${HISTORY_LEN} seconds)</h2>
    <table class="stats-table">
      <thead><tr><th>Time</th><th>RAM (MB)</th><th>FPS</th><th>CPU (%)</th></tr></thead>
      <tbody>${historyRows}</tbody>
    </table>
  </section>

  <div class="report-footer">
    <span>Generated by PerfMonitor</span>
    <span>${tsStr}</span>
  </div>

</div>
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
