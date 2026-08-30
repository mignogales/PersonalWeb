import verbs from "../data/verbs.json";
import type { Mode, PracticeItem, ProgressState, VerbEntry } from "../types";
import { getFormProgress } from "./progress";

export const verbBank = verbs as VerbEntry[];

// The generator places the 160 unique entries from COMMON_FIRST at the start
// of the bank, ordered from the most broadly useful verbs onward.
const COMMON_VERB_COUNT = 160;
const frequencyWeightByVerb = new Map(
  verbBank.map((verb, rank) => [verb.id, frequencyWeightForRank(rank)]),
);

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

  return buildWeightedQueue(candidates, mode === "daily" ? 20 : 30, (item) => {
    const form = getFormProgress(progress, item.id);
    const isDue = Date.parse(form.dueAt) <= now ? 40 : 0;
    const weakness = form.attempts ? (1 - form.correct / form.attempts) * 55 : 18;
    const freshness = form.lastPracticed ? Math.min(25, (now - Date.parse(form.lastPracticed)) / 86_400_000) : 25;
    return isDue + weakness + freshness;
  });
}

export function fallbackQueue(mode: Mode, tense?: string, dailyTenses: string[] = tenseOptions): PracticeItem[] {
  let candidates = allItems;
  if (mode === "daily") candidates = filterByTenses(candidates, dailyTenses);
  if (mode === "irregular") candidates = candidates.filter((item) => item.irregular);
  if (mode === "tense" && tense) candidates = candidates.filter((item) => item.tense === tense);
  return buildWeightedQueue(candidates, mode === "daily" ? 20 : 30);
}

function filterByTenses(items: PracticeItem[], selectedTenses: string[]): PracticeItem[] {
  const selected = new Set(selectedTenses);
  return items.filter((item) => selected.has(item.tense));
}

function buildWeightedQueue(
  candidates: PracticeItem[],
  limit: number,
  learningPriority: (item: PracticeItem) => number = () => 0,
): PracticeItem[] {
  const byVerb = new Map<string, PracticeItem[]>();

  for (const item of candidates) {
    const forms = byVerb.get(item.verbId);
    if (forms) forms.push(item);
    else byVerb.set(item.verbId, [item]);
  }

  const rankedVerbs = Array.from(byVerb.entries())
    .map(([verbId, forms]) => {
      const rankedForms = forms
        .map((item) => {
          const priority = learningPriority(item);
          return { item, priority, score: priority / 18 + gumbelNoise() };
        })
        .sort((a, b) => b.score - a.score);
      const best = rankedForms[0];
      const frequencyWeight = frequencyWeightByVerb.get(verbId) ?? 1;

      return {
        best: best.item,
        remaining: rankedForms.slice(1).map(({ item }) => item),
        score: best.priority / 25 + Math.log(frequencyWeight) + gumbelNoise(),
      };
    })
    .sort((a, b) => b.score - a.score);

  const selected = rankedVerbs.slice(0, limit).map(({ best }) => best);
  if (selected.length >= limit) return selected;

  const extras = rankedVerbs
    .flatMap(({ remaining }) => remaining)
    .map((item) => ({
      item,
      score:
        learningPriority(item) / 25 +
        Math.log(frequencyWeightByVerb.get(item.verbId) ?? 1) +
        gumbelNoise(),
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);

  return [...selected, ...extras].slice(0, limit);
}

function frequencyWeightForRank(rank: number): number {
  if (rank >= COMMON_VERB_COUNT) return 1;
  if (rank < 25) return 6;
  if (rank < 75) return 3;
  return 1.75;
}

function gumbelNoise(): number {
  const uniform = Math.min(1 - Number.EPSILON, Math.max(Number.EPSILON, Math.random()));
  return -Math.log(-Math.log(uniform));
}
