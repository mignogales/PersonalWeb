// Private views are bundled in the Worker, never published as static assets.
export const dashboardHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Miguel's personal dashboard for service availability, scheduled jobs, and everyday links.">
  <meta name="robots" content="noindex">
  <title>Personal · Dashboard · Miguel Nogales</title>
  <link rel="icon" href="/assets/research/misc/favicon.png">
  <link rel="stylesheet" href="/personal/style.css">
  <script src="/personal/dashboard.js" defer></script>
</head>
<body>
  <header class="topbar"><a href="/" class="brand"><span class="monogram">MN</span> Miguel Nogales</a><div class="personal-actions"><a href="/">Public website ↗</a><form method="post" action="/personal/logout"><button type="submit">Sign out</button></form></div></header>
  <main>
    <nav class="personal-nav" aria-label="Personal tools"><a href="/personal/dashboard" aria-current="page">Dashboard</a><span>Your private tools, together.</span></nav>
    <div class="heading"><div><p class="eyebrow">Personal area</p><h1>Dashboard<span>.</span></h1><p class="intro">Your services, schedules, and everyday shortcuts. Only after sign-in.</p></div><div class="date"><time id="today"></time><span>Europe / Zurich</span></div></div>
    <section class="status-section" aria-labelledby="services-title">
      <div class="section-heading"><div><span class="section-number">01</span><h2 id="services-title">Service status</h2></div><button id="refresh" type="button"><span aria-hidden="true">↻</span> Refresh</button></div>
      <p id="check-summary" class="check-summary" role="status">Checking service availability…</p>
      <div class="services">
        <article class="service"><div class="service-top"><span class="service-icon" aria-hidden="true">⌘</span><span class="badge" id="site-state">Loaded</span></div><h3>Personal website</h3><p>Dashboard frontend</p><div class="service-bottom"><span>Current browser session</span><span>HTML / CSS / JS</span></div></article>
        <article class="service"><div class="service-top"><span class="service-icon" aria-hidden="true">↔</span><span class="badge neutral" id="worker-state">Checking</span></div><h3>Cloudflare Worker</h3><p>Same-origin API gateway</p><div class="service-bottom"><span id="worker-detail">Waiting for response</span><span>API</span></div></article>
        <article class="service"><div class="service-top"><span class="service-icon" aria-hidden="true">▦</span><span class="badge neutral" id="pi-state">Checking</span></div><h3>Raspberry Pi</h3><p>Health endpoint · Italian sync host</p><div class="service-bottom"><span id="pi-detail">Waiting for response</span><span>Self-hosted</span></div></article>
      </div>
      <p class="footnote">Connectivity checks only; a reachable host does not verify every app or database. Refreshes every minute while this tab is visible.</p>
    </section>
    <section class="usage-section" aria-labelledby="usage-title">
      <div class="section-heading"><div><h2 id="usage-title">Token usage</h2></div></div>
      <p id="usage-status" class="check-summary" aria-live="polite">Loading usage…</p>
      <div class="services">
        <article class="service"><h3>Weekly allowance left</h3><strong class="usage-value" id="usage-remaining">—</strong><p id="usage-reset">Waiting for a snapshot</p></article>
        <article class="service"><h3>Recorded tokens</h3><strong class="usage-value" id="usage-tokens">—</strong><p id="usage-period">Current observed period</p></article>
        <article class="service"><h3>Connected devices</h3><strong class="usage-value" id="usage-devices">—</strong><p id="usage-online">Waiting for device reports</p></article>
      </div>
      <p class="footnote" id="usage-accounts"></p><p class="footnote" id="usage-models"></p>
      <p class="footnote">Token totals cover synced activity. Allowance is the latest account snapshot; these measure different things.</p>
    </section>
    <div class="lower-grid">
      <section class="jobs-section" aria-labelledby="jobs-title"><div class="section-heading"><div><span class="section-number">02</span><h2 id="jobs-title">Scheduled jobs</h2></div><span class="count">1 configured</span></div>
        <article class="job"><div class="job-heading"><span class="job-icon" aria-hidden="true">◷</span><div><h3>Italian progress backup</h3><p>Raspberry Pi · systemd timer</p></div></div><div class="schedule"><div><span class="label">Configured schedule</span><strong>Every day <span>at 00:00</span></strong><span class="muted">Raspberry Pi local timezone</span></div><span class="badge neutral">Unverified</span></div><dl><div><dt>Last run</dt><dd>Not connected</dd></div><div><dt>Next run</dt><dd>Awaiting timer status</dd></div><div><dt>Retention</dt><dd>7 days on the Pi</dd></div></dl><p class="job-note">Schedule from the project configuration. Live execution history is not connected yet.</p></article>
      </section>
      <section aria-labelledby="links-title"><div class="section-heading"><div><span class="section-number">03</span><h2 id="links-title">Useful links</h2></div></div><div class="links">
        <a href="/italian/"><span class="link-icon">It</span><span><strong>Italian Verb Sprint</strong><small>A little practice, every day</small></span><span class="arrow" aria-hidden="true">↗</span></a>
        <a href="/calories/"><span class="link-icon">kcal</span><span><strong>Calorie &amp; Weight Tracker</strong><small>Log meals and follow your progress</small></span><span class="arrow" aria-hidden="true">↗</span></a>
        <a href="/apps/office-scheduler/"><span class="link-icon">31</span><span><strong>Office Scheduler</strong><small>Plan your office days · in development</small></span><span class="arrow" aria-hidden="true">↗</span></a>
        <a href="/apps/chat-lab/"><span class="link-icon" aria-hidden="true">&gt;_</span><span><strong>Chat Lab</strong><small>Your AI chat workspace</small></span><span class="arrow" aria-hidden="true">↗</span></a>
        <a href="https://github.com/mignogales" target="_blank" rel="noopener noreferrer"><span class="link-icon">gh</span><span><strong>GitHub</strong><small>Repositories and experiments</small></span><span class="arrow" aria-hidden="true">↗</span></a>
        <a href="https://scholar.google.com/citations?hl=en&amp;user=fswn8KQAAAAJ" target="_blank" rel="noopener noreferrer"><span class="link-icon" aria-hidden="true">⌑</span><span><strong>Google Scholar</strong><small>Publications and citations</small></span><span class="arrow" aria-hidden="true">↗</span></a>
      </div></section>
    </div>
    <footer><span><span class="footer-dot" aria-hidden="true"></span> Personal area · More tools can be added here</span><span id="last-checked">No completed check yet</span></footer>
  </main>
  <noscript><p>Enable JavaScript to check live service status. Schedules and links remain available.</p></noscript>
