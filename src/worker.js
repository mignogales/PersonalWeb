import { handleCalories } from "./calories.js";
import { handleOffice } from "./office.js";
import { handleItalian } from "./italian.js";
import { handleChat } from "./chat.js";
import { handlePersonalSSO } from "./personal-sso.js";
import { guardAppPage, sharedIdentity } from "./sso.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/personal" || url.pathname.startsWith("/personal/") ||
        url.pathname.startsWith("/api/personal/") || url.pathname.startsWith("/api/dashboard/") ||
        url.pathname === "/apps/dashboard" || url.pathname.startsWith("/apps/dashboard/")) {
      return handlePersonalSSO(request, env);
    }

    if (url.pathname.startsWith("/calories/api/")) return handleCalories(request, env);

    if (url.pathname.startsWith("/api/office/")) return handleOffice(request, env);

    if (url.pathname.startsWith("/api/italian/")) return handleItalian(request, env);

    if (url.pathname === "/api/chat") {
      const identity = await sharedIdentity(request);
      if (!identity) return Response.json({ error: "Sign in required" }, { status: 401 });
      if (!identity.apps.includes("chat")) return Response.json({ error: "No access to Chat Lab" }, { status: 403 });
      const headers = new Headers(request.headers);
      headers.set("X-Chat-Password", env.CHAT_TEST_PASSWORD || "");
      return handleChat(new Request(request, { headers }), env);
    }

    if (url.pathname === "/apps/office-scheduler/config.json") {
      return Response.json(
        {
          apiBase: env.OFFICE_SCHEDULER_API_BASE || ""
        },
        {
          headers: {
            "Cache-Control": "no-store"
          }
        }
      );
    }

    const staticApp = url.pathname.startsWith("/calories/") ? "calories" :
      url.pathname.startsWith("/italian/") ? "italian" :
      url.pathname.startsWith("/apps/chat-lab/") ? "chat" :
      url.pathname.startsWith("/apps/office-scheduler/") ? "office" : null;
    if (staticApp) {
      const denial = await guardAppPage(request, staticApp);
      if (denial) return denial;
    }

    return env.ASSETS.fetch(request);
  }
};
