import type { UserProfile } from "../types";
import { apiRequest, getSession, setSession } from "./api";
import type { Session } from "./api";

const USERS_KEY = "italian-verb-sprint-users";
const ACTIVE_USER_KEY = "italian-verb-sprint-active-user";

export function normalizeUserName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function getUserKey(name: string): string {
  return normalizeUserName(name).toLocaleLowerCase();
}

export function loadUsers(): UserProfile[] {
  return [];
}

export function saveUsers(users: UserProfile[]) {
  // Account selection belongs to the shared sign-in.
}

export function loadActiveUser(): UserProfile | null {
  return getSession()?.user ?? null;
}

export function saveActiveUser(user: UserProfile | null) {
  if (user) {
    localStorage.setItem(ACTIVE_USER_KEY, getUserKey(user.name));
  } else {
    localStorage.removeItem(ACTIVE_USER_KEY);
  }
}

export function upsertUser(name: string): UserProfile {
  const cleanName = normalizeUserName(name);
  const key = getUserKey(cleanName);
  const users = loadUsers();
  const existing = users.find((user) => getUserKey(user.name) === key);
  const now = new Date().toISOString();

  if (existing) {
    const updated = { ...existing, name: cleanName, lastSeenAt: now };
    saveUsers(users.map((user) => (getUserKey(user.name) === key ? updated : user)));
    saveActiveUser(updated);
    return updated;
  }

  const created = { name: cleanName, createdAt: now, lastSeenAt: now };
  saveUsers([...users, created].sort((a, b) => a.name.localeCompare(b.name)));
  saveActiveUser(created);
  return created;
}

export async function upsertUserRemote(name: string, password: string, register: boolean): Promise<UserProfile> {
  const session = await apiRequest<Session>("/auth/me");
  setSession(session);
  saveActiveUser(session.user);
  return session.user;
}

export function logout() {
  setSession(null);
  saveActiveUser(null);
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "https://api.miguelnogales.com/auth/logout";
  document.body.append(form);
  form.submit();
}
