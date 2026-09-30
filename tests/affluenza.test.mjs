import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../src/worker.js";
import { affluenzaScript } from "../src/affluenza-views.js";

test("gym views and API use personal grant and fixed cookie-only upstream", async () => {
  const saved = globalThis.fetch;
  let apps = null, forwarded;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/auth/session")) return apps ? Response.json({ user: { id: "owner" }, apps }) : Response.json({}, { status: 401 });
    forwarded = { url, init };
    return Response.json({ daily: [], profile: [], hourly: [] });
  };
  const request = (path, method = "GET") => new Request("https://personal.miguelnogales.com" + path, { method, headers: { Cookie: "personalweb_session=synthetic", Authorization: "Bearer ignored" } });
  const env = { ASSETS: { fetch: () => { throw Error("Private page leaked to assets"); } } };
  try {
    assert.equal((await worker.fetch(request("/personal/affluenza"), env)).status, 303);
    assert.equal((await worker.fetch(request("/api/personal/affluenza"), env)).status, 401);
    apps = ["italian"];
    assert.equal((await worker.fetch(request("/personal/affluenza.js"), env)).status, 403);
    assert.equal((await worker.fetch(request("/api/personal/affluenza"), env)).status, 403);
    apps = ["personal"];
    const html = await worker.fetch(request("/personal/affluenza"), env);
    assert.equal(html.status, 200);
    assert.match(html.headers.get("Cache-Control"), /no-store/);
    assert.match(await html.text(), /Your mean day/);
    assert.equal((await worker.fetch(request("/api/personal/affluenza", "POST"), env)).status, 405);
    assert.equal((await worker.fetch(request("/api/personal/affluenza"), env)).status, 200);
    assert.equal(forwarded.url, "https://api.miguelnogales.com/affluenza/summary");
    assert.equal(forwarded.init.headers.Cookie, "personalweb_session=synthetic");
    assert.equal(forwarded.init.headers.Authorization, undefined);
    assert.equal(forwarded.init.redirect, "manual");
    new Function(affluenzaScript);
    globalThis.fetch = async url => String(url).endsWith("/auth/session") ? Response.json({ user: { id: "owner" }, apps }) : new Response("redirect", { status: 302 });
    assert.equal((await worker.fetch(request("/api/personal/affluenza"), env)).status, 503);
    globalThis.fetch = async url => String(url).endsWith("/auth/session") ? Response.json({ user: { id: "owner" }, apps }) : Response.json({ error: "No access" }, { status: 403 });
    assert.equal((await worker.fetch(request("/api/personal/affluenza"), env)).status, 403);
  } finally { globalThis.fetch = saved; }
});
