import type { AttemptRecord, ProgressState } from "../types";
import { allItems } from "./questions";
import { getFormProgress } from "./progress";

export interface BreakdownStat {
  key: string;
  label: string;
  attempts: number;
  correct: number;
  failures: number;
  accuracy: number;
}

export interface LearningStats {
  attempts: number;
  correct: number;
  failures: number;
  accuracy: number;
  coverage: number;
  practicedForms: number;
  masteredForms: number;
  dueForms: number;
  verbs: BreakdownStat[];
  tenses: BreakdownStat[];
  persons: BreakdownStat[];
  regularity: BreakdownStat[];
  recentAccuracy: number | null;
  recentDelta: number | null;
  recoveredForms: number;
  commonWrongAnswer: { answer: string; count: number } | null;
  recentMisses: AttemptRecord[];
}

interface MutableBreakdown {
  key: string;
  label: string;
  attempts: number;
  correct: number;
}

export function getLearningStats(progress: ProgressState): LearningStats {
  const forms = Object.values(progress.forms);
  const attempts = forms.reduce((total, form) => total + form.attempts, 0);
  const correct = forms.reduce((total, form) => total + form.correct, 0);
  const practicedForms = forms.filter((form) => form.attempts > 0).length;
  const history = progress.attemptHistory ?? [];

  const verbGroups = new Map<string, MutableBreakdown>();
  const tenseGroups = new Map<string, MutableBreakdown>();
  const personGroups = new Map<string, MutableBreakdown>();
  const regularityGroups = new Map<string, MutableBreakdown>();

  for (const item of allItems) {
    const form = getFormProgress(progress, item.id);
    if (form.attempts === 0) continue;

    addToGroup(verbGroups, item.verbId, item.lemma, form.attempts, form.correct);
    addToGroup(tenseGroups, item.tense, item.tense, form.attempts, form.correct);
    addToGroup(personGroups, item.person, item.person, form.attempts, form.correct);
    addToGroup(
      regularityGroups,
      item.irregular ? "irregular" : "regular",
      item.irregular ? "Irregular" : "Regular",
      form.attempts,
      form.correct,
    );
  }

  const recentWindow = history.slice(-20);
  const previousWindow = history.slice(-40, -20);
  const recentAccuracy = accuracyForAttempts(recentWindow);
  const previousAccuracy = accuracyForAttempts(previousWindow);

  return {
    attempts,
    correct,
    failures: attempts - correct,
    accuracy: percentage(correct, attempts),
    coverage: percentage(practicedForms, allItems.length),
    practicedForms,
    masteredForms: forms.filter((form) => form.mastery >= 80).length,
    dueForms: forms.filter((form) => form.attempts > 0 && Date.parse(form.dueAt) <= Date.now()).length,
    verbs: finishGroups(verbGroups),
    tenses: finishGroups(tenseGroups),
    persons: finishGroups(personGroups),
    regularity: finishGroups(regularityGroups),
    recentAccuracy,
    recentDelta:
      recentAccuracy !== null && previousAccuracy !== null ? recentAccuracy - previousAccuracy : null,
    recoveredForms: countRecoveredForms(history),
    commonWrongAnswer: findCommonWrongAnswer(history),
    recentMisses: history.filter((attempt) => !attempt.correct).slice(-5).reverse(),
  };
}

function addToGroup(
  groups: Map<string, MutableBreakdown>,
  key: string,
  label: string,
  attempts: number,
  correct: number,
) {
  const existing = groups.get(key) ?? { key, label, attempts: 0, correct: 0 };
  existing.attempts += attempts;
  existing.correct += correct;
  groups.set(key, existing);
}

function finishGroups(groups: Map<string, MutableBreakdown>): BreakdownStat[] {
  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      failures: group.attempts - group.correct,
      accuracy: percentage(group.correct, group.attempts),
    }))
    .sort(
      (a, b) =>
        b.failures - a.failures ||
        a.accuracy - b.accuracy ||
        b.attempts - a.attempts ||
        a.label.localeCompare(b.label),
    );
}

function accuracyForAttempts(attempts: AttemptRecord[]): number | null {
  if (attempts.length === 0) return null;
  return percentage(
    attempts.filter((attempt) => attempt.correct).length,
    attempts.length,
  );
}

function countRecoveredForms(history: AttemptRecord[]): number {
  const states = new Map<string, { missed: boolean; latestCorrect: boolean }>();

  for (const attempt of history) {
    const state = states.get(attempt.itemId) ?? { missed: false, latestCorrect: false };
    if (!attempt.correct) state.missed = true;
    state.latestCorrect = attempt.correct;
    states.set(attempt.itemId, state);
  }

  return Array.from(states.values()).filter((state) => state.missed && state.latestCorrect).length;
}

function findCommonWrongAnswer(history: AttemptRecord[]): { answer: string; count: number } | null {
  const wrongAnswers = new Map<string, { answer: string; count: number }>();

  for (const attempt of history) {
    const answer = attempt.answer.trim();
    if (attempt.correct || !answer) continue;
    const key = answer.toLocaleLowerCase();
    const existing = wrongAnswers.get(key) ?? { answer, count: 0 };
    existing.count += 1;
    wrongAnswers.set(key, existing);
  }

  return (
    Array.from(wrongAnswers.values()).sort(
      (a, b) => b.count - a.count || a.answer.localeCompare(b.answer),
    )[0] ?? null
  );
}

function percentage(value: number, total: number): number {
  return total ? Math.round((value / total) * 100) : 0;
}