</body>
</html>
`;

export const personalCss = `:root{color-scheme:light;--bg:#edf6fc;--panel:#fff;--text:#123047;--muted:#516b7e;--border:#d5e4ef;--accent:#087fbe;--good:#126c51;--good-bg:#e5f5ed;--bad:#a33135;--bad-bg:#fcebed;--neutral-bg:#edf2f7;--shadow:0 5px 24px #285d7e06}
@media(prefers-color-scheme:dark){:root{color-scheme:dark;--bg:#0a0e17;--panel:#101b2a;--text:#eef4ff;--muted:#afc1d4;--border:#293b4e;--accent:#8fc7ff;--good:#7cddb8;--good-bg:#15362e;--bad:#ffb2b6;--bad-bg:#412429;--neutral-bg:#223044}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:1rem/1.55 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:inherit;text-decoration:none}button{font:inherit}a:focus-visible,button:focus-visible{outline:3px solid var(--accent);outline-offset:5px}button:disabled{opacity:.6;cursor:wait}.topbar{min-height:84px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:20px;padding:18px max(6vw,24px);background:var(--panel)}.topbar>a:last-child{color:var(--muted);font-size:.875rem}.brand{display:flex;align-items:center;gap:12px;font-weight:650}.monogram{display:grid;place-items:center;background:var(--text);color:var(--panel);width:38px;height:38px;border-radius:8px;font-size:.875rem}main{max-width:1260px;padding:52px 32px 0;margin:auto}.heading{display:flex;align-items:center;justify-content:space-between;gap:24px;margin-bottom:44px}.eyebrow{color:var(--accent);text-transform:uppercase;letter-spacing:.16em;font-size:.75rem;font-weight:700;margin:0 0 6px}h1{font-size:clamp(2.5rem,5vw,3.5rem);letter-spacing:-.055em;line-height:1.15;margin:0 0 14px}h1 span{color:var(--accent)}.intro{color:var(--muted);margin:0}.date{display:grid;text-align:right;gap:5px;font-size:.875rem}.date span{color:var(--muted)}.section-heading,.section-heading>div{display:flex;align-items:center;gap:12px}.section-heading{justify-content:space-between;min-height:40px;margin-bottom:16px}h2{font-size:1.125rem;letter-spacing:-.025em;margin:0}.section-number{font: .75rem ui-monospace,monospace;color:var(--muted);border-bottom:1px solid var(--border);padding:5px 0}button{background:var(--panel);color:var(--text);border:1px solid var(--border);padding:7px 14px;border-radius:7px;font-size:.875rem;cursor:pointer}button:hover{border-color:var(--accent)}button span{font-size:1.1rem;margin-right:5px}.check-summary{color:var(--muted);font-size:.875rem;margin:0 0 16px}.services{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.service,.job,.links{border:1px solid var(--border);background:var(--panel);border-radius:12px;box-shadow:var(--shadow)}.service{padding:22px 24px}.service-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:23px;gap:10px}.service-icon{display:grid;place-items:center;width:38px;height:38px;border:1px solid var(--border);border-radius:8px;color:var(--accent);font-size:1.4rem}.badge{display:inline-flex;align-items:center;gap:6px;color:var(--good);background:var(--good-bg);border-radius:5px;padding:4px 9px;font-size:.875rem;font-weight:550;white-space:nowrap}.badge:before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}.neutral{background:var(--neutral-bg);color:var(--muted)}.bad{background:var(--bad-bg);color:var(--bad)}h3{margin:0 0 3px;font-size:1rem;font-weight:650;letter-spacing:-.02em}.service p,.job-heading p{font-size:.875rem;color:var(--muted);margin:0}.service-bottom{display:flex;justify-content:space-between;gap:10px;border-top:1px solid var(--border);padding-top:16px;margin-top:24px;color:var(--muted);font-size:.75rem;flex-wrap:wrap}.footnote{font-size:.75rem;color:var(--muted);margin:14px 0 0}.lower-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:28px;margin-top:40px}.count{font-size:.75rem;color:var(--muted)}.job{padding:26px}.job-heading{display:flex;gap:14px;align-items:center;margin-bottom:26px}.job-icon{font-size:1.7rem;color:var(--accent)}.schedule{display:flex;justify-content:space-between;align-items:center;gap:12px;border-block:1px solid var(--border);padding:22px 0}.schedule>div{display:grid;gap:4px}.label{font-size:.75rem;color:var(--muted)}.schedule strong{font-size:1.125rem;font-weight:650}.schedule strong span{font-weight:400}.muted{font-size:.875rem;color:var(--muted)}dl{margin:20px 0}dl>div{display:flex;justify-content:space-between;gap:16px;margin:12px 0;font-size:.875rem}dt{color:var(--muted)}dd{margin:0;text-align:right}.job-note{border-left:2px solid var(--accent);padding-left:12px;color:var(--muted);font-size:.875rem;margin:24px 0 0}.links{overflow:hidden}.links a{display:flex;align-items:center;gap:14px;padding:17px 22px;transition:background .15s}.links a+a{border-top:1px solid var(--border)}.links a:hover{background:var(--neutral-bg)}.link-icon{flex-shrink:0;display:grid;place-items:center;width:36px;height:36px;border-radius:8px;background:var(--neutral-bg);color:var(--accent);font:600 .875rem ui-monospace,monospace}.links strong{display:block;font-size:.875rem;font-weight:600}.links small{display:block;color:var(--muted);font-size:.875rem}.arrow{margin-left:auto;color:var(--muted)}footer{border-top:1px solid var(--border);padding:22px 0;margin-top:40px;display:flex;justify-content:space-between;gap:16px;font-size:.75rem;color:var(--muted)}.footer-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--accent);margin-right:7px}noscript p{padding:20px;text-align:center}
.usage-section{margin-top:36px}.usage-value{display:block;font-size:2rem;letter-spacing:-.04em;margin:12px 0}.usage-section .footnote{overflow-wrap:anywhere}
@media(max-width:900px){.services{gap:12px}.service{padding:18px}.lower-grid{gap:20px;grid-template-columns:1fr 1fr}.service-top{flex-wrap:wrap}}
@media(max-width:700px){main{padding:32px 20px 0}.topbar{padding:16px 20px;flex-wrap:wrap;min-height:72px}.heading{align-items:flex-start;margin-bottom:30px}.date{display:none}.services,.lower-grid{grid-template-columns:1fr}.service-top{margin-bottom:14px}.service-bottom{margin-top:18px}.lower-grid{margin-top:30px;gap:30px}.job{padding:22px}.schedule{flex-wrap:wrap}footer{flex-wrap:wrap}.topbar>a:last-child{font-size:.75rem}}

.personal-actions{display:flex;align-items:center;gap:20px;font-size:.875rem}.personal-actions form{margin:0}.personal-nav{display:flex;align-items:center;gap:24px;border-bottom:1px solid var(--border);margin:-16px 0 36px;padding-bottom:14px;font-size:.875rem}.personal-nav a{font-weight:650;color:var(--accent)}.personal-nav span{color:var(--muted)}.login-main{max-width:490px;padding-top:80px}.login-card{padding:32px;border:1px solid var(--border);border-radius:12px;background:var(--panel)}.login-card h1{font-size:2.4rem}.login-card p{color:var(--muted)}.login-card form{display:grid;gap:12px;margin-top:28px}.login-card label{font-size:.875rem;font-weight:600}.login-card input{width:100%;border:1px solid var(--border);border-radius:7px;background:var(--bg);color:var(--text);padding:12px;font:inherit}.login-card button{background:var(--accent);color:var(--panel);font-weight:650;padding:12px}.login-card input:focus-visible{outline:3px solid var(--accent);outline-offset:3px}.login-message{font-size:.875rem}.login-back{display:block;margin:22px 0;font-size:.875rem;color:var(--muted)}@media(max-width:500px){.personal-nav{flex-wrap:wrap;gap:8px 24px}.personal-actions{gap:12px}.login-main{padding-top:40px}.login-card{padding:24px}}
`;

export const dashboardScript = `const $ = (id) => document.getElementById(id);
const formatTime = (date) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date);
$('today').textContent = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
function state(id, text, kind = '') {
  $(id).textContent = text;
  $(id).className = \`badge \${kind}\`;
}
function renderUsage(usage) {
  for (const id of ['usage-remaining', 'usage-tokens', 'usage-devices']) $(id).textContent = '—';
  for (const id of ['usage-reset', 'usage-period', 'usage-online', 'usage-accounts', 'usage-models']) $(id).textContent = '';
  if (usage?.state !== 'ready') {
    $('usage-status').textContent = usage?.state === 'not_configured' ? 'Usage connection is not configured yet.' : 'Usage is temporarily unavailable. Try Refresh.';
    return;
  }
  const number = n => typeof n === 'number' && Number.isFinite(n);
  const fmt = n => new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  const date = v => new Date(v).toLocaleString('en-GB', { timeZone: 'Europe/Zurich' });
  const stale = !usage.observedAt || Date.now() - Date.parse(usage.observedAt) > 180000 || (usage.reset && usage.reset * 1000 <= Date.now());
  $('usage-status').textContent = usage.observedAt ? (stale ? 'Last known snapshot · ' : 'Updated · ') + date(usage.observedAt) + ' Zurich' : 'Waiting for an account snapshot.';
  $('usage-remaining').textContent = number(usage.usedPercent) ? Math.max(0, 100 - usage.usedPercent).toFixed(0) + '%' : '—';
  $('usage-reset').textContent = usage.reset ? 'Resets ' + date(usage.reset * 1000) : 'No reset time received';
  $('usage-tokens').textContent = number(usage.recordedTokens) ? fmt(usage.recordedTokens) : '—';
  $('usage-period').textContent = usage.periodStart ? 'Since ' + date(usage.periodStart) : 'Current observed period';
  $('usage-devices').textContent = String(usage.devices);
  $('usage-online').textContent = usage.onlineDevices + ' reporting in the last 3 minutes';
  $('usage-accounts').textContent = (usage.accounts || []).map(a => a.name + ': ' + (number(a.usedPercent) ? a.usedPercent + '% used' : 'waiting for data') + (number(a.bankedResets) ? ' · ' + a.bankedResets + ' banked resets' : '')).join(' / ');
  $('usage-models').textContent = (usage.models || []).map(m => m.name + ': ' + (number(m.tokens) ? fmt(m.tokens) : '—') + ' tokens').join(' / ');
}
async function refresh() {
  if ($('refresh').disabled) return;
  $('refresh').disabled = true;
  $('check-summary').textContent = 'Checking service availability…';
  state('worker-state', 'Checking', 'neutral');
  state('pi-state', 'Checking', 'neutral');
  try {
    const response = await fetch('/api/personal/status', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (response.status === 401) { location.replace('/personal/login'); return; }
    if (!response.ok) throw new Error('Status unavailable');
    const data = await response.json();
    if (data.services?.worker?.state !== 'reachable' || !['reachable', 'unavailable'].includes(data.services?.pi?.state) || !Number.isFinite(Date.parse(data.checkedAt))) throw new Error('Invalid status');
    renderUsage(data.usage);
    state('worker-state', 'Reachable');
    $('worker-detail').textContent = 'Status endpoint responded';
    const pi = data.services.pi;
    state('pi-state', pi.state === 'reachable' ? 'Reachable' : 'Unavailable', pi.state === 'reachable' ? '' : 'bad');
    $('pi-detail').textContent = pi.state === 'reachable' ? \`Health check · \${pi.latencyMs} ms\` : 'Health check did not pass';
    $('check-summary').textContent = pi.state === 'reachable' ? 'Both service checks passed.' : 'The Raspberry Pi health check needs attention.';
    $('last-checked').textContent = \`Last checked \${formatTime(new Date(data.checkedAt))} · Zurich\`;
  } catch {
    renderUsage(null);
    state('worker-state', 'Unknown', 'neutral');
    state('pi-state', 'Unknown', 'neutral');
    $('worker-detail').textContent = 'No valid status response';
    $('pi-detail').textContent = 'Cannot verify from this session';
    $('check-summary').textContent = 'Status could not be retrieved. Check your connection and try Refresh.';
    $('last-checked').textContent = \`Check failed \${formatTime(new Date())} · Zurich\`;
  } finally { $('refresh').disabled = false; }
}
$('refresh').addEventListener('click', refresh);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
setInterval(() => { if (!document.hidden) refresh(); }, 60000);
refresh();

window.addEventListener('pageshow', (event) => { if (event.persisted) location.reload(); });
`;