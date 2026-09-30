// Private gym dashboard; all assets are bundled inside the authenticated Worker.
export const affluenzaHtml = `<!doctype html>
<html lang="en" data-app="gym"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>USI Gym · Miguel Nogales</title><link rel="icon" href="/assets/research/misc/favicon.png"><link rel="stylesheet" href="/personal/affluenza.css"><script src="/personal/affluenza.js" defer></script><link rel="stylesheet" href="/css/app-theme.css?v=20260930">
    <script src="/js/app-theme.js?v=20260930"></script></head>
<body><header><a class="brand" href="/personal/dashboard"><span class="mark">mn</span> Your space</a><nav aria-label="Personal tools"><a href="/personal/dashboard">Dashboard</a><a href="https://api.miguelnogales.com/auth/">All apps ↗</a></nav></header>
<main><div class="heading"><div><p class="eyebrow">LUGANO / SALA FITNESS</p><h1>A little more room<br>for your <em>workout.</em></h1><p class="intro">Find your quiet hour at USI. A rolling 30-day view of the room’s crowding indicator.</p></div><div class="heading-side"><span class="location">USI · Campus Est</span><span>06:00–24:00 · open daily</span><button id="refresh" type="button">↻ Refresh readings</button></div></div>
<p id="status" class="status" role="status">Loading gym readings…</p>
<section class="metrics" aria-label="Gym summary"><article class="metric now"><span class="label">LATEST CROWDING</span><strong id="current">—</strong><span id="current-detail">Waiting for a reading</span><small id="latest-at"></small></article><article class="metric"><span class="label">QUIETEST HOUR</span><strong id="best">—</strong><span id="best-detail">During opening hours</span></article><article class="metric"><span class="label">BUSIEST HOUR</span><strong id="worst">—</strong><span id="worst-detail">During opening hours</span></article><article class="metric"><span class="label">MEAN DAILY CROWDING</span><strong id="mean">—</strong><span id="mean-detail">06:00 → next 06:00</span></article></section>
<section class="panel profile-panel"><div class="section-head"><div><p class="eyebrow">01 / THE SHAPE OF A DAY</p><h2>Your mean day.</h2><p>Thirty daily segments, each from 06:00 to the next 06:00. One average curve.</p></div><label class="toggle"><input id="overlay" type="checkbox" checked> Show individual days</label></div><div class="legend"><span class="mean-key">30-day mean</span><span class="day-key">Observed days</span><span class="closed-key">Closed 00:00–06:00</span></div><canvas id="profile" role="img" aria-label="Mean crowding profile from 06:00 to next 06:00"></canvas><p class="note" id="profile-note"></p></section>
<div class="two-up"><section class="panel"><div class="section-head"><div><p class="eyebrow">02 / PLAN YOUR VISIT</p><h2>Good times to go.</h2><p>Observed hourly means, during opening hours.</p></div></div><canvas id="hours" role="img" aria-label="Hourly crowding from 06:00 to midnight"></canvas><div class="rankings"><div><h3>Quietest</h3><ol id="best-list"></ol></div><div><h3>Busiest</h3><ol id="worst-list"></ol></div></div><p class="note">Lower means quieter. Rankings use only recorded data; small samples are provisional.</p></section>
<section class="panel"><div class="section-head"><div><p class="eyebrow">03 / A CLOSER LOOK</p><h2>One day at a time.</h2><p>The actual readings in a 06:00–06:00 segment.</p></div></div><label class="day-select">Day <select id="day" aria-label="Select a day of readings"></select></label><canvas id="trend" role="img" aria-label="Recorded crowding on the selected day"></canvas><p class="note" id="day-note"></p></section></div>
<section class="panel"><div class="section-head"><div><p class="eyebrow">04 / THE DAILY VIEW</p><h2>Daily means &amp; coverage.</h2><p>Each row is a Swiss local day starting at 06:00.</p></div><label class="toggle"><input id="show-empty" type="checkbox"> Include days with no data</label></div><div class="table-scroll"><table><thead><tr><th scope="col">Day (06:00 → 06:00)</th><th scope="col">Daily mean</th><th scope="col">Open-hours mean</th><th scope="col">Coverage</th><th scope="col">Status</th></tr></thead><tbody id="daily"></tbody></table></div><p class="note" id="missing-note"></p></section>
<footer><p><strong>How to read this</strong> · Percentages are estimates from USI’s visual gauge, not headcounts or measured capacity. Extra checks within a ten-minute interval count once. Each day has equal weight in the mean profile and hourly rankings. Missing data stays missing; means for incomplete days cover only observed intervals. Swiss daylight-saving changes are handled in the daily coverage.</p><a href="https://sport.usi.ch/it/lugano" target="_blank" rel="noopener noreferrer">Source: Sport all’USI ↗</a><span>Europe / Zurich · updates every 10 minutes</span></footer></main><noscript><p>Please enable JavaScript to load gym readings.</p></noscript></body></html>`;

