import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../src/worker.js';
import { rosaScript, nodeGpuJobs } from '../src/rosa-views.js';

test('GPU node users come only from active GPU jobs on that exact node', () => {
  const job = { state: 'RUNNING', gres: 'gres:gpu:1', reason: 'icsnode[05-06,08],icsnode42', user: 'nogalm' };
  const jobs = [job, { ...job, user: 'other' }, { ...job, state: 'PENDING', user: 'waiting' }, { ...job, gres: 'N/A', user: 'cpu-only' }];
  assert.deepEqual(nodeGpuJobs(jobs, 'icsnode05').map(j => j.user), ['nogalm', 'other']);
  assert.equal(nodeGpuJobs(jobs, 'icsnode07').length, 0);
  assert.equal(nodeGpuJobs(jobs, 'icsnode5').length, 0);
  assert.equal(nodeGpuJobs(jobs, 'icsnode42').length, 2);
  assert.equal(nodeGpuJobs([{ ...job, reason: '(Resources)' }], 'icsnode05').length, 0);
  assert.equal(nodeGpuJobs([{ ...job, reason: 'icsnode[0-99999999]' }], 'icsnode05').length, 0);
});

test('Rosa is private; viewer only reads the fixed upstream with the session cookie', async () => {
  const original = globalThis.fetch;
  let apps = null, forwarded;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith('/auth/session')) return apps ? Response.json({ user: { id: 'owner' }, apps }) : Response.json({}, { status: 401 });
    forwarded = { url, init };
    return Response.json({ state: 'unavailable', snapshot: null });
  };
  const request = (path, method = 'GET', origin = 'https://personal.miguelnogales.com') => new Request('https://personal.miguelnogales.com' + path, { method, headers: { Cookie: 'synthetic', Authorization: 'Bearer ignored', Origin: origin } });
  const env = { ASSETS: { fetch() { throw Error('Private content reached static assets'); } } };
  try {
    assert.equal((await worker.fetch(request('/personal/rosa'), env)).status, 303);
    assert.equal((await worker.fetch(request('/api/personal/rosa'), env)).status, 401);
    apps = ['italian'];
    assert.equal((await worker.fetch(request('/personal/rosa.js'), env)).status, 403);
    apps = ['personal'];
    const page = await worker.fetch(request('/personal/rosa'), env);
    assert.match(page.headers.get('Cache-Control'), /no-store/);
    assert.match(await page.text(), /Job queues/);
    assert.equal((await worker.fetch(request('/api/personal/rosa', 'POST', 'https://attacker.example'), env)).status, 405);
    assert.equal((await worker.fetch(request('/api/personal/rosa', 'POST'), env)).status, 405);
    assert.equal((await worker.fetch(request('/api/personal/rosa'), env)).status, 200);
    assert.equal(forwarded.url, 'https://api.miguelnogales.com/rosa/summary');
    assert.equal(forwarded.init.headers.Cookie, 'synthetic');
    assert.equal(forwarded.init.headers.Authorization, undefined);
    assert.equal(forwarded.init.redirect, 'manual');
    assert.equal((await worker.fetch(request('/api/personal/rosa', 'DELETE'), env)).status, 405);
    new Function(rosaScript);
  } finally { globalThis.fetch = original; }
});
