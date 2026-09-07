import assert from 'node:assert/strict';
import { handleItalian } from '../src/italian.js';

const original = globalThis.fetch;
try {
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.miguelnogales.com/italian/progress');
    assert.equal(init.redirect, 'manual');
    assert.equal(init.headers.get('Authorization'), 'Bearer synthetic-test');
    assert.equal(init.headers.get('Cookie'), null);
    return Response.json({ revision: 1, progress: {} });
  };
  const request = new Request('https://personal.miguelnogales.com/api/italian/progress', {
    headers: { Authorization: 'Bearer synthetic-test', Cookie: 'unrelated=private' },
  });
  const response = await handleItalian(request, {});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(calls, 1);
  assert.equal((await handleItalian(new Request('https://example.com/api/italian/not-allowed'), {})).status, 404);
  assert.equal(calls, 1);
  globalThis.fetch = async () => new Response('Redirect', { status: 302, headers: { Location: 'https://unrelated.example' } });
  const redirected = await handleItalian(request, {});
  assert.equal(redirected.status, 503);
  assert.equal(redirected.headers.get('Location'), null);
  assert.equal(redirected.headers.get('X-Italian-Upstream-Status'), '302');
  assert.equal(redirected.headers.get('X-Italian-Error-Category'), 'redirect');
  globalThis.fetch = async () => Response.json({ error: 'Unauthorized' }, { status: 401 });
  assert.equal((await handleItalian(request, {})).status, 401);
  console.log('PASS: proxy destination, authentication, cookie isolation, no-cache, route allowlist, redirect rejection, and 401 forwarding');
} finally { globalThis.fetch = original; }
