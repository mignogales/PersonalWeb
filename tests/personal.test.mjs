import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, access } from 'node:fs/promises';
import worker from '../src/worker.js';
const origin = 'https://example.com';
const env = {
  PERSONAL_PASSWORD: 'synthetic-password-for-tests-only',
  PERSONAL_SESSION_SECRET: 'synthetic-signing-key-for-tests-only-123456789',
  PERSONAL_LOGIN_LIMITER: { limit: async () => ({ success: true }) },
  ASSETS: { fetch: async () => new Response('public asset') },
};
const get = (path, cookie, base = origin) => new Request(base + path, { headers: cookie ? { Cookie: cookie } : {} });
const post = (path, body, headers = {}) => new Request(origin + path, { method:'POST', headers: { Origin:origin, 'Content-Type':'application/x-www-form-urlencoded', ...headers }, body });
const signIn = async (configuration = env) => {
  const result = await worker.fetch(post('/personal/login', new URLSearchParams({ password:env.PERSONAL_PASSWORD })), configuration);
  assert.equal(result.status, 303);
  return result.headers.get('Set-Cookie');
};
test('all private routes deny anonymous access without fetching status or static content', async () => {
  const configuration = { ...env, ASSETS: { fetch() { throw new Error('private request fell through'); } } };
  for (const path of ['/personal', '/personal/', '/personal/dashboard', '/personal/dashboard/', '/personal/dashboard.js', '/personal/future-tool', '/apps/dashboard/', '/apps/dashboard/index.html', '/apps/dashboard/dashboard.js']) {
    const result = await worker.fetch(get(path), configuration);
    assert.equal(result.status, 303, path);
    assert.equal(result.headers.get('Location'), '/personal/login');
    assert.equal(await result.text(), '');
    assert.match(result.headers.get('Cache-Control'), /no-store/);
  }
  for (const path of ['/api/personal/status', '/api/dashboard/status', '/api/personal/future']) assert.equal((await worker.fetch(get(path), configuration)).status, 401);
});
test('missing configuration, invalid credentials and cross-site requests cannot authenticate', async () => {
  assert.equal((await worker.fetch(get('/personal/login'), {})).status, 503);
  assert.equal((await worker.fetch(post('/personal/login', 'password=wrong'), env)).status, 401);
  assert.equal((await worker.fetch(post('/personal/login', 'password=wrong', { Origin:'https://evil.example' }), env)).status, 403);
  assert.equal((await worker.fetch(post('/personal/login', 'password=wrong', { Origin:'' }), env)).status, 403);
  assert.equal((await worker.fetch(post('/personal/login', 'password=x'.repeat(500)), env)).status, 413);
  assert.equal((await worker.fetch(post('/personal/login', 'password=x&password=y'), env)).status, 401);
  assert.equal((await worker.fetch(post('/personal/login', 'password=x', {'Content-Type':'application/json'}), env)).status, 415);
  assert.equal((await worker.fetch(get('/personal/dashboard', null, 'http://public.example'), env)).status, 403);
});
test('rate limiting denies excess attempts and fails closed when unavailable', async () => {
  let observed;
  const limited = { ...env, PERSONAL_LOGIN_LIMITER: { limit: async ({key}) => {observed=key; return {success:false};} } };
  const result = await worker.fetch(post('/personal/login', 'password=x', {'CF-Connecting-IP':'192.0.2.1'}), limited);
  assert.equal(result.status, 429);
  assert.equal(observed, 'personal:192.0.2.1');
  assert.equal(result.headers.get('Retry-After'), '60');
  for (const limiter of [undefined, {limit: async () => { throw new Error('unavailable'); }}]) assert.equal((await worker.fetch(post('/personal/login', 'password=x'), {...env, PERSONAL_LOGIN_LIMITER:limiter})).status, 503);
});
test('valid sessions open dashboard and API; cookies, expiry, origin binding and rotation protect access', async () => {
  const setCookie = await signIn();
  for (const flag of ['__Host-personal_session=', 'HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', 'Max-Age=28800']) assert.ok(setCookie.includes(flag));
  const session = setCookie.split(';')[0];
  const page = await worker.fetch(get('/personal/dashboard', session), env);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Sign out/);
  assert.match(page.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
  const script = await worker.fetch(get('/personal/dashboard.js', session), env);
  assert.equal(script.status, 200);
  assert.equal((await worker.fetch(get('/personal/future', session), env)).status, 404);
  assert.equal((await worker.fetch(get('/personal/dashboard', session, 'https://another.example'), env)).status, 303);
  assert.equal((await worker.fetch(get('/personal/dashboard', session), {...env, PERSONAL_PASSWORD:'new-password-for-testing-only'})).status, 303);
  assert.equal((await worker.fetch(get('/personal/dashboard', session), {...env, PERSONAL_SESSION_SECRET:'different-signing-key-for-testing-only'})).status, 303);
  for (const invalid of [session.slice(0,-1) + (session.endsWith('a') ? 'b' : 'a'), '__Host-personal_session=bad', session.replace(/=\d+\./, '=1000000000.')]) assert.equal((await worker.fetch(get('/personal/dashboard', invalid), env)).status, 303);
  const originalNow = Date.now;
  try { Date.now = () => originalNow() + 28801000; assert.equal((await worker.fetch(get('/personal/dashboard', session), env)).status, 303); } finally { Date.now = originalNow; }
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ok:true,service:'personalweb-pi'});
    for (const path of ['/api/personal/status', '/api/dashboard/status']) {
      const result = await worker.fetch(get(path, session), env);
      assert.equal(result.status, 200);
      assert.equal((await result.json()).services.pi.state, 'reachable');
      assert.match(result.headers.get('Cache-Control'), /private, no-store/);
    }
  } finally { globalThis.fetch = originalFetch; }
});
test('logout requires same-origin POST and expires browser cookie', async () => {
  assert.equal((await worker.fetch(get('/personal/logout'), env)).status, 405);
  assert.equal((await worker.fetch(post('/personal/logout', '', { Origin:'https://evil.example' }), env)).status, 403);
  const result = await worker.fetch(post('/personal/logout', ''), env);
  assert.equal(result.status, 303);
  assert.match(result.headers.get('Set-Cookie'), /Max-Age=0/);
  assert.equal((await worker.fetch(get('/personal/dashboard'), env)).status, 303);
});
test('public homepage stays public; dashboard content is excluded from static assets', async () => {
  assert.equal(await (await worker.fetch(get('/'), env)).text(), 'public asset');
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(!index.includes('apps/dashboard'));
  assert.ok(!index.includes('Personal Dashboard'));
  await assert.rejects(access(new URL('../apps/dashboard/index.html', import.meta.url)));
  const ignore = await readFile(new URL('../.assetsignore', import.meta.url), 'utf8');
  assert.ok(ignore.includes('src/**'));
  const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.ok(config.assets.run_worker_first.includes('/personal/*'));
  assert.ok(config.assets.run_worker_first.includes('/api/*'));
  assert.equal(config.ratelimits[0].name,'PERSONAL_LOGIN_LIMITER');
});
