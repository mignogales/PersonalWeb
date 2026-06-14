import type { UserProfile } from "../types";
import { apiRequest, isApiEnabled } from "./api";

const USERS_KEY = "italian-verb-sprint-users";
const ACTIVE_USER_KEY = "italian-verb-sprint-active-user";

export function normalizeUserName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function getUserKey(name: string): string {
  return normalizeUserName(name).toLocaleLowerCase();
}

export function loadUsers(): UserProfile[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveUsers(users: UserProfile[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function loadActiveUser(): UserProfile | null {
  const activeKey = localStorage.getItem(ACTIVE_USER_KEY);
  if (!activeKey) return null;
  return loadUsers().find((user) => getUserKey(user.name) === activeKey) ?? null;
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

export async function loadUsersRemote(): Promise<UserProfile[]> {
  if (!isApiEnabled()) return loadUsers();

  try {
    const users = await apiRequest<UserProfile[]>("/api/users");
    saveUsers(users);
    return users;
  } catch {
    return loadUsers();
  }
}

export async function upsertUserRemote(name: string): Promise<UserProfile> {
  const local = upsertUser(name);
  if (!isApiEnabled()) return local;

  try {
    const remote = await apiRequest<UserProfile>("/api/users", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    const merged = mergeUsers(loadUsers(), remote);
    saveUsers(merged);
    saveActiveUser(remote);
    return remote;
  } catch {
    return local;
  }
}

function mergeUsers(users: UserProfile[], profile: UserProfile): UserProfile[] {
  const key = getUserKey(profile.name);
  const withoutProfile = users.filter((user) => getUserKey(user.name) !== key);
  return [...withoutProfile, profile].sort((a, b) => a.name.localeCompare(b.name));
}
