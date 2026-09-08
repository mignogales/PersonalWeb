import assert from 'node:assert/strict';
import { dashboardScript } from '../src/personal-views.js';
import vm from 'node:vm';
import { handleDashboard } from '../src/dashboard.js';
import worker from '../src/worker.js';
const originalFetch = globalThis.fetch;
const request = new Request('https://example.com/api/dashboard/status', { headers: {Cookie: 'private', Authorization: 'Bearer private'} });
try {
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, 'https://backend.example/health');
    assert.equal(options.redirect, 'manual');
    assert.deepEqual(options.headers, { Accept: 'application/json' });
    return Response.json({ ok: true, service: 'personalweb-pi', secret: 'never-forward' });
  };
  const response = await handleDashboard(request, { ITALIAN_API_BASE: 'https://backend.example/' });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const data = await response.json();
  assert.equal(data.services.pi.state, 'reachable');
  assert.equal(JSON.stringify(data).includes('never-forward'), false);
  assert.equal((await handleDashboard(new Request(request, { method: 'POST' }), {})).status, 405);
  assert.equal(calls, 1);
  for (const result of [new Response('', { status: 302 }), new Response('down', { status: 503 }), new Response('<html>login</html>'), Response.json({ ok: true, service: 'wrong' }), new Response('{', { headers: { 'Content-Type': 'application/json' } })]) {
    globalThis.fetch = async () => result;
    assert.equal((await (await handleDashboard(request, {})).json()).services.pi.state, 'unavailable');
  }
  globalThis.fetch = async () => { throw new Error('network failure'); };
  assert.equal((await (await handleDashboard(request, {})).json()).services.pi.state, 'unavailable');
} finally { globalThis.fetch = originalFetch; }
const code = dashboardScript;
const elements = new Map();
const element = id => { if (!elements.has(id)) elements.set(id, { textContent: '', disabled: false, addEventListener() {} }); return elements.get(id); };
let payload = { checkedAt: new Date().toISOString(), services: { worker: {state:'reachable'}, pi:{state:'reachable',latencyMs:12} } };
const context = vm.createContext({ window: { addEventListener() {} }, document: { getElementById: element, addEventListener() {}, hidden:false }, Intl, Date, AbortSignal, setInterval() {}, fetch: async () => Response.json(payload) });
vm.runInContext(code, context);
await new Promise(resolve => setImmediate(resolve));
assert.equal(element('pi-state').textContent, 'Reachable');
payload.services.pi.state = 'unavailable';
await vm.runInContext('refresh()', context);
assert.equal(element('pi-state').textContent, 'Unavailable');
payload = {bad:true};
await vm.runInContext('refresh()', context);
assert.equal(element('pi-state').textContent, 'Unknown');
assert.equal(element('worker-state').textContent, 'Unknown');
assert.equal(element('refresh').disabled, false);
console.log('PASS: routing, health validation, credential isolation, no-cache, failure states, refresh recovery');
