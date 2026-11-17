import type { AgentReply } from "@ai-travel-agent/agent";

/** What a scenario requires of the model's reply. */
export interface Expectations {
  /** Tools that must be called at least once. */
  readonly tools?: readonly string[];
  /** Values the reply must contain, ignoring case. */
  readonly contains?: readonly string[];
  /** Patterns the reply must not match, such as a time when it should have asked. */
  readonly excludes?: readonly RegExp[];
}

export interface RunOutcome {
  readonly reply: string;
  readonly outcome: AgentReply["outcome"];
  readonly toolsCalled: readonly string[];
}

/** Everything wrong with one run; an empty list means it passed. */
export function checkRun(expect: Expectations, run: RunOutcome): string[] {
  const failures: string[] = [];
  if (run.outcome === "fallback" || run.outcome === "gave_up") {
    failures.push(`outcome: ${run.outcome}`);
  }
  for (const tool of expect.tools ?? []) {
    if (!run.toolsCalled.includes(tool)) failures.push(`didn't call ${tool}`);
  }
  const reply = run.reply.toLowerCase();
  for (const value of expect.contains ?? []) {
    if (!reply.includes(value.toLowerCase())) failures.push(`missing "${value}"`);
  }
  for (const pattern of expect.excludes ?? []) {
    if (pattern.test(run.reply)) failures.push(`shouldn't match ${String(pattern)}`);
  }
  return failures;
}
