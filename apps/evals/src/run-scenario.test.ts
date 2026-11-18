import { lastToolResult, scriptedLlm } from "@ai-travel-agent/agent/testing";
import { describe, expect, test } from "vitest";
import { runScenario } from "./run-scenario.ts";
import { SCENARIOS, type Scenario } from "./scenarios.ts";

function scenario(number: number): Scenario {
  const found = SCENARIOS.find((candidate) => candidate.name.startsWith(`${number}:`));
  if (found === undefined) throw new Error(`No scenario ${number}`);
  return found;
}

const call = (name: string, args: unknown = {}) => ({ toolCalls: [{ name, arguments: args }] });

describe("runScenario", () => {
  test("a good run passes, with its tool calls, tokens and conversation recorded", async () => {
    const llm = scriptedLlm([
      call("time_in_zone", { zone: "Asia/Kathmandu" }),
      { text: "It's 14:57 in Kathmandu." },
    ]);
    const run = await runScenario(scenario(2), llm);

    expect(run).toMatchObject({
      scenario: scenario(2).name,
      passed: true,
      failures: [],
      outcome: "answered",
      toolsCalled: ["time_in_zone"],
      usage: { inputTokens: 200, outputTokens: 20 },
    });
    expect(run.ms).toBeGreaterThanOrEqual(0);
    expect(run.transcript[0]?.role).toBe("system");
    expect(run.transcript.at(-1)).toMatchObject({ content: "It's 14:57 in Kathmandu." });
  });

  test("the scenario's world is set up, earlier messages included", async () => {
    const llm = scriptedLlm([
      call("get_next_event", { kind: "any" }),
      (request) =>
        call("be_there_by", { event_id: (lastToolResult(request) as { id: string }).id }),
      {
        text: "Be at the airport by 14:05 tomorrow, in 1 day, 3 h 53 min: at the airport 3 h before an international flight.",
      },
    ]);
    const run = await runScenario(scenario(4), llm);

    expect(run.failures).toEqual([]);
    expect(llm.requests[0]?.messages.map((message) => message.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
    ]);
  });

  test("a wrong reply fails, naming what's wrong", async () => {
    const llm = scriptedLlm([{ text: "I'm not sure." }]);
    const run = await runScenario(scenario(2), llm);
    expect(run).toMatchObject({
      passed: false,
      failures: ["didn't call time_in_zone", 'missing "14:57"'],
    });
  });

  test("a model error is a failed run, not a crash", async () => {
    const run = await runScenario(scenario(2), scriptedLlm([]));
    expect(run).toMatchObject({
      passed: false,
      outcome: "error",
      failures: ["error: The script has no reply for model call 1"],
    });
  });
});
