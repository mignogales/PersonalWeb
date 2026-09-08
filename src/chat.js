const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
const reply = (body, status = 200) => Response.json(body, { status, headers });

export async function handleChat(request, env) {
  if (request.method !== "POST") return reply({ error: "Usa POST." }, 405);
  if (request.headers.get("Origin") !== new URL(request.url).origin) return reply({ error: "Origen no permitido." }, 403);
  if (!env.GEMINI_API_KEY || !env.CHAT_TEST_PASSWORD) return reply({ error: "La prueba todavía no está configurada en el servidor." }, 503);
  const supplied = request.headers.get("X-Chat-Password") || "";
  const digest = value => crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const [a, b] = await Promise.all([digest(supplied), digest(env.CHAT_TEST_PASSWORD)]);
  let difference = 0;
  const expected = new Uint8Array(b);
  new Uint8Array(a).forEach((byte, i) => { difference |= byte ^ expected[i]; });
  if (difference) return reply({ error: "Contraseña de prueba incorrecta." }, 401);
  if (!request.headers.get("Content-Type")?.startsWith("application/json")) return reply({ error: "Se requiere JSON." }, 415);
  // Bound the actual stream, rather than trusting Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return reply({ error: "Falta el mensaje." }, 400);
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 24000) { await reader.cancel(); return reply({ error: "Conversación demasiado larga. Inicia una nueva." }, 413); }
    chunks.push(value);
  }
  let messages;
  try {
    messages = JSON.parse(await new Blob(chunks).text()).messages;
  } catch { return reply({ error: "JSON inválido." }, 400); }
  if (!Array.isArray(messages) || !messages.length || messages.length > 15 ||
      messages.some((m, i) => !m || m.role !== (i % 2 ? "model" : "user") || typeof m.text !== "string" || !m.text.trim() || m.text.length > 2000) ||
      messages.at(-1).role !== "user") return reply({ error: "Conversación inválida (máximo 2000 caracteres por mensaje)." }, 400);
  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  if (!/^gemini-[a-z0-9.-]+$/.test(model)) return reply({ error: "Modelo mal configurado." }, 503);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "Eres un asistente experimental en la web de Miguel Nogales. Responde de forma breve y en el idioma del usuario. No tienes acceso a sus datos privados ni información verificada sobre él. No inventes información personal." }] },
        contents: messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
        generationConfig: { maxOutputTokens: 512, thinkingConfig: { thinkingBudget: 0 } }
      }),
      signal: AbortSignal.timeout(25000)
    });
    if (!response.ok) {
      if (response.status === 429) return reply({ error: "Se ha alcanzado la cuota de Gemini. Prueba más tarde." }, 429);
      if (response.status === 404) return reply({ error: "El modelo configurado no está disponible. Revisa GEMINI_MODEL." }, 503);
      return reply({ error: "Gemini no ha podido responder. Revisa la configuración del servidor." }, 502);
    }
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.filter(p => !p.thought).map(p => p.text || "").join("").trim();
    if (!text) return reply({ error: "Gemini no devolvió texto. Prueba con otra pregunta." }, 422);
    return reply({ text, model });
  } catch { return reply({ error: "No se pudo conectar con Gemini a tiempo. Inténtalo de nuevo." }, 504); }
}
