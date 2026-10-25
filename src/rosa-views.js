export const rosaHtml = `<!doctype html>
<html lang="en" data-app="personal"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Rosa · GPUs & queues · Miguel Nogales</title><link rel="icon" href="/assets/research/misc/favicon.png"><link rel="stylesheet" href="/personal/style.css"><link rel="stylesheet" href="/css/app-theme.css?v=20260930"><link rel="stylesheet" href="/personal/rosa.css"><script src="/js/app-theme.js?v=20260930"></script><script src="/personal/rosa.js" defer></script></head>
<body><header class="topbar"><a href="/" class="brand"><span class="monogram">MN</span>Miguel Nogales</a><a href="https://api.miguelnogales.com/auth/">Your apps ↗</a></header>
<main><nav class="personal-nav" aria-label="Personal tools"><a href="/personal/dashboard">Dashboard</a><a href="/personal/affluenza">USI Gym</a><a href="/personal/rosa" aria-current="page">Rosa GPUs</a></nav>
<div class="heading"><div><p class="eyebrow">University compute</p><h1>Rosa<span>.</span></h1><p class="intro">GPU availability and every queue visible to your university account.</p></div><button id="rosa-refresh" type="button">↻ Reload snapshot</button></div>
<div class="rosa-status"><span id="rosa-state" class="badge neutral">Connecting</span><p id="rosa-message" role="status">Loading the latest snapshot from Titan…</p></div><p id="rosa-time" class="check-summary">No completed reading yet</p><p id="rosa-history-note" class="rosa-history-note" hidden>Showing last-known allocations and users. Colors describe the saved reading, not current availability.</p>
<div class="services rosa-stats"><article class="service rosa-gpu-summary" id="rosa-gpu-summary"><h3>GPUs allocated</h3><strong class="usage-value" id="rosa-allocated">—</strong><p id="rosa-total">Waiting for scheduler data</p><p id="rosa-allocation-label">Allocation unknown</p></article><article class="service"><h3>Running jobs</h3><strong class="usage-value" id="rosa-running">—</strong><p>Across all visible partitions</p></article><article class="service"><h3>Pending jobs</h3><strong class="usage-value" id="rosa-pending">—</strong><p id="rosa-mine">Waiting for queue data</p></article></div>
<section class="rosa-section" aria-labelledby="gpu-title"><div class="section-heading"><h2 id="gpu-title">GPU nodes</h2><span id="rosa-node-count" class="count"></span></div><p class="footnote">Allocation comes from Slurm. GPU utilization and VRAM are not exposed by the scheduler; compute-node access remains restricted. An idle node is not a guarantee that a job can start.</p><p class="footnote rosa-legend"><span data-allocation="free">● Free</span><span data-allocation="partial">● Partly allocated</span><span data-allocation="full">● Fully allocated</span><span data-allocation="unknown">● Unknown / unavailable</span></p><div id="rosa-gpus" class="rosa-gpus"><p class="empty-note">No GPU snapshot available.</p></div></section>
<section class="rosa-section" aria-labelledby="queue-title"><div class="section-heading"><h2 id="queue-title">Job queues</h2><span id="rosa-job-count" class="count"></span></div><div class="rosa-filters"><label>Partition <select id="rosa-partition"><option value="">All partitions</option></select></label><label>State <select id="rosa-job-state"><option value="">All states</option><option>RUNNING</option><option>PENDING</option></select></label><label class="rosa-checkbox"><input type="checkbox" id="rosa-only-mine"> Only my jobs (nogalm)</label></div><div class="rosa-table-wrap" tabindex="0" role="region" aria-label="Job queues"><table><thead><tr><th>Job</th><th>User</th><th>Partition</th><th>State</th><th>Elapsed / limit</th><th>GPU request</th><th>Nodes / pending reason</th><th>Name</th></tr></thead><tbody id="rosa-jobs"></tbody></table></div><p id="rosa-no-jobs" class="empty-note">No queue snapshot available.</p></section>
<section class="rosa-section" aria-labelledby="part-title"><div class="section-heading"><h2 id="part-title">Partitions</h2></div><div class="rosa-table-wrap" tabindex="0" role="region" aria-label="Partition states"><table><thead><tr><th>Partition</th><th>Availability</th><th>Time limit</th><th>Nodes in state</th><th>State</th><th>GPU resources per node</th></tr></thead><tbody id="rosa-partitions"></tbody></table></div></section>
<footer><span>Titan sends a new snapshot every 5 minutes, even with this page closed.</span><span>Reload shows the latest received snapshot · Europe / Zurich</span></footer></main><noscript><p>Enable JavaScript to view Rosa’s current GPU and queue snapshot.</p></noscript></body></html>`;

