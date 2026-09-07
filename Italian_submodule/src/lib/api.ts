export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL?.trim() || "/api/italian").replace(/\/+$/, "");
const SESSION_KEY = "italian-sprint-session-v1";
export interface Session { token: string; user: { id: string; name: string; createdAt: string; lastSeenAt: string } }
export function getSession(): Session | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
}
export function setSession(session: Session | null) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}
export function isApiEnabled() { return true; }
export class ApiError extends Error {
  constructor(public status: number, public data: unknown, message: string) { super(message); }
}
export async function apiRequest<T>(path: string, init: RequestInit = {}, token = getSession()?.token): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init, headers, cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, data, data.error || `Sync unavailable (${response.status})`);
  return data as T;
}
