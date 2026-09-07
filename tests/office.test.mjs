import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleOffice } from '../src/office.js';

test('proxy restricts paths and methods', async () => {
  assert.equal((await handleOffice(new Request('https://example.com/api/office/register', {method:'POST'}), {})).status, 404);
  assert.equal((await handleOffice(new Request('https://example.com/api/office/schedule', {method:'DELETE'}), {})).status, 405);
});
test('proxy forwards authentication and date changes without caching', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://pi.example/office/schedule/me');
    assert.equal(options.headers.get('Authorization'), 'Bearer test');
    assert.deepEqual(JSON.parse(new TextDecoder().decode(options.body)), {changes:{'2026-09-08':true}});
    return Response.json({schedule:{dates:{}}});
  };
  try {
    const result = await handleOffice(new Request('https://example.com/api/office/schedule/me', {method:'PUT', headers:{Authorization:'Bearer test','Content-Type':'application/json'}, body:JSON.stringify({changes:{'2026-09-08':true}})}), {OFFICE_SCHEDULER_API_BASE:'https://pi.example'});
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('Cache-Control'), 'no-store');
  } finally {globalThis.fetch = original;}
});
test('unavailable Pi returns actionable failure', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {throw new Error('offline');};
  try {assert.equal((await handleOffice(new Request('https://example.com/api/office/schedule'), {})).status, 503);}
  finally {globalThis.fetch = original;}
});
