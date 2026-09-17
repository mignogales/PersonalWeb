import assert from "node:assert/strict";
import { test } from "node:test";
import { handlePersonalSSO } from "../src/personal-sso.js";

test("personal dashboard requires its own grant", async () => {
  const previous = globalThis.fetch;
  let apps = null;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/auth/session")) {
      return apps ? Response.json({ user: { id: "test", name: "alice" }, apps }) : Response.json({ error: "Sign in required" }, { status: 401 });
    }
    return Response.json({ ok: true, service: "personalweb-pi" });
  };
  try {
    const page = new Request("https://miguelnogales.com/personal/dashboard", { headers: { Cookie: "personalweb_session=test" } });
    assert.equal((await handlePersonalSSO(page, {})).status, 303);
    apps = ["italian"];
    assert.equal((await handlePersonalSSO(page, {})).status, 403);
    apps = ["personal"];
    const result = await handlePersonalSSO(page, {});
    assert.equal(result.status, 200);
    assert.match(await result.text(), /api\.miguelnogales\.com\/auth\/logout/);
    const status = await handlePersonalSSO(new Request("https://miguelnogales.com/api/personal/status", { headers: { Cookie: "personalweb_session=test" } }), {});
    assert.equal(status.status, 200);
  } finally {
    globalThis.fetch = previous;
  }
});
