import {
  ArrowRight,
  BarChart3,
  Check,
  Flame,
  LogOut,
  RotateCcw,
  Settings2,
  Target,
  Trophy,
  User,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { allItems, buildQueue, fallbackQueue, tenseOptions, verbBank } from "./lib/questions";
import { isAcceptedAnswer } from "./lib/normalize";
import {
  getFormProgress,
  loadUserProgress,
  loadUserProgressRemote,
  markAttempt,
  saveUserProgressRemote,
} from "./lib/progress";
import { loadActiveUser, loadUsers, loadUsersRemote, saveActiveUser, upsertUserRemote } from "./lib/users";
import type { Mode, PracticeItem, ProgressState, UserProfile } from "./types";

const modeLabels: Record<Mode, string> = {
  daily: "Daily Sprint",
  irregular: "Irregular",
  tense: "Tense Focus",
  weakness: "Weakness",
};

const genderLabels: Record<string, string> = {
  m_s: "masculine singular",
  f_s: "feminine singular",
  m_p: "masculine plural",
  f_p: "feminine plural",
};

const DAILY_TENSES_KEY = "italian-verb-sprint-daily-tenses";

type View = "practice" | "stats";
type SyncStatus = "loading" | "ready" | "offline";

function App() {
  const [user, setUser] = useState<UserProfile | null>(() => loadActiveUser());
  const [users, setUsers] = useState<UserProfile[]>(() => loadUsers());
  const [progress, setProgress] = useState<ProgressState>(() =>
    user ? loadUserProgress(user.name) : loadUserProgress("guest"),
  );
  const [view, setView] = useState<View>("practice");
  const [mode, setMode] = useState<Mode>("daily");
  const [tense, setTense] = useState(tenseOptions[0] ?? "presente");
  const [showOptions, setShowOptions] = useState(false);
  const [dailyTenses, setDailyTenses] = useState<string[]>(() => loadDailyTenses());
  const [queue, setQueue] = useState<PracticeItem[]>(() => fallbackQueue("daily"));
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [lastCorrect, setLastCorrect] = useState("");
  const [roundCorrect, setRoundCorrect] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const hasHydrated = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = queue[index];
  const completed = index >= queue.length;
  const stats = useMemo(() => getStats(progress), [progress]);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const savedUser = loadActiveUser();
      const savedUsers = await loadUsersRemote();
      if (cancelled) return;

      setUsers(savedUsers);
      setUser(savedUser);

      if (savedUser) {
        const savedProgress = await loadUserProgressRemote(savedUser.name);
        if (!cancelled) setProgress(savedProgress);
      }

      if (!cancelled) {
        hasHydrated.current = true;
        setSyncStatus("ready");
      }
    }

    hydrate().catch(() => {
      if (!cancelled) {
        hasHydrated.current = true;
        setSyncStatus("offline");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user || !hasHydrated.current) return;
    saveUserProgressRemote(user.name, progress).catch(() => setSyncStatus("offline"));
  }, [progress, user]);

  useEffect(() => {
    localStorage.setItem(DAILY_TENSES_KEY, JSON.stringify(dailyTenses));
    startRound(mode, tense, dailyTenses);
  }, [mode, tense, user, dailyTenses]);

  async function handleLogin(name: string) {
    setSyncStatus("loading");
    const selected = await upsertUserRemote(name);
    const selectedProgress = await loadUserProgressRemote(selected.name);
    const nextUsers = await loadUsersRemote();
    hasHydrated.current = true;
    setUsers(nextUsers);
    setUser(selected);
    setProgress(selectedProgress);
    setView("practice");
    setSyncStatus("ready");
  }

  function handleLogout() {
    saveActiveUser(null);
    setUser(null);
    setView("practice");
    setProgress(loadUserProgress("guest"));
  }

  function startRound(nextMode = mode, nextTense = tense, nextDailyTenses = dailyTenses) {
    const nextQueue = buildQueue(nextMode, progress, nextTense, nextDailyTenses);
    setQueue(nextQueue.length ? nextQueue : fallbackQueue(nextMode, nextTense, nextDailyTenses));
    setIndex(0);
    setRoundCorrect(0);
    setAnswer("");
    setFeedback(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (feedback) {
      nextQuestion();
      return;
    }
    if (!current || !answer.trim()) return;

    const wasCorrect = isAcceptedAnswer(answer, current.accepted);
    setLastCorrect(current.accepted[0]);
    setFeedback(wasCorrect ? "correct" : "wrong");
    if (wasCorrect) setRoundCorrect((value) => value + 1);
    setProgress((state) => markAttempt(state, current, wasCorrect));

    if (!wasCorrect) {
      setQueue((items) => {
        const retryAt = Math.min(items.length, index + 3);
        const copy = [...items];
        copy.splice(retryAt, 0, current);
        return copy;
      });
    }
  }

  function nextQuestion() {
    setIndex((value) => value + 1);
    setAnswer("");
    setFeedback(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function toggleDailyTense(option: string) {
    setDailyTenses((selected) => {
      if (!selected.includes(option)) return [...selected, option];
      return selected.length > 1 ? selected.filter((item) => item !== option) : selected;
    });
  }

  function selectAllDailyTenses() {
    setDailyTenses(tenseOptions);
  }

    if (!user) {
      return <LoginScreen users={users} onLogin={handleLogin} />;
  }

  const roundProgress = queue.length ? Math.min(100, (index / queue.length) * 100) : 0;
  const bankCount = verbBank.length;
  const formCount = verbBank.reduce((total, verb) => total + verb.forms.length, 0);

  return (
    <main className="app-viewport text-slate-950">
      <div className="app-shell mx-auto flex w-full max-w-md flex-col gap-3">
        <header className="app-header flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Italian Verb Sprint</p>
            <h1 className="truncate text-2xl font-black">Ciao, {user.name}</h1>
            {syncStatus !== "ready" && (
              <p className="mt-1 text-xs font-bold text-slate-500">
                {syncStatus === "loading" ? "Syncing..." : "Offline"}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full bg-white px-3 py-2 text-sm font-bold shadow-sm">
              <Flame className="h-4 w-4 text-red-500" />
              {progress.currentStreak}
            </div>
            <button
              aria-label="Log out"
              onClick={handleLogout}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="view-tabs grid grid-cols-2 gap-2">
          <button
            onClick={() => setView("practice")}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-bold transition ${
              view === "practice"
                ? "border-teal-700 bg-teal-700 text-white"
                : "border-slate-200 bg-white text-slate-700 shadow-sm"
            }`}
          >
            <Target className="h-4 w-4" />
            Practice
          </button>
          <button
            onClick={() => setView("stats")}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-bold transition ${
              view === "stats"
                ? "border-teal-700 bg-teal-700 text-white"
                : "border-slate-200 bg-white text-slate-700 shadow-sm"
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Stats
          </button>
        </div>

        {view === "stats" ? (
          <StatsPanel formCount={formCount} progress={progress} stats={stats} />
        ) : (
          <>
            <section className="mode-controls grid grid-cols-4 gap-2">
              {(["daily", "irregular", "tense", "weakness"] as Mode[]).map((option) => (
                <button
                  key={option}
                  onClick={() => setMode(option)}
                  className={`mode-button min-h-11 rounded-lg border px-2 text-sm font-bold leading-tight transition ${
                    mode === option
                      ? "border-teal-700 bg-teal-700 text-white"
                      : "border-slate-200 bg-white text-slate-700 shadow-sm"
                  }`}
                >
                  {modeLabels[option]}
                </button>
              ))}
            </section>

            {mode === "daily" && (
              <section className="daily-settings relative rounded-lg border border-slate-200 bg-white px-3 py-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setShowOptions((value) => !value)}
                  aria-expanded={showOptions}
                  className="flex min-h-10 w-full items-center justify-between gap-3 text-left text-sm font-black text-slate-800"
                >
                  <span className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-teal-700" />
                    Daily tenses
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    {dailyTenses.length}/{tenseOptions.length}
                  </span>
                </button>

                {showOptions && (
                  <div className="daily-options-panel space-y-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={selectAllDailyTenses}
                        className="min-h-10 flex-1 rounded-lg bg-teal-700 px-3 text-sm font-black text-white"
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowOptions(false)}
                        className="min-h-10 flex-1 rounded-lg bg-slate-950 px-3 text-sm font-black text-white"
                      >
                        Done
                      </button>
                    </div>
                    <div className="daily-options-grid grid grid-cols-2 gap-2">
                      {tenseOptions.map((option) => {
                        const checked = dailyTenses.includes(option);
                        return (
                          <label
                            key={option}
                            className="flex min-h-11 items-center gap-3 rounded-lg bg-slate-100 px-3 text-sm font-bold text-slate-700"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleDailyTense(option)}
                              className="h-4 w-4 accent-teal-700"
                            />
                            <span>{option}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            )}

            {mode === "tense" && (
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold shadow-sm">
                <Target className="h-4 w-4 text-teal-700" />
                <select
                  value={tense}
                  onChange={(event) => setTense(event.target.value)}
                  className="min-h-10 flex-1 bg-transparent outline-none"
                >
                  {tenseOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="progress-track h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${roundProgress}%` }} />
            </div>

            <section className="practice-card flex min-h-0 flex-1 flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
              {completed ? (
                <div className="flex flex-1 flex-col justify-center gap-5 text-center">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.16em] text-teal-700">Round complete</p>
                    <h2 className="mt-2 text-4xl font-black">{queue.length} forms</h2>
                    <p className="mt-2 text-slate-600">
                      Best streak {progress.bestStreak} days. Your weaker forms are now queued sooner.
                    </p>
                  </div>
                  <button
                    onClick={() => startRound()}
                    className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-lg font-black text-white"
                  >
                    <RotateCcw className="h-5 w-5" />
                    New round
                  </button>
                </div>
              ) : (
                current && (
                  <div className="question-layout flex min-h-0 flex-1 flex-col gap-3">
                    <div className="flex items-center justify-between text-sm font-bold text-slate-500">
                      <span>
                        {index + 1}/{queue.length}
                      </span>
                      <span>{current.irregular ? "irregular" : "regular"}</span>
                    </div>

                    <div className="question-copy space-y-2">
                      <p className="text-sm font-bold uppercase tracking-[0.16em] text-teal-700">{current.tense}</p>
                      <div>
                        <h2 className="verb-title text-4xl font-black leading-none">{current.lemma}</h2>
                        <p className="mt-1 text-sm text-slate-600">{current.english}</p>
                      </div>
                      <div className="conjugation-prompt rounded-lg bg-slate-100 p-3">
                        <p className="text-sm font-bold text-slate-500">Conjugate for</p>
                        <p className="mt-0.5 text-xl font-black">{current.person}</p>
                        {current.genderNumber && (
                          <p className="mt-1 text-sm font-bold text-red-600">{genderLabels[current.genderNumber]}</p>
                        )}
                      </div>
                    </div>

                    <form onSubmit={submit} className="answer-form mt-auto space-y-2">
                      <input
                        ref={inputRef}
                        value={answer}
                        onChange={(event) => setAnswer(event.target.value)}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder="Answer"
                        className="answer-input min-h-12 w-full rounded-lg border-2 border-slate-200 px-4 text-xl font-black outline-none transition focus:border-teal-700"
                      />

                      {feedback && (
                        <div
                          className={`rounded-lg p-3 text-sm font-bold ${
                            feedback === "correct" ? "bg-teal-50 text-teal-800" : "bg-red-50 text-red-700"
                          }`}
                        >
                          {feedback === "correct" ? "Correct." : `Answer: ${lastCorrect}`}
                        </div>
                      )}

                      {feedback ? (
                        <button
                          type="button"
                          onClick={nextQuestion}
                          className="answer-button flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-base font-black text-white"
                        >
                          Next
                          <ArrowRight className="h-5 w-5" />
                        </button>
                      ) : (
                        <button
                          type="submit"
                          className="answer-button flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-base font-black text-white disabled:opacity-50"
                          disabled={!answer.trim()}
                        >
                          Check
                          <Check className="h-5 w-5" />
                        </button>
                      )}
                    </form>
                  </div>
                )
              )}
            </section>

            <footer className="app-footer grid grid-cols-3 gap-2 text-center text-[0.7rem] font-bold text-slate-600">
              <div className="rounded-lg bg-white px-2 py-1.5 shadow-sm">
                <p className="text-base leading-tight text-slate-950">{bankCount}</p>
                verbs
              </div>
              <div className="rounded-lg bg-white px-2 py-1.5 shadow-sm">
                <p className="text-base leading-tight text-slate-950">{formCount}</p>
                forms
              </div>
              <div className="rounded-lg bg-white px-2 py-1.5 shadow-sm">
                <p className="flex items-center justify-center gap-1 text-base leading-tight text-slate-950">
                  <Check className="h-4 w-4 text-teal-700" />
                  {roundCorrect}
                </p>
                correct
              </div>
            </footer>
          </>
        )}
      </div>
    </main>
  );
}