export const affluenzaCss = `
:root{color-scheme:light;--bg:#f6f7f2;--paper:#fff;--ink:#202e29;--muted:#65756c;--line:#dde4db;--green:#197652;--mint:#dbeedb;--orange:#bd6e3a;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);line-height:1.55}a{color:inherit;text-decoration:none}header{max-width:1320px;margin:auto;padding:24px 40px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{display:flex;gap:12px;align-items:center;font-weight:650}.mark{background:var(--ink);color:var(--bg);width:38px;height:38px;display:grid;place-items:center;border-radius:11px;letter-spacing:-.12em;padding-right:4px}nav{display:flex;gap:25px;color:var(--muted);font-size:.85rem}main{max-width:1320px;margin:auto;padding:60px 40px 25px}.heading{display:flex;justify-content:space-between;align-items:end;gap:30px}.eyebrow{font-size:.67rem;letter-spacing:.15em;font-weight:750;color:var(--green);margin:0 0 13px}h1{font-size:clamp(2.8rem,5.6vw,4.8rem);line-height:1.04;letter-spacing:-.065em;font-weight:650;margin:0 0 22px}h1 em{font-family:Georgia,serif;font-weight:400;color:var(--green)}.intro{max-width:530px;color:var(--muted);font-size:1rem;margin:0}.heading-side{display:flex;flex-direction:column;align-items:end;gap:9px;font-size:.8rem;color:var(--muted);padding-bottom:5px}.location{font-weight:650;color:var(--ink)}button,select{font:inherit;border:1px solid var(--line);background:var(--paper);border-radius:8px;padding:10px 14px;color:var(--ink);cursor:pointer}button{margin-top:14px}button:hover{border-color:var(--green)}button:disabled{opacity:.5;cursor:wait}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid var(--green);outline-offset:4px}.status{font-size:.8rem;color:var(--muted);margin:30px 0 16px;padding-left:14px;border-left:3px solid var(--green)}.status.warning{border-color:var(--orange);color:#89502d}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:32px}.metric{border:1px solid var(--line);border-radius:14px;background:var(--paper);padding:23px;display:flex;flex-direction:column;min-height:188px}.metric.now{background:var(--mint);border-color:#c8dfc6}.label{font-size:.62rem;letter-spacing:.12em;font-weight:700;color:var(--muted)}.metric strong{font-size:clamp(1.7rem,2.5vw,2.4rem);letter-spacing:-.055em;font-weight:650;margin:17px 0 6px;font-variant-numeric:tabular-nums}.metric>span:last-of-type,.metric small{font-size:.75rem;color:var(--muted)}.metric small{margin-top:6px}.panel{background:var(--paper);border:1px solid var(--line);padding:28px;border-radius:16px;margin-bottom:24px}.section-head{display:flex;justify-content:space-between;align-items:center;gap:22px}.section-head .eyebrow{margin-bottom:7px}h2{font-size:1.65rem;letter-spacing:-.045em;font-weight:650;margin:0 0 5px}.section-head p:not(.eyebrow){font-size:.8rem;color:var(--muted);margin:0}.toggle{font-size:.75rem;display:flex;align-items:center;gap:7px;white-space:nowrap}.toggle input{accent-color:var(--green);width:16px;height:16px}.legend{display:flex;gap:22px;margin:24px 0 0;font-size:.7rem;color:var(--muted);flex-wrap:wrap}.legend span:before{content:"";display:inline-block;width:16px;height:3px;margin:0 7px 3px 0;background:var(--green)}.legend .day-key:before{background:#ced5cd}.legend .closed-key:before{background:#eef0e9;height:9px;margin-bottom:0}canvas{display:block;width:100%;height:255px;margin-top:16px}.profile-panel canvas{height:300px}.note{color:var(--muted);font-size:.73rem;margin:14px 0 0}.two-up{display:grid;grid-template-columns:1fr 1fr;gap:24px}.rankings{display:grid;grid-template-columns:1fr 1fr;gap:25px;border-top:1px solid var(--line);padding-top:13px}h3{font-size:.75rem;margin:0 0 8px}.rankings ol{margin:0;padding:0;list-style:none}.rankings li{display:flex;justify-content:space-between;gap:10px;font-size:.72rem;margin:7px 0;color:var(--muted)}.day-select{display:flex;align-items:center;gap:10px;font-size:.75rem;margin-top:22px}.day-select select{flex:1;min-width:0}.table-scroll{overflow-x:auto;margin-top:22px}table{border-collapse:collapse;width:100%;text-align:left;white-space:nowrap;font-size:.78rem}th{color:var(--muted);font-weight:500;font-size:.7rem;padding:0 18px 13px 0}td{padding:13px 18px 13px 0;border-top:1px solid var(--line);font-variant-numeric:tabular-nums}td:last-child{color:var(--muted);font-size:.7rem}footer{color:var(--muted);font-size:.72rem;padding-top:7px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px}footer p{width:100%;max-width:960px;line-height:1.8;margin:0 0 8px}footer a{text-decoration:underline;text-underline-offset:3px}noscript{padding:20px;text-align:center}@media(max-width:950px){.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.two-up{grid-template-columns:1fr}.heading-side{max-width:200px}.section-head{align-items:start}.metric{min-height:165px}}@media(max-width:600px){header{padding:18px 20px}nav{gap:14px;font-size:.75rem}main{padding:35px 20px 20px}.heading{display:block}.heading-side{align-items:start;max-width:none;margin-top:23px}.heading-side button{margin-top:4px}h1{font-size:3.1rem}.metrics{gap:10px}.metric{padding:17px;min-height:162px}.metric strong{font-size:1.75rem}.label{font-size:.55rem}.panel{padding:20px}.section-head{flex-direction:column;gap:15px}h2{font-size:1.5rem}.profile-panel canvas{height:260px}.legend{gap:10px}.two-up{gap:0}.status{margin-top:24px}.rankings{gap:15px}}`;

