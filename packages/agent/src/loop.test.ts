import { describe, expect, test } from "vitest";
import type { Message } from "./llm.ts";
import { MAX_MODEL_CALLS, runLoop, type Tool } from "./loop.ts";
import { scriptedLlm } from "./testing/scripted-llm.ts";

const question: readonly Message[] = [{ role: "user", content: "When is my next event?" }];

/** A tool that records what it was called with and returns a fixed value. */
function fakeTool(name: string, value: unknown): Tool & { readonly calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    definition: { name, description: `The ${name} tool`, parameters: { type: "object" } },
    run(args) {
      calls.push(args);
      return Promise.resolve({ ok: true, value });
    },
  };
}

describe("runLoop", () => {
  test("a direct answer takes one model call", async () => {
    const llm = scriptedLlm([{ text: "It's 10:12 in Lisbon." }]);
    expect(await runLoop(llm, question, [])).toMatchObject({
      kind: "answer",
      text: "It's 10:12 in Lisbon.",
      steps: [],
    });
    expect(llm.requests).toHaveLength(1);
  });

  test("a requested tool runs, and its result goes back to the model", async () => {
    const nextEvent = fakeTool("get_next_event", { title: "Flight LIS → JFK" });
    const llm = scriptedLlm([
      { toolCalls: [{ name: "get_next_event", arguments: { kind: "flight" } }] },
      { text: "Your flight leaves tomorrow at 17:05." },
    ]);

    const result = await runLoop(llm, question, [nextEvent]);

    expect(nextEvent.calls).toEqual([{ kind: "flight" }]);
    expect(llm.requests[0]?.tools.map((tool) => tool.name)).toEqual(["get_next_event"]);
    expect(llm.requests[1]?.messages).toEqual([
      ...question,
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "call-1", name: "get_next_event", arguments: { kind: "flight" } }],
      },
      { role: "tool", toolCallId: "call-1", content: '{"title":"Flight LIS → JFK"}' },
    ]);
    expect(result).toMatchObject({ kind: "answer", text: "Your flight leaves tomorrow at 17:05." });
  });

  test("several tool calls in one reply all run, in order", async () => {
    const llm = scriptedLlm([
      {
        toolCalls: [
          { name: "first", arguments: {} },
          { name: "second", arguments: {} },
        ],
      },
      { text: "Done." },
    ]);

    await runLoop(llm, question, [fakeTool("first", 1), fakeTool("second", 2)]);

    expect(llm.requests[1]?.messages.slice(-2)).toEqual([
      { role: "tool", toolCallId: "call-1", content: "1" },
      { role: "tool", toolCallId: "call-2", content: "2" },
    ]);
  });

  test("an unknown tool is reported back, so the model can correct itself", async () => {
    const llm = scriptedLlm([
      { toolCalls: [{ name: "book_flight", arguments: {} }] },
      { text: "I can't book flights yet." },
    ]);

    await runLoop(llm, question, []);

    expect(llm.requests[1]?.messages.at(-1)).toEqual({
      role: "tool",
      toolCallId: "call-1",
      content: '{"error":"There is no tool called \\"book_flight\\"."}',
    });
  });

  test("a tool's refusal is reported back to the model", async () => {
    const picky: Tool = {
      definition: { name: "get_next_event", description: "", parameters: { type: "object" } },
      run: () => Promise.resolve({ ok: false, error: "kind: expected one of flight, train" }),
    };
    const llm = scriptedLlm([
      { toolCalls: [{ name: "get_next_event", arguments: { kind: "plane" } }] },
      { text: "Let me try again." },
    ]);

    await runLoop(llm, question, [picky]);

    expect(llm.requests[1]?.messages.at(-1)).toMatchObject({
      content: '{"error":"kind: expected one of flight, train"}',
    });
  });

  test(`gives up after ${MAX_MODEL_CALLS} model calls`, async () => {
    const forever = Array.from({ length: MAX_MODEL_CALLS + 1 }, () => ({
      toolCalls: [{ name: "get_next_event", arguments: {} }],
    }));
    const llm = scriptedLlm(forever);

    const result = await runLoop(llm, question, [fakeTool("get_next_event", {})]);

    expect(result.kind).toBe("gave_up");
    expect(llm.requests).toHaveLength(MAX_MODEL_CALLS);
  });

  test("token usage adds up across model calls", async () => {
    const llm = scriptedLlm([
      { toolCalls: [{ name: "get_next_event", arguments: {} }] },
      { text: "Tomorrow." },
    ]);
    const result = await runLoop(llm, question, [fakeTool("get_next_event", {})]);
    expect(result.usage).toEqual({ inputTokens: 200, outputTokens: 20 });
  });
});
