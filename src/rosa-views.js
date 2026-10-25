export const rosaHtml = `<!doctype html>
<html lang="en" data-app="personal" data-monitor="rosa"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Rosa · GPUs & queues · Miguel Nogales</title><link rel="icon" href="/assets/research/misc/favicon.png"><link rel="stylesheet" href="/personal/style.css"><link rel="stylesheet" href="/css/app-theme.css?v=20260930"><link rel="stylesheet" href="/personal/rosa.css"><script src="/js/app-theme.js?v=20260930"></script><script src="/personal/rosa.js" defer></script></head>
<body>
<main><nav class="personal-nav" aria-label="Personal tools"><a href="https://api.miguelnogales.com/auth/">Your apps ↗</a><a href="/personal/dashboard">Dashboard</a><a href="/personal/affluenza">USI Gym</a><a href="/personal/rosa" aria-current="page">Rosa GPUs</a></nav>
<div class="heading"><div><p class="eyebrow">University compute</p><h1>Rosa cluster</h1><p class="intro">GPU allocations, who is using them, and what is waiting.</p></div><button id="rosa-refresh" type="button">↻ Reload snapshot</button></div>
<div class="rosa-status"><span id="rosa-state" class="badge neutral">Connecting</span><p id="rosa-message" role="status">Loading the latest snapshot from Titan…</p></div><p id="rosa-time" class="check-summary">No completed reading yet</p><p id="rosa-history-note" class="rosa-history-note" hidden>Showing last-known allocations and users. Colors describe the saved reading, not current availability.</p>
<div class="services rosa-stats"><article class="service rosa-gpu-summary" id="rosa-gpu-summary"><h3>GPUs allocated</h3><strong class="usage-value" id="rosa-allocated">—</strong><p id="rosa-total">Waiting for scheduler data</p><p id="rosa-allocation-label">Allocation unknown</p></article><article class="service"><h3>Running jobs</h3><strong class="usage-value" id="rosa-running">—</strong><p>Across all visible partitions</p></article><article class="service"><h3>Pending jobs</h3><strong class="usage-value" id="rosa-pending">—</strong><p id="rosa-mine">Waiting for queue data</p></article></div>
<section class="rosa-section" aria-labelledby="gpu-title"><div class="section-heading"><h2 id="gpu-title">GPU nodes</h2><span id="rosa-node-count" class="count"></span></div><p class="rosa-section-note">See which nodes are free, allocated, or unavailable.</p><div class="rosa-node-toolbar"><div class="rosa-node-filters" role="group" aria-label="Filter GPU nodes"><button type="button" data-node-filter="all" aria-pressed="true">All nodes</button><button type="button" data-node-filter="free" aria-pressed="false">Free</button><button type="button" data-node-filter="busy" aria-pressed="false">Allocated</button><button type="button" data-node-filter="mine" aria-pressed="false">My jobs</button><button type="button" data-node-filter="unknown" aria-pressed="false">Unavailable</button></div><p class="rosa-legend"><span data-allocation="free">● Free</span><span data-allocation="partial">● Partial</span><span data-allocation="full">● Allocated</span><span data-allocation="unknown">● Unavailable</span></p></div><div id="rosa-gpus" class="rosa-gpus"><p class="empty-note">No GPU snapshot available.</p></div><p class="rosa-data-note">Scheduler allocations, not measured GPU load. GPU load and VRAM are not reported here. An idle node does not guarantee a job can start.</p></section>
<section class="rosa-section" aria-labelledby="queue-title"><div class="section-heading"><h2 id="queue-title">Job queues</h2><span id="rosa-job-count" class="count"></span></div><div class="rosa-filters"><label>Partition <select id="rosa-partition"><option value="">All partitions</option></select></label><label>State <select id="rosa-job-state"><option value="">All states</option><option>RUNNING</option><option>PENDING</option></select></label><label class="rosa-checkbox"><input type="checkbox" id="rosa-only-mine"> Only my jobs (nogalm)</label></div><div class="rosa-table-wrap" tabindex="0" role="region" aria-label="Job queues"><table><thead><tr><th>Job</th><th>User</th><th>Partition</th><th>Status</th><th>Elapsed / limit</th><th>GPU request</th><th>Node / why waiting</th><th>Name</th></tr></thead><tbody id="rosa-jobs"></tbody></table></div><p id="rosa-no-jobs" class="empty-note">No queue snapshot available.</p></section>
<details class="rosa-section rosa-partitions-panel"><summary id="part-title">Partition limits &amp; scheduler states</summary><div class="rosa-table-wrap" tabindex="0" role="region" aria-label="Partition states"><table><thead><tr><th>Partition</th><th>Availability</th><th>Time limit</th><th>Nodes in state</th><th>State</th><th>GPU resources per node</th></tr></thead><tbody id="rosa-partitions"></tbody></table></div></details>
<footer><span>Titan sends a new snapshot every 5 minutes, even with this page closed.</span><span>Reload shows the latest received snapshot · Europe / Zurich</span></footer></main><noscript><p>Enable JavaScript to view Rosa’s current GPU and queue snapshot.</p></noscript></body></html>`;

