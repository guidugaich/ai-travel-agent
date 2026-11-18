import type { Location, NewTrip } from "@ai-travel-agent/core";
import {
  setupDeps,
  sharedLisbon,
  testUser as user,
  usEastCoast,
} from "@ai-travel-agent/core/testing";
import { describe, expect, test } from "vitest";
import { handleMessage, type AgentDeps } from "./agent.ts";
import { MAX_MODEL_CALLS } from "./loop.ts";
import { memoryConversations } from "./testing/memory-conversations.ts";
import { lastToolResult, scriptedLlm, type ScriptStep } from "./testing/scripted-llm.ts";

const tokyoToHonolulu: NewTrip = {
  title: "Pacific",
  startDate: "2026-11-02",
  events: [
    {
      kind: "flight",
      title: "Flight NRT → HNL",
      start: { local: "2026-11-02T21:00", zone: "Asia/Tokyo" },
      end: { local: "2026-11-02T09:00", zone: "Pacific/Honolulu" },
      flight: { from: "NRT", to: "HNL", international: true },
    },
  ],
};

/** The spec's default setup (you shared Lisbon yesterday, a flight tomorrow), a fake model and history. */
async function setup(
  script: readonly ScriptStep[],
  options: { now?: string; locations?: readonly Location[]; trips?: readonly NewTrip[] } = {},
) {
  const { deps } = await setupDeps({
    user: { id: user, transitMinutes: { airport: 30 } },
    locations: [sharedLisbon],
    trips: [usEastCoast],
    ...options,
  });
  const llm = scriptedLlm(script);
  const conversations = memoryConversations();
  const agent: AgentDeps = { ...deps, llm, conversations };
  return { llm, conversations, ask: (text: string) => handleMessage(user, text, agent) };
}

const call = (name: string, args: unknown = {}) => ({ toolCalls: [{ name, arguments: args }] });

/** What the model was sent back from its tools, in the last request. */
function toolResults(llm: Awaited<ReturnType<typeof setup>>["llm"]): string[] {
  const messages = llm.requests.at(-1)?.messages ?? [];
  return messages.flatMap((message) => (message.role === "tool" ? [message.content] : []));
}

describe("the spec's examples, each with a reply the output check accepts", () => {
  test("1: what time is it? Answered from the preamble", async () => {
    const { ask, llm } = await setup([
      { text: "It's 10:12 in Lisbon, based on your shared location." },
    ]);
    expect(await ask("What time is it?")).toMatchObject({ outcome: "answered" });
    expect(llm.requests).toHaveLength(1);
  });

  test("2: what time is it in Kathmandu?", async () => {
    const { ask } = await setup([
      call("time_in_zone", { zone: "Asia/Kathmandu" }),
      { text: "It's 14:57 in Kathmandu." },
    ]);
    expect(await ask("What time is it in Kathmandu?")).toMatchObject({ outcome: "answered" });
  });

  test("3: when is my next event?", async () => {
    const reply =
      "Your flight LIS → JFK leaves tomorrow (Wed 14 Oct) at 17:05 Lisbon time and lands at 19:40 New York time, after 7 h 35 min. That's in 1 day, 6 h 53 min.";
    const { ask } = await setup([call("get_next_event", { kind: "any" }), { text: reply }]);
    expect(await ask("When is my next event?")).toEqual(
      expect.objectContaining({ outcome: "answered", text: reply }),
    );
  });

  test("4: when do I need to leave for it?", async () => {
    const { ask, llm } = await setup([
      call("get_next_event", { kind: "any" }),
      (request) =>
        call("compute_leave_by", { event_id: (lastToolResult(request) as { id: string }).id }),
      {
        text: "Leave at 13:35 tomorrow, in 1 day, 3 h 23 min. That allows 30 min to the airport and 3 h before an international flight.",
      },
    ]);
    expect(await ask("When do I need to leave for it?")).toMatchObject({ outcome: "answered" });
    expect(toolResults(llm).at(-1)).toContain('"localTime":"13:35"');
  });

  test("5: what you say doesn't override yesterday's shared location", async () => {
    const { ask, llm } = await setup([
      call("set_my_location", { zone: "Asia/Kathmandu", place_name: "Kathmandu" }),
      {
        text: "You shared your location in Lisbon recently, so I'm keeping Lisbon. If you've moved, share your location again.",
      },
    ]);
    expect(await ask("I'm in Kathmandu now")).toMatchObject({ outcome: "answered" });
    expect(toolResults(llm).at(-1)).toContain('"inEffect":false');
  });

  test("6: 'tomorrow' at 00:30 gets a question, not a guess", async () => {
    const { ask } = await setup(
      [
        call("events_on_day", { day: "tomorrow" }),
        { text: "Do you mean Wed 14 Oct or Thu 15 Oct?" },
      ],
      { now: "2026-10-13T23:30:00Z" },
    );
    expect(await ask("What's on tomorrow?")).toMatchObject({ outcome: "answered" });
  });

  test("7: with nothing known about your location, the bot asks", async () => {
    const { ask, llm } = await setup(
      [
        {
          text: "I don't know where you are yet. Where are you? You can also share your location.",
        },
      ],
      { locations: [] },
    );
    expect(await ask("What time is it?")).toMatchObject({ outcome: "answered" });
    expect(llm.requests[0]?.messages[0]?.content).toContain('"kind": "unknown"');
  });

  test("8: after landing, the trip says you're in New York", async () => {
    const { ask } = await setup([{ text: "It's 10:00 in New York, based on your trip." }], {
      now: "2026-10-15T14:00:00Z",
    });
    expect(await ask("What time is it?")).toMatchObject({ outcome: "answered" });
  });

  test("9: mid-flight, both local times", async () => {
    const { ask } = await setup(
      [{ text: "You're in flight: it's 21:00 in Lisbon and 16:00 in New York." }],
      { now: "2026-10-14T20:00:00Z" },
    );
    expect(await ask("What time is it?")).toMatchObject({ outcome: "answered" });
  });

  test("10: when does my flight land?", async () => {
    const { ask } = await setup(
      [
        call("get_next_event", { kind: "flight" }),
        { text: "It lands on Mon 2 Nov at 09:00 Honolulu time, after 7 h." },
      ],
      { trips: [tokyoToHonolulu] },
    );
    expect(await ask("When does my flight land?")).toMatchObject({ outcome: "answered" });
  });

  test("11: with no recent share, what you say is used", async () => {
    const { ask } = await setup(
      [
        call("set_my_location", { zone: "Asia/Kathmandu", place_name: "Kathmandu" }),
        { text: "Got it: you're in Kathmandu, where it's 14:57, based on what you said." },
      ],
      { locations: [] },
    );
    expect(await ask("I'm in Kathmandu now")).toMatchObject({ outcome: "answered" });
  });
});

