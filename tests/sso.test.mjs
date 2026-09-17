import assert from "node:assert/strict";
import worker from "../src/worker.js";

const savedFetch = globalThis.fetch;
const env = { ASSETS: { fetch: async () => new Response("static asset", { status: 200 }) } };
let apps = null;
let lastProxy = null;
globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  if (url.endsWith("/auth/session")) {
    if (!apps) return Response.json({ error: "Sign in required" }, { status: 401 });
    assert.equal(init.headers.Cookie, "personalweb_session=synthetic");
    return Response.json({ user: { id: "test", name: "alice" }, apps });
  }
  lastProxy = { url, init };
  return Response.json({ ok: true });
};

try {
  const browser = (path) => new Request(`https://personal.miguelnogales.com${path}`, { headers: { Cookie: "personalweb_session=synthetic" } });
  const login = await worker.fetch(browser("/calories/"), env);
  assert.equal(login.status, 303);
  assert.equal(new URL(login.headers.get("Location")).searchParams.get("next"), "https://personal.miguelnogales.com/calories/");
  apps = ["italian"];
  assert.equal((await worker.fetch(browser("/calories/"), env)).status, 403);
  assert.equal((await worker.fetch(browser("/personal/dashboard"), env)).status, 403);
  assert.equal((await worker.fetch(browser("/italian/"), env)).status, 200);
  apps = ["calories"];
  const request = new Request("https://personal.miguelnogales.com/calories/api/me", {
    headers: { Cookie: "personalweb_session=synthetic", "X-Access-Token": "old-local-token", "X-Expected-User": "alice" },
  });
  assert.equal((await worker.fetch(request, env)).status, 200);
  assert.equal(lastProxy.url, "https://api.miguelnogales.com/calories/api/me");
  assert.equal(lastProxy.init.headers.get("Cookie"), "personalweb_session=synthetic");
  assert.equal(lastProxy.init.headers.get("X-Access-Token"), null);
  assert.equal(lastProxy.init.headers.get("X-Expected-User"), "alice");
  apps = ["personal"];
  assert.equal((await worker.fetch(browser("/personal/dashboard"), env)).status, 200);
  console.log("PASS: website page gates, personal grant, and cookie-only API forwarding");
} finally {
  globalThis.fetch = savedFetch;
}
