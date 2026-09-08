import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleChat } from '../src/chat.js';
import worker from '../src/worker.js';
const env = { GEMINI_API_KEY: 'private-key', CHAT_TEST_PASSWORD: 'test-password' };
function request(body = { messages: [{ role: 'user', text: 'Hola' }] }, overrides = {}) {
  return new Request('https://example.com/api/chat', { method: 'POST', headers: { Origin: 'https://example.com', 'Content-Type': 'application/json', 'X-Chat-Password': 'test-password', ...overrides }, body: JSON.stringify(body) });
}
test('rejects missing secrets, wrong password and cross-origin requests', async () => {
  assert.equal((await handleChat(request(), {})).status, 503);
  assert.equal((await handleChat(request(undefined, { 'X-Chat-Password': 'wrong' }), env)).status, 401);
  assert.equal((await handleChat(request(undefined, { Origin: 'https://evil.test' }), env)).status, 403);
  assert.equal((await handleChat(new Request('https://example.com/api/chat'), env)).status, 405);
});
test('rejects invalid history and oversized actual bodies', async () => {
  for (const messages of [[], [{ role: 'model', text: 'test' }], [{ role: 'user', text: 'x'.repeat(2001) }], [null]]) {
    assert.equal((await handleChat(request({ messages }), env)).status, 400);
  }
  assert.equal((await handleChat(request({ messages: [], padding: 'x'.repeat(25000) }), env)).status, 413);
});
test('keeps key server-side, forwards bounded history and handles upstream failures', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.ok(!url.includes(env.GEMINI_API_KEY));
      assert.equal(options.headers['x-goog-api-key'], env.GEMINI_API_KEY);
      assert.equal(JSON.parse(options.body).contents[0].parts[0].text, 'Hola');
      assert.equal(JSON.parse(options.body).generationConfig.maxOutputTokens, 512);
      return Response.json({ candidates: [{ content: { parts: [{ text: 'Hola también' }] } }] });
    };
    const response = await worker.fetch(request(), env);
    assert.deepEqual(await response.json(), { text: 'Hola también', model: 'gemini-2.5-flash' });
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    for (const [upstream, expected] of [[429, 429], [404, 503], [403, 502]]) {
      globalThis.fetch = async () => new Response('private upstream detail', { status: upstream });
      const result = await handleChat(request(), env);
      assert.equal(result.status, expected);
      assert.ok(!(await result.text()).includes('private'));
    }
    globalThis.fetch = async () => Response.json({ candidates: [] });
    assert.equal((await handleChat(request(), env)).status, 422);
    globalThis.fetch = async () => { throw new Error('secret'); };
    assert.equal((await handleChat(request(), env)).status, 504);
  } finally { globalThis.fetch = original; }
});
test('preserves existing worker routes', async () => {
  const config = await worker.fetch(new Request('https://example.com/apps/office-scheduler/config.json'), { OFFICE_SCHEDULER_API_BASE: 'test' });
  assert.deepEqual(await config.json(), { apiBase: 'test' });
  const page = await worker.fetch(new Request('https://example.com/'), { ASSETS: { fetch: () => new Response('home') } });
  assert.equal(await page.text(), 'home');
});
