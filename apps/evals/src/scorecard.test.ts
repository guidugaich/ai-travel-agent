import { describe, expect, test } from "vitest";
import type { Candidate } from "./candidates.ts";
import type { RunResult } from "./run-scenario.ts";
import { scorecard, summarize } from "./scorecard.ts";

const local: Candidate = { name: "local-a", baseUrl: "http://localhost:11434/v1", model: "a" };
const hosted: Candidate = {
  name: "hosted-b",
  baseUrl: "https://llm.example/v1",
  model: "b",
  apiKeyEnv: "B_API_KEY",
  price: { inputPerMillion: 1, outputPerMillion: 4 },
  dataTerms: "EU, no training",
};

function run(
  scenario: string,
  passed: boolean,
  outcome: RunResult["outcome"],
  ms: number,
): RunResult {
  return {
    scenario,
    passed,
    failures: passed ? [] : ['missing "13:35"'],
    reply: "",
    outcome,
    toolsCalled: [],
    usage: { inputTokens: 3000, outputTokens: 100 },
    ms,
    transcript: [],
  };
}

const runs = [
  run("1: what time is it?", true, "answered", 1000),
  run("1: what time is it?", true, "corrected", 3000),
  run("2: what time is it in Kathmandu?", false, "fallback", 2000),
];

describe("summarize", () => {
  test("pass rate, first-try passes, median time, tokens and cost per conversation", () => {
    expect(summarize(hosted, runs)).toEqual({
      name: "hosted-b",
      passed: 2,
      total: 3,
      firstTry: 1,
      medianMs: 2000,
      tokensPerConversation: 3100,
      costPerConversation: 0.0034,
      dataTerms: "EU, no training",
    });
  });

  test("a model without a price has no cost", () => {
    expect(summarize(local, runs).costPerConversation).toBeNull();
  });
});

describe("scorecard", () => {
  test("one row per model, then each scenario's pass rate per model", () => {
    const card = scorecard([
      { candidate: hosted, runs },
      { candidate: local, runs },
    ]);
    expect(card).toContain(
      "| hosted-b | 2/3 (67%) | 1/3 | 2.0 s | 3,100 | $0.0034 | EU, no training |",
    );
    expect(card).toContain("| local-a | 2/3 (67%) | 1/3 | 2.0 s | 3,100 | — | — |");
    expect(card).toContain("| 1: what time is it? | 2/2 | 2/2 |");
    expect(card).toContain("| 2: what time is it in Kathmandu? | 0/1 | 0/1 |");
  });
});
