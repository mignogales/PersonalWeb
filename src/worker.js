import { handleCalories } from "./calories.js";
import { handleOffice } from "./office.js";
import { handleItalian } from "./italian.js";
import { handleChat } from "./chat.js";
import { handlePersonal } from "./personal.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/personal" || url.pathname.startsWith("/personal/") ||
        url.pathname.startsWith("/api/personal/") || url.pathname.startsWith("/api/dashboard/") ||
        url.pathname === "/apps/dashboard" || url.pathname.startsWith("/apps/dashboard/")) {
      return handlePersonal(request, env);
    }

    if (url.pathname.startsWith("/calories/api/")) return handleCalories(request, env);

    if (url.pathname.startsWith("/api/office/")) return handleOffice(request, env);

    if (url.pathname.startsWith("/api/italian/")) return handleItalian(request, env);

    if (url.pathname === "/api/chat") return handleChat(request, env);

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

    return env.ASSETS.fetch(request);
  }
};
