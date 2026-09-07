import { handleOffice } from "./office.js";
import { handleItalian } from "./italian.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/office/")) return handleOffice(request, env);

    if (url.pathname.startsWith("/api/italian/")) return handleItalian(request, env);

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
