import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import worker from '../src/worker.js';
const base = 'https://example.com';
const env = { ASSETS: { fetch: async () => new Response('static frontend') } };

test('calorie frontend stays static while known API routes reach the Pi', async () => {
  assert.equal(await (await worker.fetch(new Request(base + '/calories/'), env)).text(), 'static frontend');
  const original = globalThis.fetch;
  let received;
  globalThis.fetch = async (url, options) => {
    received = { url, options };
    return Response.json({ logs: [] });
  };
  try {
    const response = await worker.fetch(new Request(base + '/calories/api/logs?limit=20', { headers: { 'X-Access-Token': 'synthetic-token', Cookie: 'private-cookie' } }), env);
    assert.equal(received.url, 'https://api.miguelnogales.com/calories/api/logs?limit=20');
    assert.equal(received.options.headers.get('X-Access-Token'), 'synthetic-token');
    assert.equal(received.options.headers.has('Cookie'), false);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await response.json(), { logs: [] });
  } finally { globalThis.fetch = original; }
});

test('binary audio, edits, and deletions preserve their methods and bodies', async () => {
  const original = globalThis.fetch;
  const bytes = new Uint8Array([0, 255, 13, 42]);
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/api/logs/audio')) {
      assert.equal(options.headers.get('Content-Type'), 'audio/mp4');
      assert.deepEqual(options.body, bytes);
      assert.equal(options.method, 'POST');
    } else if (url.endsWith('/food-items/12')) assert.equal(options.method, 'PATCH');
    else assert.equal(options.method, 'DELETE');
    return Response.json({ ok: true });
  };
  try {
    for (const [path, method, body, type] of [
      ['/logs/audio', 'POST', bytes, 'audio/mp4'],
      ['/logs/food-items/12', 'PATCH', '{"amount_g":100}', 'application/json'],
      ['/logs/weight/3', 'DELETE', undefined, 'application/json'],
    ]) {
      const r = await worker.fetch(new Request(base + '/calories/api' + path, { method, body, headers: { 'Content-Type': type } }), env);
      assert.equal(r.status, 200);
    }
  } finally { globalThis.fetch = original; }
});

test('invalid routes, methods, and oversized uploads never reach upstream', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Unexpected upstream call'); };
  try {
    assert.equal((await worker.fetch(new Request(base + '/calories/api/unknown'), env)).status, 404);
    assert.equal((await worker.fetch(new Request(base + '/calories/api/users'), env)).status, 405);
    assert.equal((await worker.fetch(new Request(base + '/calories/api/logs/audio', { method: 'POST', headers: { 'Content-Length': '20000001' } }), env)).status, 413);
    assert.equal((await worker.fetch(new Request(base + '/calories/api/logs/audio', { method: 'POST', body: new Uint8Array(20000001) }), env)).status, 413);
  } finally { globalThis.fetch = original; }
});

test('redirects and non-JSON upstream failures do not leak responses or tokens', async () => {
  const original = globalThis.fetch;
  try {
    for (const response of [new Response(null, { status: 302, headers: { Location: 'https://wrong.example' } }), new Response('private diagnostics')]) {
      globalThis.fetch = async () => response;
      const result = await worker.fetch(new Request(base + '/calories/api/health'), env);
      assert.equal(result.status, 503);
      assert.ok(!(await result.text()).includes('private diagnostics'));
    }
  } finally { globalThis.fetch = original; }
});

test('deployment keeps API ahead of assets and links both entry points', async () => {
  const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.ok(config.assets.run_worker_first.includes('/calories/api/*'));
  for (const path of ['../index.html', '../src/personal-views.js']) assert.match(await readFile(new URL(path, import.meta.url), 'utf8'), /href="\/calories\/"/);
  assert.match(await readFile(new URL('../calories/config.js', import.meta.url), 'utf8'), /apiBaseUrl: "\/calories"/);
});
