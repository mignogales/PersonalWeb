// Same-origin proxy: browsers never need a shared backend secret or CORS rules.
export async function handleCalories(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.slice("/calories".length);
  const methods = {
    "/api/health": "GET", "/api/me": "GET", "/api/logs": "GET", "/api/summary": "GET",
    "/api/users": "POST", "/api/login": "POST", "/api/password": "POST",
    "/api/settings": "POST", "/api/logs/text": "POST", "/api/logs/audio": "POST",
  };
  const method = methods[path] || (/^\/api\/logs\/food-items\/\d+$/.test(path) ? "PATCH" :
    /^\/api\/logs\/(food|weight)\/\d+$/.test(path) ? "DELETE" : null);
  const errorHeaders = { "Cache-Control": "no-store" };
  if (!method) return Response.json({ error: "Not found" }, { status: 404, headers: errorHeaders });
  if (request.method !== method) return new Response(null, { status: 405, headers: { ...errorHeaders, Allow: method } });
  if (Number(request.headers.get("Content-Length") || 0) > 20_000_000) {
    return Response.json({ error: "Request too large" }, { status: 413 });
  }
  const base = env.CALORIE_TRACKER_API_BASE || "https://api.miguelnogales.com";
  const headers = new Headers({ Accept: "application/json" });
  for (const name of ["X-Access-Token", "Content-Type"]) {
    if (request.headers.has(name)) headers.set(name, request.headers.get(name));
  }
  let upstreamStatus;
  try {
    let body;
    if (request.method !== "GET") {
      const reader = request.body?.getReader();
      const chunks = [];
      let size = 0;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 20_000_000) {
            await reader.cancel();
            return Response.json({ error: "Request too large" }, { status: 413 });
          }
          chunks.push(value);
        }
      }
      body = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    }
    const response = await fetch(`${base.replace(/\/$/, "")}/calories${path}${url.search}`, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(110000),
    });
    upstreamStatus = response.status;
    if (response.status >= 300 && response.status < 400) throw new Error("Unexpected upstream redirect");
    if (!response.headers.get("Content-Type")?.includes("application/json")) throw new Error("Invalid upstream response");
    return new Response(response.body, {
      status: response.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    const category = /redirect|abortsignal|timeout|dns|resolve|loop|internal error|unimplemented/i.exec(String(error?.message))?.[0]?.toLowerCase() || "fetch";
    return Response.json({ error: "The tracker is temporarily unavailable. Please try again shortly." }, {
      status: 503, headers: { "Cache-Control": "no-store", "X-Calorie-Upstream-Status": String(upstreamStatus || "network-error"), "X-Calorie-Error-Category": category },
    });
  }
}
