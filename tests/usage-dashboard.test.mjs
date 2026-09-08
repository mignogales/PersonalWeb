import assert from 'node:assert/strict';
import { handleDashboard } from '../src/dashboard.js';
const original = globalThis.fetch;
try {
 globalThis.fetch = async (url, options) => {
  if (url.endsWith('/health')) return Response.json({ok:true,service:'personalweb-pi'});
  assert.equal(url,'https://usage.miguelnogales.com/v1/summary');
  assert.equal(options.headers.Authorization,'Bearer secret-test');
  assert.equal(options.redirect,'manual');
  return Response.json({users:[],devices:[{stale:false},{stale:true},{revoked:1}],recorded_tokens:123,used_percent:23,token:'must-not-leak',overview:{accounts:[{name:'Miguel',used_percent:23,banked_resets:1}]},models:[{model:'model',total_tokens:123}]});
 };
 const req=new Request('https://example.com/api/dashboard/status');
 const result=await handleDashboard(req,{USAGE_HUB_TOKEN:'secret-test'});
 const data=await result.json();
 assert.equal(data.usage.usedPercent,23);assert.equal(data.usage.recordedTokens,123);
 assert.equal(data.usage.devices,2);assert.equal(data.usage.onlineDevices,1);
 assert.equal(JSON.stringify(data).includes('must-not-leak'),false);
 assert.equal(JSON.stringify(data).includes('secret-test'),false);
 globalThis.fetch=async()=>new Response('upstream secret',{status:403});
 const failed=await (await handleDashboard(req,{USAGE_HUB_TOKEN:'secret-test'})).json();
 assert.deepEqual(failed.usage,{state:'unavailable'});
 const missing=await (await handleDashboard(req,{})).json();
 assert.deepEqual(missing.usage,{state:'not_configured'});
 console.log('PASS: usage projection, server credential isolation, device counts, missing/failed upstream.');
} finally {globalThis.fetch=original;}
