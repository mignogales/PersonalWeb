// Called only after the personal-session gate. Credentials stay on the Worker.
export async function handleDashboard(request, env) {
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } });
  const usagePromise = fetchUsage(env);
  const started = Date.now();
  let pi;
  try {
    const base = env.ITALIAN_API_BASE || 'https://api.miguelnogales.com';
    const response = await fetch(`${base.replace(/\/$/, '')}/health`, {
      headers: { Accept: 'application/json' }, redirect: 'manual', signal: AbortSignal.timeout(5000),
    });
    const valid = response.ok && response.headers.get('Content-Type')?.includes('application/json');
    const payload = valid ? await response.json() : null;
    pi = { state: payload?.ok === true && payload?.service === 'personalweb-pi' ? 'reachable' : 'unavailable', latencyMs: Date.now() - started };
  } catch {
    pi = { state: 'unavailable', latencyMs: null };
  }
  return Response.json({ checkedAt: new Date().toISOString(), services: { worker: { state: 'reachable' }, pi }, usage: await usagePromise }, {
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

async function fetchUsage(env) {
  if (!env.USAGE_HUB_TOKEN) return { state: 'not_configured' };
  try {
    const result = await fetch('https://usage.miguelnogales.com/v1/summary', {
      headers: { Accept: 'application/json', Authorization: `Bearer ${env.USAGE_HUB_TOKEN}` },
      redirect: 'manual', signal: AbortSignal.timeout(5000),
    });
    if (!result.ok) throw new Error('Unavailable');
    const data = await result.json();
    if (!Array.isArray(data.users) || !Array.isArray(data.devices)) throw new Error('Invalid summary');
    const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
    const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
    return {
      state: 'ready', status: String(data.status || ''),
      usedPercent: number(data.used_percent), recordedTokens: number(data.recorded_tokens),
      periodStart: date(data.token_period_start), observedAt: date(data.end),
      reset: number(data.reset),
      accounts: (data.overview?.accounts || []).slice(0, 10).map(a => ({
        name: String(a.name).slice(0, 80), usedPercent: number(a.used_percent),
        status: String(a.status || ''), observedAt: date(a.observed_at), bankedResets: number(a.banked_resets),
      })),
      devices: data.devices.filter(d => !d.revoked).length,
      onlineDevices: data.devices.filter(d => !d.revoked && !d.stale).length,
      models: (data.models || []).slice(0, 20).map(m => ({ name: String(m.model).slice(0, 80), tokens: number(m.total_tokens) })),
    };
  } catch { return { state: 'unavailable' }; }
}
