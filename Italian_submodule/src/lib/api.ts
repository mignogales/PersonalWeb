const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? "";
const apiToken = import.meta.env.VITE_API_TOKEN?.trim() ?? "";

export const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, "");

export function isApiEnabled(): boolean {
  return API_BASE_URL.length > 0;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!isApiEnabled()) {
    throw new Error("API is not configured");
  }

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (apiToken) headers.set("Authorization", `Bearer ${apiToken}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