function LoginScreen({ users, onLogin }: { users: UserProfile[]; onLogin: (name: string) => void }) {
  const [name, setName] = useState("");
  const cleanName = name.trim();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cleanName) onLogin(cleanName);
  }

  return (
    <main className="app-viewport text-slate-950">
      <div className="login-shell mx-auto flex h-full w-full max-w-md flex-col justify-center gap-4">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Italian Verb Sprint</p>
          <h1 className="mt-2 text-4xl font-black leading-none">Who is practicing?</h1>
        </header>

        <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <label className="text-sm font-bold text-slate-600" htmlFor="name">
            Name
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-lg border-2 border-slate-200 px-3 focus-within:border-teal-700">
            <User className="h-5 w-5 text-teal-700" />
            <input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              placeholder="Miguel"
              className="min-h-14 flex-1 bg-transparent text-xl font-black outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!cleanName}
            className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-lg font-black text-white disabled:opacity-50"
          >
            Start
            <ArrowRight className="h-5 w-5" />
          </button>
        </form>

        {users.length > 0 && (
          <section className="space-y-2">
            <p className="text-sm font-bold text-slate-600">Existing users</p>
            <div className="grid gap-2">
              {users.map((profile) => (
                <button
                  key={profile.name.toLocaleLowerCase()}
                  onClick={() => onLogin(profile.name)}
                  className="flex min-h-12 items-center justify-between rounded-lg border border-slate-200 bg-white px-4 text-left font-bold shadow-sm"
                >
                  <span>{profile.name}</span>
                  <ArrowRight className="h-4 w-4 text-teal-700" />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function StatsPanel({
  formCount,
  progress,
  stats,
}: {
  formCount: number;
  progress: ProgressState;
  stats: ReturnType<typeof getStats>;
}) {
  const weakest = allItems
    .map((item) => ({ item, form: getFormProgress(progress, item.id) }))
    .filter(({ form }) => form.attempts > 0)
    .sort((a, b) => a.form.mastery - b.form.mastery || b.form.attempts - a.form.attempts)
    .slice(0, 4);

  return (
    <section className="stats-panel grid min-h-0 flex-1 gap-3">
      <div className="stats-summary rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-teal-700">Stats</p>
            <h2 className="mt-1 text-3xl font-black">{stats.accuracy}% accuracy</h2>
          </div>
          <Trophy className="h-8 w-8 text-red-500" />
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-teal-700" style={{ width: `${stats.coverage}%` }} />
        </div>
        <p className="mt-2 text-sm font-bold text-slate-600">
          {stats.practicedForms}/{formCount} forms practiced
        </p>
      </div>

      <div className="stats-grid grid grid-cols-3 gap-2 text-center text-xs font-bold text-slate-600">
        <StatCard label="Attempts" value={stats.attempts} />
        <StatCard label="Correct" value={stats.correct} />
        <StatCard label="Mastered" value={stats.masteredForms} />
        <StatCard label="Due now" value={stats.dueForms} />
        <StatCard label="Days" value={progress.practicedDays.length} />
        <StatCard label="Best streak" value={progress.bestStreak} />
      </div>

      <div className="needs-practice min-h-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Needs practice</h3>
        {weakest.length > 0 ? (
          <div className="weakest-grid mt-2 grid grid-cols-2 gap-2">
            {weakest.map(({ item, form }) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-100 p-3">
                <div className="min-w-0">
                  <p className="truncate font-black">{item.lemma}</p>
                  <p className="truncate text-sm font-bold text-slate-500">
                    {item.tense} · {item.person}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-black text-red-600">{form.mastery}%</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-lg bg-slate-100 p-3 text-sm font-bold text-slate-600">
            Practice a few forms and weak spots will appear here.
          </p>
        )}
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white px-2 py-1.5 shadow-sm">
      <p className="text-xl font-black leading-tight text-slate-950">{value}</p>
      {label}
    </div>
  );
}

function loadDailyTenses(): string[] {
  try {
    const raw = localStorage.getItem(DAILY_TENSES_KEY);
    if (!raw) return tenseOptions;
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved)) return tenseOptions;
    const valid = saved.filter((item): item is string => tenseOptions.includes(item));
    return valid.length ? valid : tenseOptions;
  } catch {
    return tenseOptions;
  }
}

function getStats(progress: ProgressState) {
  const forms = Object.values(progress.forms);
  const attempts = forms.reduce((total, form) => total + form.attempts, 0);
  const correct = forms.reduce((total, form) => total + form.correct, 0);
  const practicedForms = forms.filter((form) => form.attempts > 0).length;
  const masteredForms = forms.filter((form) => form.mastery >= 80).length;
  const dueForms = forms.filter((form) => Date.parse(form.dueAt) <= Date.now()).length;

  return {
    attempts,
    correct,
    practicedForms,
    masteredForms,
    dueForms,
    accuracy: attempts ? Math.round((correct / attempts) * 100) : 0,
    coverage: Math.round((practicedForms / allItems.length) * 100),
  };
}

export default App;