export const rosaCss = `.rosa-status{display:flex;gap:14px;align-items:center;flex-wrap:wrap}.rosa-status p{margin:0;font-size:.9rem;color:var(--muted)}.rosa-status+.check-summary{margin-top:12px}.rosa-section{margin-top:38px}.rosa-gpus{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-top:20px}.rosa-node{padding:20px;border:1px solid var(--border);border-radius:12px;background:var(--panel)}.rosa-node header{display:flex;align-items:center;justify-content:space-between;gap:10px}.rosa-node h3{font-family:ui-monospace,monospace}.rosa-node p{font-size:.8rem;color:var(--muted);margin:10px 0;overflow-wrap:anywhere}.rosa-node strong{display:block;font-size:1.2rem;margin:12px 0 5px}.rosa-node progress{width:100%;height:7px;accent-color:var(--accent)}.rosa-node small{display:block;color:var(--muted);font-size:.75rem}.rosa-filters{display:flex;gap:18px;align-items:end;flex-wrap:wrap;margin:20px 0}.rosa-filters label{display:grid;gap:5px;color:var(--muted);font-size:.8rem}.rosa-filters select{font:inherit;padding:9px;border:1px solid var(--border);border-radius:6px;color:var(--text);background:var(--panel)}.rosa-filters .rosa-checkbox{display:flex;align-items:center;padding-bottom:9px}.rosa-table-wrap{overflow:auto;border:1px solid var(--border);border-radius:10px;background:var(--panel)}table{border-collapse:collapse;min-width:100%;font-size:.8rem;text-align:left}th,td{padding:12px 14px;border-bottom:1px solid var(--border);white-space:nowrap}th{font-weight:600;color:var(--muted);background:var(--neutral-bg)}tbody tr:last-child td{border-bottom:0}tr.mine{background:color-mix(in srgb,var(--accent) 7%,var(--panel))}.empty-note{color:var(--muted);font-size:.875rem}.rosa-stats{margin-top:24px}.rosa-stale .rosa-table-wrap{opacity:.85}@media(max-width:700px){.heading{flex-wrap:wrap}.rosa-gpus{grid-template-columns:1fr}.rosa-filters{gap:12px}}.rosa-gpu-summary,.rosa-node,.rosa-legend{--allocation-color:var(--muted);--rosa-amber:#946000;--rosa-red:#b33c45;--rosa-green:#126c51}:root[data-theme="dark"] .rosa-gpu-summary,:root[data-theme="dark"] .rosa-node,:root[data-theme="dark"] .rosa-legend{--rosa-amber:#ffd080;--rosa-red:#ff9ca6;--rosa-green:#7cddb8}[data-allocation="free"]{--allocation-color:var(--rosa-green)}[data-allocation="partial"]{--allocation-color:var(--rosa-amber)}[data-allocation="full"]{--allocation-color:var(--rosa-red)}.rosa-gpu-summary[data-allocation],.rosa-node[data-allocation]{border-color:var(--allocation-color);border-left-width:5px;background:color-mix(in srgb,var(--allocation-color) 8%,var(--panel))}.rosa-gpu-summary .usage-value,.rosa-node strong,.rosa-allocation-label,.rosa-legend span{color:var(--allocation-color)}.rosa-node progress{accent-color:var(--allocation-color)}.rosa-legend{display:flex;gap:18px;flex-wrap:wrap}.rosa-legend [data-allocation="free"]{color:var(--rosa-green)}.rosa-legend [data-allocation="partial"]{color:var(--rosa-amber)}.rosa-legend [data-allocation="full"]{color:var(--rosa-red)}.rosa-history-note{padding:12px 16px;border-left:4px solid var(--accent);background:var(--neutral-bg);color:var(--text);font-size:.9rem}.rosa-node .rosa-node-users{color:var(--text);font-size:1rem;font-weight:600}.rosa-node .rosa-node-jobs{font-size:.8rem}.rosa-history-label{display:none}.rosa-stale .rosa-history-label{display:block;margin-top:10px;color:var(--text);font-weight:600}.rosa-stale .rosa-allocation-label::after,.rosa-stale #rosa-allocation-label::after{content:" at last reading"}`;

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
let data = null, busy = false;
const timestamp = value => new Date(value).toLocaleString('en-GB', { timeZone: 'Europe/Zurich' }) + ' Zurich';
function element(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
function table(id, rows) { $(id).replaceChildren(...rows.map(values => { const tr = element('tr'); for (const value of values) tr.append(element('td', value ?? '—')); return tr; })); }
function queues() {
  const jobs = (data?.snapshot?.jobs || []).filter(j => (!$('rosa-partition').value || j.partition === $('rosa-partition').value) && (!$('rosa-job-state').value || j.state === $('rosa-job-state').value) && (!$('rosa-only-mine').checked || j.user === 'nogalm'));
  table('rosa-jobs', jobs.map(j => [j.id, j.user, j.partition, j.state, j.elapsed + ' / ' + j.limit, j.gres, j.reason, j.name]));
  [...$('rosa-jobs').children].forEach((tr, i) => { if (jobs[i].user === 'nogalm') tr.className = 'mine'; });
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
  $('rosa-message').textContent = data.error || (data.state === 'refreshing' ? 'Waiting for the next scheduled Titan snapshot…' : stale ? 'Waiting for a current Rosa reading. Try Reload snapshot.' : 'Latest reading from Rosa via Titan.');
  $('rosa-time').textContent = (s ? 'Observed ' + timestamp(s.observedAt) : 'No completed Rosa reading') + (data.receivedAt ? ' · Received ' + timestamp(data.receivedAt) : '') + (data.nextAttemptAt ? ' · Next scheduled report ' + timestamp(data.nextAttemptAt) : '');
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
  $('rosa-node-count').textContent = nodes.length + ' GPU nodes';
  $('rosa-gpus').replaceChildren(...nodes.map(n => {
    const card = element('article', undefined, 'rosa-node');
    const tone = allocationTone(n.allocatedGpus, n.gpus, n.state);
    card.dataset.allocation = tone;
    const head = element('header'); head.append(element('h3', n.name), element('span', n.state, 'badge ' + (/DRAIN|DOWN|FAIL|UNKNOWN/.test(n.state) ? 'bad' : 'neutral'))); card.append(head);
    card.append(element('p', n.gpuModel.replace(/\\(S:[^)]+\\)/g, '') + ' · ' + n.partitions.join(', ')));
    card.append(element('strong', (n.allocatedGpus ?? '?') + ' / ' + n.gpus + ' allocated'));
    card.append(element('small', allocationLabels[tone], 'rosa-allocation-label'));
    const jobs = nodeGpuJobs(s.jobs, n.name);
    const users = [...new Set(jobs.map(job => job.user).filter(Boolean))];
    card.append(element('p', (users.length > 1 ? 'Users: ' : 'User: ') + (users.length ? users.join(', ') : n.allocatedGpus === 0 ? 'No GPU jobs' : 'Unavailable in this snapshot'), 'rosa-node-users'));
    if (jobs.length) card.append(element('p', 'Jobs: ' + jobs.map(job => '#' + job.id).join(', '), 'rosa-node-jobs'));
    card.append(element('small', 'Last-known snapshot', 'rosa-history-label'));
    if (Number.isFinite(n.allocatedGpus)) { const bar = element('progress'); bar.max = n.gpus; bar.value = n.allocatedGpus; bar.setAttribute('aria-label', n.name + ' GPU allocation'); card.append(bar); }
    if (n.gpus > 1 || ['icsnode41', 'icsnode42'].includes(n.name)) card.append(element('small', 'Multiple GPU node · excluded from your single-GPU runs'));
    if (n.telemetry?.length) for (const gpu of n.telemetry) card.append(element('p', 'GPU ' + gpu.index + ': ' + gpu.utilization + '% utilization · ' + Math.round(gpu.memoryUsedMiB) + ' / ' + Math.round(gpu.memoryTotalMiB) + ' MiB VRAM · ' + gpu.temperature + '°C'));
    else card.append(element('small', 'GPU utilization / VRAM unavailable'));
    return card;
  }));
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
for (const id of ['rosa-partition', 'rosa-job-state', 'rosa-only-mine']) $(id).addEventListener('change', queues);
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
setInterval(() => { freshness(); if (!document.hidden) load(); }, 60000);
window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
load();`;
