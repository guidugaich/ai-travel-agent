import { EVENT_KINDS, type Location, type NewTrip } from "@ai-travel-agent/core";
import {
  setupDeps,
  sharedLisbon,
  testUser as user,
  usEastCoast,
} from "@ai-travel-agent/core/testing";
import { describe, expect, test } from "vitest";
import { createTools } from "./tools.ts";

/** The spec's default setup: you shared Lisbon yesterday, a flight tomorrow, 30 min to the airport. */
async function setup(
  options: { now?: string; locations?: readonly Location[]; trips?: readonly NewTrip[] } = {},
) {
  const { deps } = await setupDeps({
    user: { id: user, transitMinutes: { airport: 30 } },
    locations: [sharedLisbon],
    trips: [usEastCoast],
    ...options,
  });
  const tools = createTools(user, deps);
  return {
    tools,
    call: (name: string, args: unknown) => {
      const tool = tools.find((candidate) => candidate.definition.name === name);
      if (tool === undefined) throw new Error(`No tool called ${name}`);
      return tool.run(args);
    },
  };
}

describe("the tools the model sees", () => {
  test("five tools, each described, with a JSON Schema for its arguments", async () => {
    const { tools } = await setup();
    expect(tools.map((tool) => tool.definition.name)).toEqual([
      "time_in_zone",
      "set_my_location",
      "get_next_event",
      "events_on_day",
      "compute_leave_by",
    ]);
    expect(tools.every((tool) => tool.definition.description.length > 20)).toBe(true);
    expect(tools[2]?.definition.parameters).toMatchObject({
      type: "object",
      properties: { kind: { enum: [...EVENT_KINDS] } },
      additionalProperties: false,
    });
  });

  test("arguments that don't match are refused, saying what's wrong", async () => {
    const { call } = await setup();
    const result = await call("compute_leave_by", { transit_minutes: -5 });
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toMatch(/event_id[\s\S]*transit_minutes/);
  });
});

describe("each tool calls its core service", () => {
  test("time_in_zone (example 2)", async () => {
    const { call } = await setup();
    expect(await call("time_in_zone", { zone: "Asia/Kathmandu" })).toMatchObject({
      ok: true,
      value: { place: "Kathmandu", localTime: "14:57", localDate: "Tue 13 Oct" },
    });
  });

  test("time_in_zone refuses an unknown zone, so the model can try again", async () => {
    const { call } = await setup();
    expect(await call("time_in_zone", { zone: "Mars/Olympus" })).toEqual({
      ok: false,
      error: '"Mars/Olympus" isn\'t an IANA timezone. Use a name such as Asia/Kathmandu.',
    });
  });

  test("set_my_location stores what you said (example 11)", async () => {
    const { call } = await setup({ locations: [] });
    expect(
      await call("set_my_location", { zone: "Asia/Kathmandu", place_name: "Kathmandu" }),
    ).toMatchObject({
      ok: true,
      value: { inEffect: true, current: { place: "Kathmandu", basis: "user_said" } },
    });
  });

  test("get_next_event, for a kind (example 10's 'my flight')", async () => {
    const { call } = await setup();
    expect(await call("get_next_event", { kind: "flight" })).toMatchObject({
      ok: true,
      value: { title: "Flight LIS → JFK", start: { localTime: "17:05" } },
    });
  });

  test("events_on_day passes your word for the day through (example 6)", async () => {
    const { call } = await setup({ now: "2026-10-13T23:30:00Z" });
    expect(await call("events_on_day", { day: "tomorrow" })).toEqual({
      ok: true,
      value: { kind: "ambiguous", options: ["Wed 14 Oct", "Thu 15 Oct"] },
    });
  });

  test("compute_leave_by, with the id from get_next_event (example 4)", async () => {
    const { call } = await setup();
    const next = await call("get_next_event", {});
    const { id } = (next.ok ? next.value : {}) as { id?: string };

    expect(await call("compute_leave_by", { event_id: id })).toMatchObject({
      ok: true,
      value: { kind: "plan", leaveAt: { localTime: "13:35" }, leaveIn: "1 day, 3 h 23 min" },
    });
  });
});
