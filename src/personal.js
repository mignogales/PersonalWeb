import { handleDashboard } from './dashboard.js';
import { dashboardHtml, personalCss, dashboardScript } from './personal-views.js';

const SESSION_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();
const securityHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
};
const response = (body, status = 200, headers = {}) => new Response(body, { status, headers: { ...securityHeaders, ...headers } });
const redirect = (location, cookie) => response(null, 303, { Location: location, ...(cookie ? { 'Set-Cookie': cookie } : {}) });
const json = (body, status) => response(JSON.stringify(body), status, { 'Content-Type': 'application/json' });
const local = url => ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
const cookieName = url => url.protocol === 'https:' ? '__Host-personal_session' : 'personal_session_local';
const configured = env => typeof env.PERSONAL_PASSWORD === 'string' && env.PERSONAL_PASSWORD.length >= 20 &&
  typeof env.PERSONAL_SESSION_SECRET === 'string' && env.PERSONAL_SESSION_SECRET.length >= 32 &&
  !env.PERSONAL_PASSWORD.startsWith('replace-') && !env.PERSONAL_SESSION_SECRET.startsWith('replace-');

function cookie(url, value, age) {
  return `${cookieName(url)}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${url.protocol === 'https:' ? '; Secure' : ''}`;
}
const hex = bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
async function key(env) {
  // Password rotation also invalidates existing sessions; signing has a separate random secret.
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify([env.PERSONAL_SESSION_SECRET, env.PERSONAL_PASSWORD])));
  return crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function issueSession(env, origin) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const nonce = hex(crypto.getRandomValues(new Uint8Array(16)));
  const payload = `${expires}.${nonce}`;
  const signature = await crypto.subtle.sign('HMAC', await key(env), encoder.encode(`${origin}|${payload}`));
  return `${payload}.${hex(signature)}`;
}
async function signedIn(request, env) {
  if (!configured(env)) return false;
  const url = new URL(request.url);
  const value = (request.headers.get('Cookie') || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName(url)}=`))?.slice(cookieName(url).length + 1);
  if (!value || !/^\d{10}\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(value)) return false;
  const [expires, nonce, signature] = value.split('.');
  const now = Math.floor(Date.now() / 1000);
  if (Number(expires) <= now || Number(expires) > now + SESSION_SECONDS) return false;
  return crypto.subtle.verify('HMAC', await key(env), Uint8Array.from(signature.match(/../g), byte => parseInt(byte, 16)), encoder.encode(`${url.origin}|${expires}.${nonce}`));
}
async function matchesPassword(supplied, expected) {
  const [a, b] = await Promise.all([supplied, expected].map(value => crypto.subtle.digest('SHA-256', encoder.encode(value))));
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}
function loginPage(message = '', ready = true) {
  // Messages are fixed server strings, never reflected user input.
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Personal · Sign in</title><link rel="stylesheet" href="/personal/style.css"><link rel="icon" href="/assets/research/misc/favicon.png"></head><body><header class="topbar"><a class="brand" href="/"><span class="monogram">MN</span> Miguel Nogales</a></header><main class="login-main"><section class="login-card"><p class="eyebrow">Just for you</p><h1>Personal area<span>.</span></h1><p>Sign in to your private workspace.</p>${message ? `<p class="login-message" role="alert">${message}</p>` : ''}${ready ? '<form method="post" action="/personal/login"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256" autofocus><button type="submit">Unlock personal area</button></form><p class="login-message">This session expires after 8 hours.</p>' : ''}</section><a class="login-back" href="/">← Back to the public website</a></main></body></html>`;
}
const login = (message = '', status = 200, ready = true, extra = {}) => response(loginPage(message, ready), status, { 'Content-Type': 'text/html; charset=utf-8', ...extra });

export async function handlePersonal(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (url.protocol !== 'https:' && !local(url)) return response('HTTPS required', 403);
  if (path === '/personal/style.css' && ['GET', 'HEAD'].includes(request.method)) {
    return response(request.method === 'HEAD' ? null : personalCss, 200, { 'Content-Type': 'text/css; charset=utf-8' });
  }
  if (path === '/personal/logout') {
    if (request.method !== 'POST') return response('Use POST', 405, { Allow: 'POST' });
    if (request.headers.get('Origin') !== url.origin) return response('Invalid origin', 403);
    return redirect('/personal/login', cookie(url, '', 0));
  }
  if (path === '/personal/login') {
    if (request.method === 'GET' || request.method === 'HEAD') {
      if (await signedIn(request, env)) return redirect('/personal/dashboard');
      const page = configured(env) ? login() : login('The personal area is locked until its password is configured.', 503, false);
      return request.method === 'HEAD' ? new Response(null, page) : page;
    }
    if (request.method !== 'POST') return response('Use GET or POST', 405, { Allow: 'GET, HEAD, POST' });
    if (request.headers.get('Origin') !== url.origin) return response('Invalid origin', 403);
    if (!configured(env)) return login('The personal area is locked until its password is configured.', 503, false);
    // Missing/broken rate limiting fails closed, including local preview unless explicitly supplied.
    try {
      if (!env.PERSONAL_LOGIN_LIMITER) throw new Error('Missing limiter');
      const result = await env.PERSONAL_LOGIN_LIMITER.limit({ key: `personal:${request.headers.get('CF-Connecting-IP') || 'unknown'}` });
      if (!result.success) return login('Too many attempts. Wait a minute, then try again.', 429, true, { 'Retry-After': '60' });
    } catch { return login('Sign-in is temporarily unavailable. Please try again later.', 503, false); }
    if (!request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded')) return response('Expected a form', 415);
    const reader = request.body?.getReader();
    if (!reader) return login('Enter your password.', 400);
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); return response('Form too large', 413); }
      chunks.push(value);
    }
    const form = new URLSearchParams(await new Blob(chunks).text());
    const passwords = form.getAll('password');
    if (passwords.length !== 1 || passwords[0].length > 256 || !await matchesPassword(passwords[0], env.PERSONAL_PASSWORD)) return login('Incorrect password. Please try again.', 401);
    return redirect('/personal/dashboard', cookie(url, await issueSession(env, url.origin), SESSION_SECONDS));
  }
  // Every private page, asset and API route below this point shares the same gate.
  if (!await signedIn(request, env)) {
    return path.startsWith('/api/') ? json({ error: 'Sign in required' }, 401) : redirect('/personal/login');
  }
  if (path === '/api/personal/status' || path === '/api/dashboard/status') {
    const result = await handleDashboard(request, env);
    const headers = new Headers(result.headers);
    for (const [name, value] of Object.entries(securityHeaders)) headers.set(name, value);
    return new Response(result.body, { status: result.status, headers });
  }
  if (!['GET', 'HEAD'].includes(request.method)) return response('Use GET or HEAD', 405, { Allow: 'GET, HEAD' });
  if (['/personal', '/personal/', '/apps/dashboard', '/apps/dashboard/', '/apps/dashboard/index.html'].includes(path)) return redirect('/personal/dashboard');
  const pages = {
    '/personal/dashboard': [dashboardHtml, 'text/html'],
    '/personal/dashboard/': [dashboardHtml, 'text/html'],
    '/personal/dashboard.js': [dashboardScript, 'application/javascript'],
  };
  if (!pages[path]) return response('Not found', 404);
  const [body, type] = pages[path];
  return response(request.method === 'HEAD' ? null : body, 200, { 'Content-Type': `${type}; charset=utf-8` });
}
