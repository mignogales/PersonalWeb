export async function onRequestGet({ env }) {
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