export const rosaCss = `:root[data-app][data-monitor="rosa"] {
  --bg:#f4f7fb; --panel:#fff; --text:#17283f; --muted:#5a6b80; --border:#dce4ee; --accent:#2563eb;
  --neutral-bg:#edf2f8; --pixel-ink:var(--text); --pixel-panel:var(--panel); --pixel-line:var(--border);
  --pixel-accent:var(--accent); --pixel-soft:var(--neutral-bg); --pixel-shadow:transparent; --app-theme-bar-height:42px;
  font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
}
:root[data-app][data-monitor="rosa"][data-theme="dark"] {
  --bg:#0c1320; --panel:#142032; --text:#edf3fc; --muted:#a7b7cc; --border:#2c3c52; --accent:#8db9ff; --neutral-bg:#1d2c42;
}
[data-monitor="rosa"] body { background:var(--bg); background-image:none; font:15px/1.55 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
[data-monitor="rosa"] :is(h1,h2,h3,h4,button,input,select,summary,.eyebrow) {font-family:inherit;letter-spacing:normal}
:root[data-monitor="rosa"] h1 {font-size:clamp(1.9rem,4vw,2.4rem);font-weight:750;letter-spacing:-.04em;text-shadow:none;margin:0 0 8px}
:root[data-monitor="rosa"] h2 {font-size:1.18rem;font-weight:700}
:root[data-monitor="rosa"] h3 {font-size:1rem;font-weight:650}
[data-monitor="rosa"] .eyebrow {font-size:.72rem;font-weight:750;letter-spacing:.13em;margin-bottom:7px}
[data-monitor="rosa"] main {max-width:1480px;padding:28px 28px 0}
[data-monitor="rosa"] .topbar {min-height:66px;padding:14px max(28px,calc((100% - 1424px)/2));gap:12px}
[data-monitor="rosa"] .brand {font-size:.94rem;font-weight:650}
[data-monitor="rosa"] .monogram {font-family:inherit;font-size:.8rem;font-weight:750;line-height:1;box-shadow:none;width:32px;height:32px;border-radius:8px}
[data-monitor="rosa"] .app-theme-bar {font-size:.8rem;border-bottom:1px solid var(--border);padding-inline:28px}
[data-monitor="rosa"] .app-theme-bar button {min-height:28px;min-width:80px;font-size:.75rem;border-width:1px;border-radius:6px;box-shadow:none}
[data-monitor="rosa"] button:not([data-app-theme-toggle]) {border:1px solid var(--border);border-radius:8px;box-shadow:none;font-size:.9rem;font-weight:600;padding:9px 14px;line-height:1.4}
[data-monitor="rosa"] button:not(:disabled):not(.board-cell):active {transform:none;box-shadow:none}
[data-monitor="rosa"] .personal-nav {margin:0 0 24px;padding-bottom:14px;gap:8px;font-size:.85rem}
[data-monitor="rosa"] .personal-nav a {padding:6px 12px;border-radius:6px;color:var(--muted)}
[data-monitor="rosa"] .personal-nav a[aria-current="page"] {color:var(--accent);background:var(--neutral-bg)}
[data-monitor="rosa"] .heading {margin-bottom:24px;align-items:center}
[data-monitor="rosa"] .intro {font-size:.96rem}
.rosa-status {display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.rosa-status p {margin:0;font-size:.9rem;color:var(--muted)}
[data-monitor="rosa"] .badge {font-size:.78rem;font-weight:650;border-radius:5px;line-height:1.35;padding:5px 8px}
.rosa-status+.check-summary {margin:9px 0 0;font-size:.84rem;line-height:1.7}
.rosa-stats {margin-top:24px}
[data-monitor="rosa"] .rosa-stats .service {padding:20px 22px;border:1px solid var(--border);border-radius:12px;box-shadow:none;background:var(--panel)}
[data-monitor="rosa"] .rosa-stats h3 {font-size:.88rem;color:var(--muted);font-weight:550}
[data-monitor="rosa"] .usage-value {font-size:2.3rem;font-weight:750;line-height:1.2;letter-spacing:-.04em;margin:10px 0}
[data-monitor="rosa"] .rosa-stats p {font-size:.84rem}
#rosa-allocation-label {display:none}
.rosa-section {margin-top:34px}
.section-heading .count {font-size:.83rem}
.rosa-section-note {font-size:.86rem;color:var(--muted);margin:0 0 14px}
.rosa-node-toolbar {display:flex;gap:18px;justify-content:space-between;align-items:center;flex-wrap:wrap;margin:18px 0}
.rosa-node-filters {display:flex;gap:6px;flex-wrap:wrap}
[data-monitor="rosa"] .rosa-node-filters button {font-size:.82rem;padding:7px 11px;background:var(--panel);color:var(--muted)}
[data-monitor="rosa"] .rosa-node-filters button[aria-pressed="true"] {background:var(--text);border-color:var(--text);color:var(--panel)}
.rosa-legend {display:flex;gap:14px;flex-wrap:wrap;margin:0;font-size:.78rem;color:var(--muted)}
.rosa-gpus {display:grid;grid-template-columns:repeat(auto-fit,minmax(275px,1fr));gap:16px}
.rosa-node {padding:20px;border:1px solid var(--border);border-left:4px solid var(--allocation-color);border-radius:12px;background:var(--panel);min-width:0;display:flex;flex-direction:column}
.rosa-node header {display:flex;align-items:center;justify-content:space-between;gap:12px}
[data-monitor="rosa"] .rosa-node h3 {font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:1.05rem;font-weight:700;letter-spacing:-.03em;margin:0}
.rosa-node p {margin:0;overflow-wrap:anywhere}
.rosa-node .rosa-gpu-model {font-size:.85rem;color:var(--muted);margin:7px 0 18px;min-height:1.4em}
.rosa-occupancy {display:flex;align-items:baseline;gap:7px;margin-bottom:10px}
.rosa-occupancy strong {font-size:1.2rem;line-height:1.3;font-weight:750;color:var(--text)}
.rosa-occupancy span {font-size:.82rem;color:var(--muted)}
.rosa-node progress {width:100%;height:5px;accent-color:var(--allocation-color);margin:0 0 18px}
.rosa-owner-label {font-size:.68rem;font-weight:750;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px}
.rosa-users {display:flex;gap:7px;flex-wrap:wrap;align-items:center;min-height:37px;margin-bottom:16px}
.rosa-user-chip {max-width:100%;overflow-wrap:anywhere;font-size:1.2rem;font-weight:750;letter-spacing:-.02em;color:var(--text);padding:3px 9px;border-radius:6px;background:var(--neutral-bg);line-height:1.5}
.rosa-owner-empty {font-size:.95rem;color:var(--muted);font-weight:500}
.rosa-node-details {margin-top:auto;border-top:1px solid var(--border);padding-top:12px;color:var(--muted);font-size:.8rem}
.rosa-node-details summary {cursor:pointer;font-size:.8rem;font-weight:550;color:var(--muted);width:fit-content}
.rosa-node-details summary:hover {color:var(--text)}
.rosa-node-details p {margin-top:9px;font-size:.8rem}
.rosa-node-details ul {margin:9px 0 0;padding-left:18px;font-size:.8rem}
.rosa-node-details li+li {margin-top:5px}
.rosa-node-warning {font-size:.76rem;color:var(--muted);padding-top:12px}
.rosa-node .rosa-history-label {display:none}
.rosa-stale .rosa-history-label {display:block;font-size:.76rem;color:var(--muted);margin:0 0 12px}
.rosa-history-note {padding:12px 16px;border:1px solid var(--border);border-left:4px solid var(--accent);border-radius:8px;background:var(--neutral-bg);color:var(--text);font-size:.9rem}
.rosa-gpu-summary,.rosa-node,.rosa-legend {--allocation-color:var(--muted);--rosa-amber:#936000;--rosa-red:#b33d4b;--rosa-green:#147351}
:root[data-theme="dark"] .rosa-gpu-summary,:root[data-theme="dark"] .rosa-node,:root[data-theme="dark"] .rosa-legend {--rosa-amber:#ffd080;--rosa-red:#ff9caa;--rosa-green:#79ddb0}
[data-allocation="free"] {--allocation-color:var(--rosa-green)}
[data-allocation="partial"] {--allocation-color:var(--rosa-amber)}
[data-allocation="full"] {--allocation-color:var(--rosa-red)}
.rosa-node[data-allocation] {background:color-mix(in srgb,var(--allocation-color) 3%,var(--panel));border-left-color:var(--allocation-color)}
[data-monitor="rosa"] .rosa-node .rosa-node-status {color:var(--allocation-color);background:color-mix(in srgb,var(--allocation-color) 10%,var(--panel));font-size:.73rem;padding:4px 7px}
.rosa-node progress {accent-color:var(--allocation-color)}
[data-monitor="rosa"] .rosa-gpu-summary[data-allocation] {border-left:4px solid var(--allocation-color)}
.rosa-gpu-summary .usage-value {color:var(--allocation-color)}
.rosa-legend [data-allocation="free"] {color:var(--rosa-green)}
.rosa-legend [data-allocation="partial"] {color:var(--rosa-amber)}
.rosa-legend [data-allocation="full"] {color:var(--rosa-red)}
.rosa-filters {display:flex;gap:16px;align-items:end;flex-wrap:wrap;margin:18px 0}
.rosa-filters label {display:grid;gap:6px;color:var(--muted);font-size:.82rem;font-weight:550}
[data-monitor="rosa"] .rosa-filters select {font:inherit;padding:9px 12px;min-height:42px;border:1px solid var(--border);border-radius:7px;color:var(--text);background:var(--panel)}
.rosa-filters .rosa-checkbox {display:flex;gap:8px;align-items:center;padding-bottom:10px}
.rosa-checkbox input {width:16px;height:16px}
.rosa-table-wrap {overflow:auto;border:1px solid var(--border);border-radius:10px;background:var(--panel);max-height:570px}
[data-monitor="rosa"] table {border-collapse:collapse;min-width:100%;font-size:.87rem;text-align:left;line-height:1.5}
[data-monitor="rosa"] th,[data-monitor="rosa"] td {padding:12px 14px;border-bottom:1px solid var(--border);white-space:nowrap}
[data-monitor="rosa"] th {position:sticky;top:0;z-index:1;font-size:.77rem;font-weight:650;color:var(--muted);background:var(--neutral-bg)}
tbody tr:last-child td {border-bottom:0}
#rosa-jobs td:nth-child(2) {font-weight:700;font-size:.94rem;color:var(--text)}
#rosa-jobs td:nth-child(5) {font-size:.82rem;font-variant-numeric:tabular-nums}
#rosa-jobs td:last-child {max-width:250px;overflow:hidden;text-overflow:ellipsis}
tr.mine {background:color-mix(in srgb,var(--accent) 4%,var(--panel))}
.rosa-job-badge {font-size:.74rem;font-weight:650;padding:4px 7px;border-radius:5px;background:var(--neutral-bg);color:var(--muted)}
.rosa-job-badge.running {color:var(--good);background:var(--good-bg)}
.rosa-partitions-panel {padding:18px 20px;border:1px solid var(--border);border-radius:10px;background:var(--panel)}
.rosa-partitions-panel>summary {cursor:pointer;font-size:.95rem;font-weight:650}
.rosa-partitions-panel .rosa-table-wrap {margin-top:18px}
.rosa-data-note {font-size:.82rem;color:var(--muted);margin:14px 0 0;line-height:1.65}
.empty-note {color:var(--muted);font-size:.9rem}
[data-monitor="rosa"] footer {font-size:.8rem;line-height:1.7;padding:20px 0;margin-top:30px}
@media(max-width:900px) {.rosa-gpus{grid-template-columns:repeat(2,minmax(0,1fr))}.rosa-node-toolbar{align-items:flex-start}.rosa-legend{gap:10px}}
@media(max-width:600px) {[data-monitor="rosa"] main{padding:22px 16px 0}[data-monitor="rosa"] .topbar{padding:12px 16px}[data-monitor="rosa"] .app-theme-bar{padding-inline:16px}.heading{flex-wrap:wrap}.rosa-gpus{grid-template-columns:1fr}.rosa-node{padding:20px}.rosa-filters{gap:12px}.rosa-stats{gap:12px}[data-monitor="rosa"] .rosa-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.rosa-stats .rosa-gpu-summary{grid-column:1/-1}[data-monitor="rosa"] .personal-nav{gap:4px}[data-monitor="rosa"] .personal-nav a{padding:6px 8px}.rosa-node-filters{gap:5px}.rosa-legend{font-size:.75rem}}
`;

