import verbs from "../data/verbs.json";
import type { Mode, PracticeItem, ProgressState, VerbEntry } from "../types";
import { getFormProgress } from "./progress";

export const verbBank = verbs as VerbEntry[];

export const allItems: PracticeItem[] = verbBank.flatMap((verb) =>
  verb.forms.map((form, index) => ({
    ...form,
    id: `${verb.id}:${form.tense}:${form.person}:${form.genderNumber ?? "plain"}:${index}`,
    verbId: verb.id,
    lemma: verb.lemma,
    english: verb.english,
    irregular: verb.irregular,
  })),
);

export const tenseOptions = Array.from(new Set(allItems.map((item) => item.tense))).sort();

export function buildQueue(
  mode: Mode,
  progress: ProgressState,
  tense?: string,
  dailyTenses: string[] = tenseOptions,
): PracticeItem[] {
  const now = Date.now();
  let candidates = allItems;

  if (mode === "daily") candidates = filterByTenses(candidates, dailyTenses);
  if (mode === "irregular") candidates = candidates.filter((item) => item.irregular);
  if (mode === "tense" && tense) candidates = candidates.filter((item) => item.tense === tense);
  if (mode === "weakness") {
    candidates = candidates.filter((item) => {
      const form = getFormProgress(progress, item.id);
      const accuracy = form.attempts === 0 ? 1 : form.correct / form.attempts;
      return form.attempts > 0 && (accuracy < 0.75 || form.mastery < 60 || Date.parse(form.dueAt) <= now);
    });
  }

  const scored = candidates.map((item) => {
    const form = getFormProgress(progress, item.id);
    const isDue = Date.parse(form.dueAt) <= now ? 40 : 0;
    const weakness = form.attempts ? (1 - form.correct / form.attempts) * 55 : 18;
    const freshness = form.lastPracticed ? Math.min(25, (now - Date.parse(form.lastPracticed)) / 86_400_000) : 25;
    return { item, score: isDue + weakness + freshness + Math.random() * 18 };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
    .slice(0, mode === "daily" ? 20 : 30);
}

export function fallbackQueue(mode: Mode, tense?: string, dailyTenses: string[] = tenseOptions): PracticeItem[] {
  let candidates = allItems;
  if (mode === "daily") candidates = filterByTenses(candidates, dailyTenses);
  if (mode === "irregular") candidates = candidates.filter((item) => item.irregular);
  if (mode === "tense" && tense) candidates = candidates.filter((item) => item.tense === tense);
  return shuffle(candidates).slice(0, mode === "daily" ? 20 : 30);
}

function filterByTenses(items: PracticeItem[], selectedTenses: string[]): PracticeItem[] {
  const selected = new Set(selectedTenses);
  return items.filter((item) => selected.has(item.tense));
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}
