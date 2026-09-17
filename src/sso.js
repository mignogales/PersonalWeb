const base = "https://api.miguelnogales.com";

export async function sharedIdentity(request) {
  try {
    const response = await fetch(`${base}/auth/session`, {
      headers: { Cookie: request.headers.get("Cookie") || "" },
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok || !response.headers.get("Content-Type")?.includes("application/json")) return null;
    const data = await response.json();
    return data?.user?.id && Array.isArray(data.apps) ? data : null;
  } catch {
    return null;
  }
}

export function loginRedirect(request) {
  const next = new URL(request.url);
  return Response.redirect(`${base}/auth/login?next=${encodeURIComponent(next.href)}`, 303);
}

export async function guardAppPage(request, app) {
  const identity = await sharedIdentity(request);
  if (!identity) return loginRedirect(request);
  if (!identity.apps.includes(app)) return new Response("This account has no access to this app.", {
    status: 403,
    headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
  });
  return null;
}