export function allocationTone(allocated, total, state = '') {
  if (/DRAIN|DOWN|FAIL|UNKNOWN|NOT_RESPONDING/.test(state) || !Number.isFinite(allocated) || !Number.isFinite(total) || total <= 0 || allocated < 0 || allocated > total) return 'unknown';
  return allocated === 0 ? 'free' : allocated === total ? 'full' : 'partial';
}

export function nodeGpuJobs(jobs, nodeName) {
  function expand(expression) {
    const match = expression.match(/^(.*?)\[([^\]]+)\](.*)$/);
    if (!match) return [expression];
    const values = [];
    for (const part of match[2].split(',')) {
      if (!/^\d{1,8}(?:-\d{1,8})?$/.test(part)) return [];
      const [first, last = first] = part.split('-');
      const start = Number(first), end = Number(last);
      if (end < start || end - start > 4096) return [];
      for (let i = start; i <= end; i++) {
        const value = first.startsWith('0') ? String(i).padStart(first.length, '0') : String(i);
        for (const suffix of expand(match[3])) {
          values.push(match[1] + value + suffix);
          if (values.length > 4096) return [];
        }
      }
    }
    return values;
  }
  return jobs.filter(job => ['RUNNING', 'COMPLETING', 'SUSPENDED', 'CONFIGURING'].includes(job.state) && /(?:^|[:/,])gpu(?=[:=,]|$)/i.test(job.gres || '') && (String(job.reason || '').match(/(?:[^\[,\]]|\[[^\]]+\])+/g) || []).some(expression => expand(expression).includes(nodeName)));
}

