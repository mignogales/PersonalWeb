// The existing personal grant protects the page and the Pi checks it again.
export async function handleAffluenza(request) {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (request.method !== "GET") return Response.json({ error: "Method not allowed" }, { status: 405, headers });
  try {
    const response = await fetch("https://api.miguelnogales.com/affluenza/summary", {
      headers: { Cookie: request.headers.get("Cookie") || "", Accept: "application/json" },
      redirect: "manual", signal: AbortSignal.timeout(15000),
    });
    if (![200, 401, 403, 503].includes(response.status) || !response.headers.get("Content-Type")?.includes("application/json")) throw new Error("Unavailable");
    return new Response(response.body, { status: response.status, headers: { ...headers, "Content-Type": "application/json" } });
  } catch {
    return Response.json({ error: "The gym recorder is temporarily unavailable. Try again shortly." }, { status: 503, headers });
  }
}
