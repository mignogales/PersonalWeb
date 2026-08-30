export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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
