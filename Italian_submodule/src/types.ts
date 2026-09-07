export type Person = "io" | "tu" | "lui/lei" | "noi" | "voi" | "loro";
export type GenderNumber = "m_s" | "f_s" | "m_p" | "f_p";

export interface VerbForm {
  tense: string;
  person: Person;
  genderNumber?: GenderNumber;
  accepted: string[];
}

export interface VerbEntry {
  id: string;
  lemma: string;
  english: string;
  irregular: boolean;
  frequencyRank?: number;
  forms: VerbForm[];
}

export interface PracticeItem extends VerbForm {
  id: string;
  verbId: string;
  lemma: string;
  english: string;
  irregular: boolean;
}

export interface FormProgress {
  attempts: number;
  correct: number;
  lastPracticed: string | null;
  mastery: number;
  streak: number;
  intervalDays: number;
  dueAt: string;
}

export interface ProgressState {
  forms: Record<string, FormProgress>;
  currentStreak: number;
  bestStreak: number;
  practicedDays: string[];
  attemptHistory: AttemptRecord[];
}

export interface AttemptRecord {
  itemId: string;
  verbId: string;
  lemma: string;
  tense: string;
  person: Person;
  irregular: boolean;
  correct: boolean;
  answer: string;
  expected: string;
  mode: Mode;
  attemptedAt: string;
}

export interface UserProfile {
  id?: string;
  name: string;
  createdAt: string;
  lastSeenAt: string;
}

export type Mode = "daily" | "irregular" | "tense" | "weakness";
