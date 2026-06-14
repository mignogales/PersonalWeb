import type { FormProgress, PracticeItem, ProgressState } from "../types";
import { apiRequest, isApiEnabled } from "./api";
import { getUserKey } from "./users";

const STORAGE_KEY = "italian-verb-sprint-progress";
const DAY_MS = 24 * 60 * 60 * 1000;

const emptyProgress: ProgressState = {
  forms: {},
  currentStreak: 0,
  bestStreak: 0,
  practicedDays: [],
};

export function loadProgress(): ProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...emptyProgress, ...JSON.parse(raw) } : emptyProgress;
  } catch {
    return emptyProgress;
  }
}

export function saveProgress(progress: ProgressState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function loadUserProgress(userName: string): ProgressState {
  try {
    const raw = localStorage.getItem(userProgressKey(userName));
    return raw ? { ...emptyProgress, ...JSON.parse(raw) } : emptyProgress;
  } catch {
    return emptyProgress;
  }
}

export function saveUserProgress(userName: string, progress: ProgressState) {
  localStorage.setItem(userProgressKey(userName), JSON.stringify(progress));
}

export async function loadUserProgressRemote(userName: string): Promise<ProgressState> {
  const local = loadUserProgress(userName);
  if (!isApiEnabled()) return local;

  try {
    const remote = await apiRequest<ProgressState>(`/api/users/${encodeURIComponent(getUserKey(userName))}/progress`);
    const progress = { ...emptyProgress, ...remote };
    saveUserProgress(userName, progress);
    return progress;
  } catch {
    return local;
  }
}

export async function saveUserProgressRemote(userName: string, progress: ProgressState): Promise<void> {
  saveUserProgress(userName, progress);
  if (!isApiEnabled()) return;

  try {
    await apiRequest<void>(`/api/users/${encodeURIComponent(getUserKey(userName))}/progress`, {
      method: "PUT",
      body: JSON.stringify(progress),
    });
  } catch {
    // Local storage remains the offline source until the next successful sync.
  }
}

function userProgressKey(userName: string): string {
  return `${STORAGE_KEY}:${encodeURIComponent(userName.trim().toLocaleLowerCase())}`;
}

export function defaultFormProgress(): FormProgress {
  return {
    attempts: 0,
    correct: 0,
    lastPracticed: null,
    mastery: 0,
    streak: 0,
    intervalDays: 0,
    dueAt: new Date(0).toISOString(),
  };
}

export function getFormProgress(progress: ProgressState, itemId: string): FormProgress {
  return progress.forms[itemId] ?? defaultFormProgress();
}

export function markAttempt(progress: ProgressState, item: PracticeItem, wasCorrect: boolean): ProgressState {
  const existing = getFormProgress(progress, item.id);
  const now = new Date();
  const streak = wasCorrect ? existing.streak + 1 : 0;
  const intervalDays = wasCorrect ? nextInterval(existing.intervalDays, streak) : 0;
  const dueAt = new Date(now.getTime() + intervalDays * DAY_MS).toISOString();
  const attempts = existing.attempts + 1;
  const correct = existing.correct + (wasCorrect ? 1 : 0);
  const accuracy = correct / attempts;
  const mastery = Math.round(Math.min(100, accuracy * 55 + Math.min(streak, 8) * 5 + Math.min(intervalDays, 21)));
  const practicedDays = updatePracticedDays(progress.practicedDays, now);
  const currentStreak = computeDayStreak(practicedDays);

  return {
    forms: {
      ...progress.forms,
      [item.id]: {
        attempts,
        correct,
        lastPracticed: now.toISOString(),
        mastery,
        streak,
        intervalDays,
        dueAt,
      },
    },
    currentStreak,
    bestStreak: Math.max(progress.bestStreak, currentStreak),
    practicedDays,
  };
}

function nextInterval(previous: number, streak: number): number {
  if (streak <= 1) return 1;
  if (previous <= 1) return 3;
  return Math.min(30, Math.ceil(previous * 2.2));
}

function updatePracticedDays(days: string[], date: Date): string[] {
  const key = date.toISOString().slice(0, 10);
  return Array.from(new Set([...days, key])).sort();
}

function computeDayStreak(days: string[]): number {
  const set = new Set(days);
  let streak = 0;
  const cursor = new Date();
  while (set.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