export const rosaScript = `const nodeGpuJobs = ${nodeGpuJobs.toString()};
const allocationTone = ${allocationTone.toString()};
const allocationLabels = { free: 'Free', partial: 'Partly allocated', full: 'Fully allocated', unknown: 'Unavailable / unknown' };
const $ = id => document.getElementById(id);
let data = null, busy = false, nodeFilter = 'all';
const timestamp = value => new Date(value).toLocaleString('en-GB', { timeZone: 'Europe/Zurich' }) + ' Zurich';
function element(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
function table(id, rows) { $(id).replaceChildren(...rows.map(values => { const tr = element('tr'); for (const value of values) tr.append(element('td', value ?? '—')); return tr; })); }
function queues() {
  const jobs = (data?.snapshot?.jobs || []).filter(j => (!$('rosa-partition').value || j.partition === $('rosa-partition').value) && (!$('rosa-job-state').value || j.state === $('rosa-job-state').value) && (!$('rosa-only-mine').checked || j.user === 'nogalm'));
  table('rosa-jobs', jobs.map(j => [j.id, j.user, j.partition, j.state, j.elapsed + ' / ' + j.limit, j.gres, j.reason, j.name]));
  [...$('rosa-jobs').children].forEach((tr, i) => {
    if (jobs[i].user === 'nogalm') tr.className = 'mine';
    const state = jobs[i].state;
    const badge = element('span', state === 'PENDING' ? 'Waiting' : state === 'RUNNING' ? 'Running' : state, 'rosa-job-badge ' + (state === 'RUNNING' ? 'running' : ''));
    tr.children[3].replaceChildren(badge);
    tr.children[6].textContent = jobs[i].reason.replace(/^\\(|\\)$/g, '');
  });
  $('rosa-job-count').textContent = jobs.length + ' shown / ' + (data?.snapshot?.jobs.length || 0) + ' total';
  $('rosa-no-jobs').textContent = data?.snapshot ? 'No jobs match these filters.' : 'No queue snapshot available.';
  $('rosa-no-jobs').hidden = jobs.length > 0;
}
function freshness() {
  if (!data) return;
  const s = data.snapshot;
  const stale = !s || !Number.isFinite(Date.parse(s.observedAt)) || Date.now() - Date.parse(s.observedAt) > 600000 || data.state === 'unavailable';
  document.body.classList.toggle('rosa-stale', stale);
  $('rosa-history-note').hidden = !s || !stale;
  $('rosa-state').textContent = data.state === 'refreshing' ? 'Refreshing' : stale ? (s ? 'Last known data' : 'Unavailable') : 'Updated';
  $('rosa-state').className = 'badge ' + (stale ? 'bad' : data.state === 'refreshing' ? 'neutral' : '');
  $('rosa-message').textContent = data.error || (data.state === 'refreshing' ? 'Waiting for the next scheduled Titan snapshot…' : stale ? 'Waiting for a current Rosa reading. Try Reload snapshot.' : 'Received from Titan · updates every 5 minutes.');
  $('rosa-time').textContent = (s ? 'Observed ' + timestamp(s.observedAt) : 'No completed Rosa reading') + (data.receivedAt ? ' · Received ' + new Date(data.receivedAt).toLocaleTimeString('en-GB', { timeZone: 'Europe/Zurich', hour: '2-digit', minute: '2-digit' }) : '') + (data.nextAttemptAt ? ' · Next report around ' + new Date(data.nextAttemptAt).toLocaleTimeString('en-GB', { timeZone: 'Europe/Zurich', hour: '2-digit', minute: '2-digit' }) : '');
}
function renderNodes() {
  const s = data?.snapshot;
  if (!s) return;
  const nodes = s.nodes.filter(n => n.gpus > 0);
  const modelName = value => value.replace(/\\(S:[^)]+\\)/g, '').replace(/gpu:/g, '').replace(/:\\d+(?=,|$)/g, '').replace(/NVIDIA(?=[A-Z])/g, 'NVIDIA ').replace(/GeForce(?=GTX|RTX)/g, 'GeForce ').replace(/(GTX|RTX)(?=\\d)/g, '$1 ').replace(/(\\d)Ti/g, '$1 Ti').replace(/A100-PCIE-40GB/g, 'A100 · 40 GB').replace(/,/g, ' / ');
  const visible = nodes.filter(n => {
    const tone = allocationTone(n.allocatedGpus, n.gpus, n.state);
    return nodeFilter === 'all' || (nodeFilter === 'free' && tone === 'free') || (nodeFilter === 'busy' && ['partial', 'full'].includes(tone)) || (nodeFilter === 'unknown' && tone === 'unknown') || (nodeFilter === 'mine' && nodeGpuJobs(s.jobs, n.name).some(job => job.user === 'nogalm'));
  });
  $('rosa-node-count').textContent = visible.length + ' of ' + nodes.length + ' nodes';
  for (const button of document.querySelectorAll('[data-node-filter]')) button.setAttribute('aria-pressed', String(button.dataset.nodeFilter === nodeFilter));
  const labels = { free: 'Free', partial: 'Partial', full: 'Allocated', unknown: 'Unavailable' };
  $('rosa-gpus').replaceChildren(...visible.map(n => {
    const card = element('article', undefined, 'rosa-node');
    const tone = allocationTone(n.allocatedGpus, n.gpus, n.state);
    card.dataset.allocation = tone;
    const head = element('header'); head.append(element('h3', n.name), element('span', labels[tone], 'badge rosa-node-status')); card.append(head);
    card.append(element('p', modelName(n.gpuModel), 'rosa-gpu-model'));
    const occupancy = element('div', undefined, 'rosa-occupancy');
    occupancy.append(element('strong', (n.allocatedGpus ?? '?') + ' / ' + n.gpus), element('span', 'GPUs allocated')); card.append(occupancy);
    if (Number.isFinite(n.allocatedGpus)) { const bar = element('progress'); bar.max = n.gpus; bar.value = n.allocatedGpus; bar.setAttribute('aria-label', n.name + ' GPU allocation'); card.append(bar); }
    const jobs = nodeGpuJobs(s.jobs, n.name);
    const users = [...new Set(jobs.map(job => job.user).filter(Boolean))];
    card.append(element('div', users.length > 1 ? 'Running users' : 'Running user', 'rosa-owner-label'));
    const owners = element('div', undefined, 'rosa-users');
    if (users.length) for (const user of users) owners.append(element('span', user, 'rosa-user-chip'));
    else owners.append(element('span', n.allocatedGpus === 0 ? 'No GPU jobs' : 'Not available in snapshot', 'rosa-owner-empty'));
    card.append(owners, element('small', 'Last-known reading', 'rosa-history-label'));
    const details = element('details', undefined, 'rosa-node-details');
    details.append(element('summary', jobs.length ? jobs.length + (jobs.length === 1 ? ' job' : ' jobs') + ' · details' : 'Scheduler details'));
    if (jobs.length) { const list = element('ul'); for (const job of jobs) list.append(element('li', '#' + job.id + ' · ' + job.name)); details.append(list); }
    details.append(element('p', 'Slurm: ' + n.state + ' · ' + n.partitions.join(', '))); card.append(details);
    if (n.gpus > 1 || ['icsnode41', 'icsnode42'].includes(n.name)) card.append(element('p', n.gpus + ' GPUs · multiple-GPU node', 'rosa-node-warning'));
    if (n.telemetry?.length) for (const gpu of n.telemetry) card.append(element('p', 'GPU ' + gpu.index + ': ' + gpu.utilization + '% · ' + Math.round(gpu.memoryUsedMiB) + ' / ' + Math.round(gpu.memoryTotalMiB) + ' MiB VRAM', 'rosa-node-warning'));
    return card;
  }));
  if (!visible.length) $('rosa-gpus').append(element('p', 'No GPU nodes match this filter.', 'empty-note'));
}
function render() {
  freshness();
  const s = data?.snapshot;
  if (!s) { queues(); return; }
  const nodes = s.nodes.filter(n => n.gpus > 0);
  const total = nodes.reduce((sum, n) => sum + n.gpus, 0);
  const allocationKnown = nodes.every(n => Number.isFinite(n.allocatedGpus));
  $('rosa-allocated').textContent = allocationKnown ? nodes.reduce((sum, n) => sum + n.allocatedGpus, 0) + ' / ' + total : 'Unknown';
  const allocated = nodes.reduce((sum, n) => sum + (n.allocatedGpus || 0), 0);
  const tone = allocationTone(allocationKnown ? allocated : null, total);
  $('rosa-gpu-summary').dataset.allocation = tone;
  $('rosa-allocation-label').textContent = allocationLabels[tone];
  $('rosa-total').textContent = total + ' GPUs across ' + nodes.length + ' nodes';
  $('rosa-running').textContent = s.jobs.filter(j => j.state === 'RUNNING').length;
  $('rosa-pending').textContent = s.jobs.filter(j => j.state === 'PENDING').length;
  $('rosa-mine').textContent = s.jobs.filter(j => j.user === 'nogalm' && j.state === 'PENDING').length + ' of yours waiting';
  renderNodes();
  const selected = $('rosa-partition').value;
  $('rosa-partition').replaceChildren(element('option', 'All partitions'));
  $('rosa-partition').firstChild.value = '';
  for (const name of [...new Set([...s.partitions.map(p => p.name.replace(/\\*$/, '')), ...s.jobs.map(j => j.partition)])].sort()) { const option = element('option', name); option.value = name; $('rosa-partition').append(option); }
  $('rosa-partition').value = selected;
  table('rosa-partitions', s.partitions.map(p => [p.name, p.availability, p.limit, p.nodes, p.state, p.gres]));
  queues();
}
async function load() {
  if (busy) return;
  busy = true; $('rosa-refresh').disabled = true;
  try {
    const response = await fetch('/api/personal/rosa', { method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(22000) });
    if (response.status === 401) { location.replace('/personal/login'); return; }
    if (!response.ok) throw Error('Unavailable');
    const next = await response.json();
    if (!['ready', 'waiting', 'refreshing', 'unavailable'].includes(next.state)) throw Error('Invalid state');
    if (next.snapshot && (!Array.isArray(next.snapshot.nodes) || !Array.isArray(next.snapshot.jobs) || !Array.isArray(next.snapshot.partitions))) throw Error('Invalid snapshot');
    data = next; render();
  } catch {
    data = { ...(data || {}), state: 'unavailable', error: 'Cannot reach the monitoring service. Existing readings, if shown, are historical.' }; freshness();
  } finally { busy = false; $('rosa-refresh').disabled = false; }
}
$('rosa-refresh').addEventListener('click', () => load());
for (const button of document.querySelectorAll('[data-node-filter]')) button.addEventListener('click', () => { nodeFilter = button.dataset.nodeFilter; renderNodes(); });
for (const id of ['rosa-partition', 'rosa-job-state', 'rosa-only-mine']) $(id).addEventListener('change', queues);
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
setInterval(() => { freshness(); if (!document.hidden) load(); }, 60000);
window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
load();`;
