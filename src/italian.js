// Same-origin proxy: browsers never need a shared backend secret or CORS rules.
export async function handleItalian(request, env) {
  const url = new URL(request.url);
  const routes = new Set(["/auth/login", "/auth/register", "/auth/logout", "/progress"]);
  const path = url.pathname.slice("/api/italian".length);
  if (!routes.has(path)) return Response.json({ error: "Not found" }, { status: 404 });
  if (!["GET", "POST", "PUT"].includes(request.method)) return new Response(null, { status: 405 });
  if (Number(request.headers.get("Content-Length") || 0) > 4_000_000) {
    return Response.json({ error: "Request too large" }, { status: 413 });
  }
  const base = env.ITALIAN_API_BASE || "https://api.miguelnogales.com";
  const headers = new Headers({ Accept: "application/json" });
  for (const name of ["Authorization", "Content-Type"]) {
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
          if (size > 4_000_000) {
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
    const response = await fetch(`${base}/italian${path}`, {
      method: request.method,
      headers,
      body,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    upstreamStatus = response.status;
    if (!response.headers.get("Content-Type")?.includes("application/json")) throw new Error("Invalid upstream response");
    return new Response(response.body, {
      status: response.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    const category = /redirect|abortsignal|timeout|dns|resolve|loop|internal error|unimplemented/i.exec(String(error?.message))?.[0]?.toLowerCase() || "fetch";
    return Response.json({ error: "Sync is temporarily unavailable. Your progress stays on this device." }, {
      status: 503, headers: { "Cache-Control": "no-store", "X-Italian-Upstream-Status": String(upstreamStatus || "network-error"), "X-Italian-Error-Category": category },
    });
  }
}
