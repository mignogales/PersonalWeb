import { readFile, writeFile, cp, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { rosaHtml, rosaCss, rosaScript } from '../../src/rosa-views.js';
const baseline = process.argv[2], stage = process.argv[3];
if (!baseline || !stage || baseline === stage) throw Error('Pass distinct retained baseline and new stage paths');
await cp(baseline, stage, { recursive: true, force: false, errorOnExist: true });
const original = await readFile(join(baseline, 'modules/worker.js'), 'utf8');
let bundle = original;
for (const [name, value, next] of [['rosaHtml', rosaHtml, 'var rosaCss = '], ['rosaCss', rosaCss, 'var rosaScript = '], ['rosaScript', rosaScript, '// Called only after the existing personal grant.']]) {
  const start = bundle.indexOf('var ' + name + ' = '), end = bundle.indexOf(next, start);
  if (start < 0 || end <= start) throw Error('Missing or ambiguous Rosa bundle boundary: ' + name);
  bundle = bundle.slice(0, start) + 'var ' + name + ' = ' + JSON.stringify(value) + ';\n' + bundle.slice(end);
}
const handlerStart = bundle.indexOf('// Called only after the existing personal grant.');
const handlerEnd = bundle.indexOf('// src/personal-sso.js', handlerStart);
if (handlerStart < 0 || handlerEnd <= handlerStart) throw Error('Missing Rosa proxy boundary');
const handler = (await readFile(new URL('../../src/rosa.js', import.meta.url), 'utf8')).replace('export async function', 'async function');
bundle = bundle.slice(0, handlerStart) + handler + '\n' + bundle.slice(handlerEnd);
await writeFile(join(stage, 'modules/worker.js'), bundle);
async function manifest(root, relative = '') {
  const result = {};
  for (const entry of await readdir(join(root, relative), { withFileTypes: true })) {
    const path = join(relative, entry.name);
    if (entry.isDirectory()) Object.assign(result, await manifest(root, path));
    else result[path] = createHash('sha256').update(await readFile(join(root, path))).digest('hex');
  }
  return result;
}
const [before, after] = await Promise.all([manifest(join(baseline, 'public')), manifest(join(stage, 'public'))]);
if (JSON.stringify(before) !== JSON.stringify(after)) throw Error('Public assets changed');
await writeFile(join(stage, 'rosa-update-audit.json'), JSON.stringify({ baseline, changed: ['modules/worker.js'], unchangedAssets: Object.keys(before).length, beforeModuleSha256: createHash('sha256').update(original).digest('hex'), afterModuleSha256: createHash('sha256').update(bundle).digest('hex'), published: false }, null, 2));
console.log('Staged Rosa view-only update; ' + Object.keys(before).length + ' public files unchanged.');
