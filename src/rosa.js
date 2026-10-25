// Called only after the existing personal grant. The Pi checks it independently.
export async function handleRosa(request) {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (request.method !== "GET") return Response.json({ error: "Method not allowed" }, { status: 405, headers });
  try {
    const response = await fetch("https://api.miguelnogales.com/rosa/summary", {
      method: "GET",
      headers: { Cookie: request.headers.get("Cookie") || "", Accept: "application/json" },
      redirect: "manual", signal: AbortSignal.timeout(15000),
    });
    if (![200, 401, 403, 503].includes(response.status) || !response.headers.get("Content-Type")?.includes("application/json")) throw Error("Unavailable");
    return new Response(response.body, { status: response.status, headers: { ...headers, "Content-Type": "application/json" } });
  } catch {
    return Response.json({ state: "unavailable", snapshot: null, error: "Rosa monitoring is temporarily unavailable." }, { status: 503, headers });
  }
}
