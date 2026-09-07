import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from '../node_modules/typescript/lib/typescript.js';
import { readFile } from 'node:fs/promises';

const dir = await mkdtemp(join(tmpdir(), 'italian-sync-'));
try {
  for (const name of ['api', 'progress']) {
    const source = (await readFile(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8'))
      .replaceAll('import.meta.env', '({})').replaceAll('"./api"', '"./api.mjs"');
    await writeFile(join(dir, `${name}.mjs`), ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText);
  }
  const { mergeProgress, loadUserProgressRemote, loadUserProgress, saveUserProgress } = await import(join(dir, 'progress.mjs'));
  const { setSession } = await import(join(dir, 'api.mjs'));
  const empty = () => ({ forms: {}, currentStreak: 0, bestStreak: 0, practicedDays: [], attemptHistory: [] });
  const progress = (attempts) => ({ ...empty(), forms: { verb: { attempts, correct: attempts, lastPracticed: '2026-09-07T00:00:00Z', mastery: 50, streak: attempts, intervalDays: 1, dueAt: '2026-09-08T00:00:00Z' } } });
  const storage = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) }; };
  const a = storage(), b = storage();
  let server = { revision: 0, progress: empty() };
  const mutations = new Set();
  let loseResponse = false;
  let offline = false;
  let conflict = false;
  globalThis.fetch = async (_url, init) => {
    if (offline) throw new Error('Offline');
    if (init.method === 'PUT') {
      const body = JSON.parse(init.body);
      if (conflict) { conflict = false; server = { revision: server.revision + 1, progress: progress(server.progress.forms.verb.attempts + 1) }; }
      if (!mutations.has(body.mutationId)) {
        if (body.revision !== server.revision) return Response.json(server, { status: 409 });
        server = { revision: server.revision + 1, progress: body.progress };
        mutations.add(body.mutationId);
      }
      if (loseResponse) { loseResponse = false; throw new Error('Lost response'); }
    }
    return Response.json(server);
  };
  const select = device => {
    globalThis.localStorage = device;
    setSession({ token: 'test', user: { id: 'id1', name: 'Miguel' } });
  };
  assert.equal(mergeProgress(progress(5), progress(7), progress(8)).forms.verb.attempts, 10);
  select(a);
  saveUserProgress('Miguel', progress(5));
  await loadUserProgressRemote('Miguel');
  assert.equal(server.progress.forms.verb.attempts, 5, 'imports legacy local progress');
  select(b);
  await loadUserProgressRemote('Miguel');
  assert.equal(loadUserProgress('Miguel').forms.verb.attempts, 5, 'second device downloads progress');
  saveUserProgress('Miguel', progress(7));
  offline = true;
  await assert.rejects(loadUserProgressRemote('Miguel'));
  assert.equal(loadUserProgress('Miguel').forms.verb.attempts, 7, 'offline answers retained');
  offline = false;
  select(a);
  saveUserProgress('Miguel', progress(6));
  await loadUserProgressRemote('Miguel');
  select(b);
  await loadUserProgressRemote('Miguel');
  assert.equal(server.progress.forms.verb.attempts, 8, 'merges independent offline answers');
  saveUserProgress('Miguel', progress(9));
  loseResponse = true;
  await assert.rejects(loadUserProgressRemote('Miguel'));
  assert.equal(server.progress.forms.verb.attempts, 9);
  saveUserProgress('Miguel', progress(10));
  await loadUserProgressRemote('Miguel');
  assert.equal(server.progress.forms.verb.attempts, 10, 'lost response replay does not double-count');
  select(a);
  await loadUserProgressRemote('Miguel');
  assert.equal(loadUserProgress('Miguel').forms.verb.attempts, 10);
  saveUserProgress('Miguel', progress(11));
  conflict = true;
  await loadUserProgressRemote('Miguel');
  assert.equal(server.progress.forms.verb.attempts, 12, '409 conflict preserves both writes');
  console.log('PASS: legacy import, two devices, offline merge, lost-response replay, later edits, and refresh');
} finally { await rm(dir, { recursive: true, force: true }); }
