const accentMap: Record<string, string> = {
  à: "a",
  è: "e",
  é: "e",
  ì: "i",
  ò: "o",
  ù: "u",
};

export function normalizeAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/[àèéìòù]/g, (char) => accentMap[char] ?? char);
}

export function isAcceptedAnswer(answer: string, accepted: string[]): boolean {
  const normalized = normalizeAnswer(answer);
  return accepted.some((candidate) => normalizeAnswer(candidate) === normalized);
}
