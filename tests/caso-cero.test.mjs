import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import worker from '../src/worker.js';

const root = new URL('../', import.meta.url);
const app = new URL('apps/caso-cero/', root);
const home = await readFile(new URL('index.html', root), 'utf8');
assert(home.includes('href="/apps/caso-cero/" aria-label="Play Caso Cero"'));
assert.equal(home.split('aria-label="Play Caso Cero"').length, 2);
const html = await readFile(new URL('index.html', app), 'utf8');
assert(html.includes('<title>Caso Cero'));
const assets = [...html.matchAll(/(?:src|href)="(\/apps\/caso-cero\/[^"?#]+)"/g)].map(match => match[1]);
assert(assets.some(path => path.endsWith('.js')));
assert(assets.some(path => path.endsWith('.css')));
for (const path of assets) {
  const file = new URL(path.slice(1), root);
  assert((await stat(file)).size > 0, `Missing ${path}`);
}
const icons = await readdir(new URL('icons/objects/', app));
assert.equal(icons.filter(name => name.endsWith('.svg')).length, 10);
const scriptPath = assets.find(path => path.endsWith('.js'));
const bundle = await readFile(new URL(scriptPath.slice(1), root), 'utf8');
assert(bundle.includes('/apps/caso-cero'));
assert(!html.includes('localhost'));
const request = new Request('https://personal.miguelnogales.com/apps/caso-cero/');
let forwarded;
const response = await worker.fetch(request, { ASSETS: { fetch: async req => {
  forwarded = req;
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
} } });
assert.equal(forwarded, request, 'Game must use static assets without a backend');
assert.equal(response.status, 200);
console.log('PASS: Caso Cero homepage link, static entry, hashed assets, all furniture icons, and Worker asset routing.', fileURLToPath(app));
