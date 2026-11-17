import type { Candidate } from "./candidates.ts";
import type { RunResult } from "./run-scenario.ts";

export interface Summary {
  readonly name: string;
  readonly passed: number;
  readonly total: number;
  /** Passed without needing the output check's retry. */
  readonly firstTry: number;
  readonly medianMs: number;
  readonly tokensPerConversation: number;
  /** US dollars, or null when the candidate has no price (a local model). */
  readonly costPerConversation: number | null;
  readonly dataTerms: string | null;
}

export function summarize(candidate: Candidate, runs: readonly RunResult[]): Summary {
  const total = runs.length;
  const input = average(runs.map((run) => run.usage.inputTokens));
  const output = average(runs.map((run) => run.usage.outputTokens));
  const { price } = candidate;
  return {
    name: candidate.name,
    passed: runs.filter((run) => run.passed).length,
    total,
    firstTry: runs.filter((run) => run.passed && run.outcome === "answered").length,
    medianMs: median(runs.map((run) => run.ms)),
    tokensPerConversation: Math.round(input + output),
    costPerConversation:
      price === undefined
        ? null
        : round((input * price.inputPerMillion + output * price.outputPerMillion) / 1_000_000, 4),
    dataTerms: candidate.dataTerms ?? null,
  };
}

/** The models side by side, then each scenario's pass rate per model, as Markdown. */
export function scorecard(
  models: readonly { readonly candidate: Candidate; readonly runs: readonly RunResult[] }[],
): string {
  const summaries = models.map(({ candidate, runs }) => summarize(candidate, runs));
  const overview = table(
    [
      "Model",
      "Passed",
      "First try",
      "Median time",
      "Tokens per conversation",
      "Cost per conversation",
      "Data terms",
    ],
    summaries.map((s) => [
      s.name,
      `${s.passed}/${s.total} (${percent(s.passed, s.total)})`,
      `${s.firstTry}/${s.total}`,
      `${(s.medianMs / 1000).toFixed(1)} s`,
      s.tokensPerConversation.toLocaleString("en-US"),
      s.costPerConversation === null ? "—" : `$${s.costPerConversation.toFixed(4)}`,
      s.dataTerms ?? "—",
    ]),
  );

  const scenarios = [...new Set(models.flatMap(({ runs }) => runs.map((run) => run.scenario)))];
  const byScenario = table(
    ["Scenario", ...models.map(({ candidate }) => candidate.name)],
    scenarios.map((scenario) => [
      scenario,
      ...models.map(({ runs }) => {
        const these = runs.filter((run) => run.scenario === scenario);
        return `${these.filter((run) => run.passed).length}/${these.length}`;
      }),
    ]),
  );
  return `${overview}\n\n${byScenario}\n`;
}

function table(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const line = (cells: readonly string[]) => `| ${cells.join(" | ")} |`;
  return [line(header), line(header.map(() => "---")), ...rows.map(line)].join("\n");
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
}

function percent(part: number, whole: number): string {
  return whole === 0 ? "0%" : `${Math.round((part / whole) * 100)}%`;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