export const affluenzaScript = String.raw`
const $ = id => document.getElementById(id);
let data;
const percent = value => value == null ? '—' : value.toFixed(1) + '%';
const hourLabel = hour => String(hour).padStart(2, '0') + ':00–' + (hour === 23 ? '24' : String(hour + 1).padStart(2, '0')) + ':00';
const dateLabel = value => new Date(value + 'T12:00:00Z').toLocaleDateString('en-GB', { timeZone: 'Europe/Zurich', weekday: 'short', day: 'numeric', month: 'short' });
const timestamp = value => new Date(value).toLocaleString('en-GB', { timeZone: 'Europe/Zurich', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const palette = name => getComputedStyle(document.documentElement).getPropertyValue('--pixel-' + name).trim();
function chart(id, labels, series, bars = false, closed = false) {
  const canvas = $(id), rect = canvas.getBoundingClientRect();
  const ratio = devicePixelRatio || 1;
  canvas.width = rect.width * ratio; canvas.height = rect.height * ratio;
  const ctx = canvas.getContext('2d'); ctx.scale(ratio, ratio);
  const w = rect.width, h = rect.height, left = 36, right = 14, top = 12, bottom = 30;
  const width = w - left - right, height = h - top - bottom;
  const n = labels.length, dx = width / (bars ? n : Math.max(1, n - 1));
  const x = i => left + dx * (i + (bars ? 0.5 : 0));
  const y = v => top + height * (1 - v / 100);
  if (closed) { ctx.fillStyle = palette('soft'); ctx.fillRect(x(108), top, w - right - x(108), height); }
  ctx.font = '14px VT323, monospace'; ctx.textAlign = 'right'; ctx.lineWidth = 1;
  for (const value of [0, 25, 50, 75, 100]) { ctx.fillStyle = palette('muted'); ctx.fillText(String(value), left - 9, y(value) + 4); ctx.strokeStyle = palette('line'); ctx.beginPath(); ctx.moveTo(left, y(value)); ctx.lineTo(w - right, y(value)); ctx.stroke(); }
  const steps = bars ? (w < 400 ? 4 : 3) : 24;
  ctx.textAlign = 'center'; ctx.fillStyle = palette('muted');
  for (let i = 0; i < n; i += steps) ctx.fillText(labels[i], x(i), h - 8);
  if (!bars) { ctx.textAlign = 'right'; ctx.fillText('06:00', w - right, h - 8); }
  for (const s of series) {
    ctx.strokeStyle = s.color; ctx.fillStyle = s.color; ctx.lineWidth = s.width || 1.2;
    if (bars) { for (let i = 0; i < n; i++) if (s.values[i] != null) ctx.fillRect(x(i) - dx * .32, y(s.values[i]), dx * .64, height * s.values[i] / 100); }
    else { ctx.beginPath(); let pen = false; for (let i = 0; i < n; i++) { const v = s.values[i]; if (v == null) { pen = false; continue; } if (pen) ctx.lineTo(x(i), y(v)); else ctx.moveTo(x(i), y(v)); pen = true; } ctx.stroke();
      // Dots keep isolated readings visible without drawing across gaps.
      if (s.width > 2) for (let i = 0; i < n; i++) if (s.values[i] != null) { ctx.beginPath(); ctx.arc(x(i), y(s.values[i]), 2, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  if (!series.some(s => s.values.some(v => v != null))) { ctx.fillStyle = palette('muted'); ctx.textAlign = 'center'; ctx.fillText('No readings yet', left + width / 2, top + height / 2); }
}
window.addEventListener('app-theme-change', () => draw());
document.fonts.ready.then(() => draw());
function draw() {
  if (!data) return;
  const labels = data.profile.map(p => p.time);
  const series = $('overlay').checked ? data.daily.filter(d => d.mean != null).map(d => ({ values: d.profile, color: palette('line') })) : [];
  series.push({ values: data.profile.map(p => p.mean), color: palette('accent'), width: 3 });
  chart('profile', labels, series, false, true);
  chart('hours', data.hourly.filter(h => h.open).map(h => String(h.hour).padStart(2, '0')), [{ values: data.hourly.filter(h => h.open).map(h => h.mean), color: palette('accent') }], true);
  const day = data.daily.find(d => d.date === $('day').value);
  chart('trend', labels, [{ values: day?.profile || Array(144).fill(null), color: palette('accent'), width: 2.5 }], false, true);
  $('day-note').textContent = day ? dateLabel(day.date) + ' · Mean ' + percent(day.mean) + ' · ' + day.intervals + '/' + day.expectedIntervals + ' intervals · ' + (day.complete ? (day.partial ? 'Incomplete coverage' : 'Complete day') : 'Day in progress') : 'Choose an observed day.';
}
function list(id, hours) {
  $(id).replaceChildren();
  if (!hours.length) { const li = document.createElement('li'); li.textContent = 'No readings yet'; $(id).append(li); }
  for (const h of hours) { const li = document.createElement('li'), title = document.createElement('span'), value = document.createElement('span'); title.textContent = hourLabel(h.hour); value.textContent = percent(h.mean) + ' · ' + h.days + 'd'; li.append(title, value); $(id).append(li); }
}
function render() {
  $('current').textContent = percent(data.latest?.value);
  $('current-detail').textContent = data.latest ? data.latest.level + (data.stale ? ' · last known reading' : ' · visual gauge') : 'No readings received';
  $('latest-at').textContent = data.latest ? timestamp(data.latest.timestamp) + ' · Zurich' : '';
  $('mean').textContent = percent(data.mean);
  $('mean-detail').textContent = data.daysObserved + '/30 days observed · equal day weight';
  for (const [id, h] of [['best', data.best[0]], ['worst', data.worst[0]]]) {
    $(id).textContent = h ? hourLabel(h.hour) : '—';
    $(id + '-detail').textContent = h ? percent(h.mean) + ' mean · ' + h.days + ' day' + (h.days === 1 ? '' : 's') : 'Waiting for open-hours readings';
  }
  const warning = data.stale || data.daysObserved < 30 || data.lastCheck?.status === 'error';
  $('status').className = 'status' + (warning ? ' warning' : '');
  $('status').textContent = (data.stale ? 'Readings are stale. ' : '') + (data.lastCheck?.status === 'error' ? 'Latest collection attempt failed. ' : '') + data.daysObserved + ' of 30 days have data · ' + data.completeDays + ' complete days · ' + data.errors + ' failed checks. ' + (data.daysObserved < 30 ? 'Hourly rankings are provisional.' : 'Updated ' + timestamp(data.generatedAt) + '.');
  $('profile-note').textContent = 'Mean of each observed 10-minute slot across up to 30 days, including days with partial coverage. Gaps are left blank. ' + data.daysObserved + ' days currently contribute. The shaded interval is outside the published opening hours.';
  list('best-list', data.best); list('worst-list', data.worst);
  const selected = $('day').value;
  $('day').replaceChildren();
  const observed = data.daily.filter(d => d.mean != null).slice().reverse();
  for (const day of observed) { const option = document.createElement('option'); option.value = day.date; option.textContent = dateLabel(day.date) + (day.partial ? ' · partial' : ''); $('day').append(option); }
  if (!observed.length) { const option = document.createElement('option'); option.textContent = 'No recorded days'; $('day').append(option); }
  if (observed.some(d => d.date === selected)) $('day').value = selected;
  $('daily').replaceChildren();
  for (const day of data.daily.slice().reverse().filter(d => $('show-empty').checked || d.mean != null)) {
    const tr = document.createElement('tr');
    const coverage = day.intervals + '/' + day.expectedIntervals + ' (' + day.coveragePct + '%)';
    const status = !day.complete ? 'In progress' : day.mean == null ? 'No data' : day.partial ? 'Partial coverage' : 'Complete';
    for (const value of [dateLabel(day.date), percent(day.mean), percent(day.openMean), coverage, status]) { const td = document.createElement('td'); td.textContent = value; tr.append(td); }
    $('daily').append(tr);
  }
  $('missing-note').textContent = (30 - data.daysObserved) + ' days in this window have no readings. Missing days do not contribute to the averages.';
  draw();
}
async function refresh() {
  if ($('refresh').disabled) return;
  $('refresh').disabled = true;
  try {
    const response = await fetch('/api/personal/affluenza', { cache: 'no-store', signal: AbortSignal.timeout(20000) });
    if (response.status === 401) { location.replace('/personal/login'); return; }
    if (response.status === 403) throw new Error('This account has no access to the gym dashboard.');
    if (!response.ok) throw new Error('Gym readings are temporarily unavailable. Try Refresh shortly.');
    const result = await response.json();
    if (!Array.isArray(result.daily) || !Array.isArray(result.profile) || !Array.isArray(result.hourly)) throw new Error('The gym returned an invalid response.');
    data = result; render();
  } catch (error) { $('status').className = 'status warning'; $('status').textContent = (error.name === 'TimeoutError' ? 'The recorder did not respond in time.' : error.message) + (data ? ' Showing the last loaded snapshot.' : ''); }
  finally { $('refresh').disabled = false; }
}
$('refresh').addEventListener('click', refresh);
$('overlay').addEventListener('change', draw);
$('day').addEventListener('change', draw);
$('show-empty').addEventListener('change', render);
new ResizeObserver(draw).observe($('profile'));
setInterval(() => { if (!document.hidden) refresh(); }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
refresh();
`;
