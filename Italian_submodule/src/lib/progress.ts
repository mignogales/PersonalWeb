import type { FormProgress, Mode, PracticeItem, ProgressState } from "../types";
import { apiRequest, ApiError, getSession } from "./api";


const STORAGE_KEY = "italian-verb-sprint-progress";
const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_LIMIT = 1_000;

const emptyProgress: ProgressState = {
  forms: {},
  currentStreak: 0,
  bestStreak: 0,
  practicedDays: [],
  attemptHistory: [],
};

export function loadProgress(): ProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeProgress(JSON.parse(raw)) : emptyProgress;
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
    return raw ? normalizeProgress(JSON.parse(raw)) : emptyProgress;
  } catch {
    return emptyProgress;
  }
}

export function saveUserProgress(userName: string, progress: ProgressState) {
  const key = userProgressKey(userName);
  const previous = JSON.parse(localStorage.getItem(key) || "{}");
  localStorage.setItem(key, JSON.stringify({ ...progress, _sync: previous._sync }));
}

interface Snapshot { revision: number; progress: ProgressState }
interface Pending { revision: number; progress: ProgressState; mutationId: string }
interface SyncState { baseline: Snapshot; pending?: Pending }
let running: Promise<ProgressState> | null = null;
let runningAccount: string | null = null;

export async function loadUserProgressRemote(userName: string): Promise<ProgressState> {
  const session = getSession();
  if (!session || session.user.name !== userName) throw new Error("Sign in to sync");
  // Serialize requests within this tab; Web Locks also serialize across tabs.
  if (running && runningAccount === session.user.id) return running;
  const run = () => syncProgress(userName, session.user.id, session.token);
  runningAccount = session.user.id;
  const task = Promise.resolve(navigator.locks
    ? navigator.locks.request(`italian-sync:${session.user.id}`, run)
    : run());
  running = task;
  try { return await task; } finally { if (running === task) running = null; }
}

async function syncProgress(name: string, id: string, token: string): Promise<ProgressState> {
  const key = userProgressKey(name);
  const record = JSON.parse(localStorage.getItem(key) || "{}");
  let state: SyncState | null = record._sync?.accountId === id ? record._sync : null;
  // One atomic localStorage write keeps acknowledged state and local edits together.
  const commit = (progress: ProgressState, value: SyncState) => {
    localStorage.setItem(key, JSON.stringify({ ...progress, _sync: { ...value, accountId: id } }));
  };
  const checkAccount = () => {
    if (getSession()?.user.id !== id) throw new Error("Account changed");
  };
  // Replay a saved request first: the server recognizes its ID after a lost response.
  for (let retry = 0; retry < 5; retry++) {
    checkAccount();
    if (state?.pending) {
      const pending = state.pending;
      try {
        const saved = await apiRequest<Snapshot>("/progress", { method: "PUT", body: JSON.stringify(pending) }, token);
        checkAccount();
        const local = mergeProgress(pending.progress, loadUserProgress(name), saved.progress);
        state = { baseline: saved };
        commit(local, state);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 409) throw error;
        checkAccount();
        const remote = error.data as Snapshot;
        const local = mergeProgress(state.baseline.progress, loadUserProgress(name), remote.progress);
        state = { baseline: remote };
        commit(local, state);
      }
    }
    const remote = await apiRequest<Snapshot>("/progress", {}, token);
    checkAccount();
    const local = loadUserProgress(name);
    const merged = mergeProgress(state?.baseline.progress ?? null, local, remote.progress);
    state = { baseline: remote };
    if (JSON.stringify(merged) === JSON.stringify(remote.progress)) {
      commit(merged, state);
      return merged;
    }
    state.pending = { revision: remote.revision, progress: merged, mutationId: crypto.randomUUID() };
    // Persist before sending, so an interrupted request can be retried safely.
    commit(merged, state);
  }
  throw new Error("Sync busy; saved on this device and will retry");
}

// Existing counters are imported once. Subsequently only local changes since the
// last acknowledged snapshot are added to the server's counters.
export function mergeProgress(base: ProgressState | null, local: ProgressState, remote: ProgressState): ProgressState {
  const forms: ProgressState["forms"] = { ...remote.forms };
  for (const [id, value] of Object.entries(local.forms)) {
    const other = remote.forms[id] ?? defaultFormProgress();
    const previous = base?.forms[id] ?? defaultFormProgress();
    const attempts = base ? other.attempts + Math.max(0, value.attempts - previous.attempts) : Math.max(value.attempts, other.attempts);
    const correct = base ? other.correct + Math.max(0, value.correct - previous.correct) : Math.max(value.correct, other.correct);
    const latest = (value.lastPracticed ?? "") > (other.lastPracticed ?? "") ? value : other;
    forms[id] = { ...latest, attempts, correct: Math.min(attempts, correct) };
  }
  const practicedDays = Array.from(new Set([...remote.practicedDays, ...local.practicedDays])).sort();
  return {
    forms,
    currentStreak: computeDayStreak(practicedDays),
    bestStreak: Math.max(local.bestStreak, remote.bestStreak),
    practicedDays,
    attemptHistory: mergeAttemptHistory(local.attemptHistory, remote.attemptHistory),
  };
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

export function markAttempt(
  progress: ProgressState,
  item: PracticeItem,
  wasCorrect: boolean,
  details: { answer?: string; mode?: Mode } = {},
): ProgressState {
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
  const attemptHistory = [
    ...(progress.attemptHistory ?? []),
    {
      itemId: item.id,
      verbId: item.verbId,
      lemma: item.lemma,
      tense: item.tense,
      person: item.person,
      irregular: item.irregular,
      correct: wasCorrect,
      answer: details.answer?.trim().slice(0, 240) ?? "",
      expected: (item.accepted[0] ?? "").slice(0, 240),
      mode: details.mode ?? "daily",
      attemptedAt: now.toISOString(),
    },
  ].slice(-HISTORY_LIMIT);

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
    attemptHistory,
  };
}

function normalizeProgress(value: Partial<ProgressState> | null | undefined): ProgressState {
  return {
    currentStreak: value?.currentStreak ?? 0,
    bestStreak: value?.bestStreak ?? 0,
    forms: value?.forms && typeof value.forms === "object" ? value.forms : {},
    practicedDays: Array.isArray(value?.practicedDays) ? value.practicedDays : [],
    attemptHistory: Array.isArray(value?.attemptHistory) ? value.attemptHistory.slice(-HISTORY_LIMIT) : [],
  };
}

function mergeAttemptHistory(local: ProgressState["attemptHistory"], remote?: ProgressState["attemptHistory"]) {
  const merged = new Map<string, ProgressState["attemptHistory"][number]>();

  for (const attempt of [...(remote ?? []), ...local]) {
    const key = [attempt.attemptedAt, attempt.itemId, attempt.answer, attempt.correct ? "1" : "0"].join("\u0000");
    merged.set(key, attempt);
  }

  return Array.from(merged.values())
    .sort((a, b) => a.attemptedAt.localeCompare(b.attemptedAt))
    .slice(-HISTORY_LIMIT);
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
