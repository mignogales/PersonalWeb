import { handleDashboard } from "./dashboard.js";
import { dashboardHtml, personalCss, dashboardScript } from "./personal-views.js";
import { guardAppPage, loginRedirect } from "./sso.js";

const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self' https://api.miguelnogales.com; base-uri 'none'; frame-ancestors 'none'",
};

export async function handlePersonalSSO(request, env) {
  const path = new URL(request.url).pathname;
  if (path === "/personal/login") return loginRedirect(new Request(new URL("/personal/dashboard", request.url)));
  if (path === "/personal/style.css" && request.method === "GET") {
    return new Response(personalCss, { headers: { ...headers, "Content-Type": "text/css; charset=utf-8" } });
  }
  const denial = await guardAppPage(request, "personal");
  if (denial) return path.startsWith("/api/") ? Response.json({ error: "Sign in required" }, { status: denial.status === 403 ? 403 : 401, headers }) : denial;
  if (path === "/api/personal/status" || path === "/api/dashboard/status") {
    const result = await handleDashboard(request, env);
    return new Response(result.body, { status: result.status, headers: { ...Object.fromEntries(result.headers), ...headers } });
  }
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers });
  if (["/personal", "/personal/", "/apps/dashboard", "/apps/dashboard/", "/apps/dashboard/index.html"].includes(path)) return Response.redirect(new URL("/personal/dashboard", request.url), 303);
  const pages = {
    "/personal/dashboard": [dashboardHtml, "text/html"],
    "/personal/dashboard/": [dashboardHtml, "text/html"],
    "/personal/dashboard.js": [dashboardScript, "application/javascript"],
  };
  if (!pages[path]) return new Response("Not found", { status: 404, headers });
  const [body, type] = pages[path];
  return new Response(request.method === "HEAD" ? null : body, { headers: { ...headers, "Content-Type": `${type}; charset=utf-8` } });
}
