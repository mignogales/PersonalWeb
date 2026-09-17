export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL?.trim() || "/api/italian").replace(/\/+$/, "");
export interface Session { token: string; user: { id: string; name: string; createdAt: string; lastSeenAt: string } }
let currentSession: Session | null = null;
export function getSession(): Session | null {
  return currentSession;
}
export function setSession(session: Session | null) {
  currentSession = session;
  localStorage.removeItem("italian-sprint-session-v1");
}
export function isApiEnabled() { return true; }
export class ApiError extends Error {
  constructor(public status: number, public data: unknown, message: string) { super(message); }
}
export async function apiRequest<T>(path: string, init: RequestInit = {}, token = getSession()?.token): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (getSession()?.user.name && path !== "/auth/me") headers.set("X-Expected-User", getSession()!.user.name);
  // The same-origin Worker forwards the shared HttpOnly cookie to the Pi.
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init, headers, cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 409) location.reload();
  if (!response.ok) throw new ApiError(response.status, data, data.error || `Sync unavailable (${response.status})`);
  return data as T;
}