describe("handleMessage", () => {
  test("the model gets the preamble, then recent history, then your message", async () => {
    const { ask, llm } = await setup([{ text: "Hello." }, { text: "It's 10:12 in Lisbon." }]);
    await ask("Hi");
    await ask("What time is it?");
    expect(llm.requests[1]?.messages.map((message) => message.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
    ]);
  });

  test("only your message and the reply are saved, not the tool calls", async () => {
    const { ask, conversations } = await setup([
      call("time_in_zone", { zone: "Asia/Kathmandu" }),
      { text: "It's 14:57 in Kathmandu." },
    ]);
    await ask("What time is it in Kathmandu?");
    expect(await conversations.recent(user)).toEqual([
      { role: "user", content: "What time is it in Kathmandu?" },
      { role: "assistant", content: "It's 14:57 in Kathmandu." },
    ]);
  });

  test("a value no tool gave triggers one retry, telling the model which", async () => {
    const { ask, llm } = await setup([
      call("get_next_event", { kind: "any" }),
      { text: "Your flight leaves at 17:00." },
      { text: "Your flight leaves at 17:05." },
    ]);
    expect(await ask("When is my flight?")).toEqual(
      expect.objectContaining({ outcome: "corrected", text: "Your flight leaves at 17:05." }),
    );
    expect(llm.requests[2]?.messages.at(-1)?.content).toContain("17:00");
  });

  test("if the retry is wrong too, the computed values are sent as they are", async () => {
    const { ask } = await setup([
      call("get_next_event", { kind: "any" }),
      { text: "Your flight leaves at 17:00." },
      { text: "Your flight leaves at 17:01." },
    ]);
    const reply = await ask("When is my flight?");
    expect(reply.outcome).toBe("fallback");
    expect(reply.text).toContain('"localTime": "17:05"');
  });

  test(`the retry shares the limit of ${MAX_MODEL_CALLS} model calls`, async () => {
    const { ask, llm } = await setup([
      ...Array.from({ length: MAX_MODEL_CALLS - 1 }, () => call("get_next_event", { kind: "any" })),
      { text: "Your flight leaves at 17:00." },
    ]);
    expect(await ask("When is my flight?")).toMatchObject({ outcome: "fallback" });
    expect(llm.requests).toHaveLength(MAX_MODEL_CALLS);
  });

  test("when the model runs out of calls, a fixed reply is sent", async () => {
    const { ask } = await setup(
      Array.from({ length: MAX_MODEL_CALLS }, () => call("get_next_event", { kind: "any" })),
    );
    expect(await ask("When is my flight?")).toMatchObject({
      outcome: "gave_up",
      usage: { inputTokens: 100 * MAX_MODEL_CALLS, outputTokens: 10 * MAX_MODEL_CALLS },
    });
  });
});
