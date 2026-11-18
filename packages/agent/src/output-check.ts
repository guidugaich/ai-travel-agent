const MONTH = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";

/** Each pattern finds one kind of value; `key` turns equivalent spellings into the same text. */
const PATTERNS: readonly {
  readonly regex: RegExp;
  readonly key: (m: RegExpMatchArray) => string;
}[] = [
  // Clock times, but not the clock inside a timestamp such as 2026-10-13T09:12:00Z.
  {
    regex: /(?<![\d:T])(\d{1,2}):(\d{2})(?![\d:])/g,
    key: (m) => `${(m[1] ?? "").padStart(2, "0")}:${m[2] ?? ""}`,
  },
  {
    regex: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH}`, "gi"),
    key: (m) => `${Number(m[1])} ${(m[2] ?? "").toLowerCase()}`,
  },
  {
    regex: new RegExp(`\\b${MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?![:\\d])`, "gi"),
    key: (m) => `${Number(m[2])} ${(m[1] ?? "").toLowerCase()}`,
  },
  { regex: /\b\d{4}-\d{2}-\d{2}\b/g, key: (m) => m[0] },
  // Durations as the core writes them, whole ("1 day, 6 h 53 min"), then any other spelling.
  {
    regex:
      /\b\d+ days?(?:, \d+ h)?(?: \d+ min)?\b|\b\d+ h(?: \d+ min)?\b|\b\d+ min\b|\b\d+\s*(?:hours?|hrs?|h|minutes?|mins?)\b/gi,
    key: (m) => m[0].toLowerCase(),
  },
  { regex: /\b(?:today|tomorrow|yesterday|tonight)\b/gi, key: (m) => m[0].toLowerCase() },
];

/** The times, dates, durations and relative days in a reply that none of the sources contain. */
export function unsupportedValues(reply: string, sources: readonly string[]): string[] {
  const known = new Set(sources.flatMap((source) => valuesIn(source).map((value) => value.key)));
  const missing = valuesIn(reply)
    .filter((value) => !known.has(value.key))
    .map((value) => value.raw);
  return [...new Set(missing)];
}

function valuesIn(text: string): { readonly raw: string; readonly key: string }[] {
  // Some models, such as gpt-oss, write non-breaking spaces (U+202F); treat every kind of space alike.
  const plain = text.replace(/\s/g, " ");
  return PATTERNS.flatMap(({ regex, key }) =>
    [...plain.matchAll(regex)].map((match) => ({ raw: match[0], key: key(match) })),
  );
}
