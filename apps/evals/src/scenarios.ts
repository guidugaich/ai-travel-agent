import type { ChatMessage } from "@ai-travel-agent/agent";
import type { Location, NewTrip } from "@ai-travel-agent/core";
import type { Expectations } from "./check.ts";

/** A scenario's frozen world. Anything left out is the spec's default (see run-scenario.ts). */
export interface World {
  readonly now?: string;
  readonly locations?: readonly Location[];
  readonly trips?: readonly NewTrip[];
}

export interface Scenario {
  readonly name: string;
  readonly world?: World;
  /** Earlier messages, for questions like "when do I need to leave for it?". */
  readonly history?: readonly ChatMessage[];
  readonly message: string;
  readonly expect: Expectations;
}

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

/** The slice 1 spec's examples 1–11, with what the reply must contain. */
export const SCENARIOS: readonly Scenario[] = [
  {
    name: "1: what time is it?",
    message: "What time is it?",
    expect: { contains: ["10:12", "Lisbon"] },
  },
  {
    name: "2: what time is it in Kathmandu?",
    message: "What time is it in Kathmandu?",
    expect: { tools: ["time_in_zone"], contains: ["14:57"] },
  },
  {
    name: "3: when is my next event?",
    message: "When is my next event?",
    expect: {
      tools: ["get_next_event"],
      contains: ["tomorrow", "Wed 14 Oct", "17:05", "19:40", "7 h 35 min", "1 day, 6 h 53 min"],
    },
  },
  {
    name: "4: when do I need to leave for it?",
    history: [
      { role: "user", content: "When is my next event?" },
      {
        role: "assistant",
        content:
          "Your next event is the flight LIS → JFK, tomorrow (Wed 14 Oct) at 17:05 Lisbon time.",
      },
    ],
    message: "When do I need to leave for it?",
    expect: {
      tools: ["compute_leave_by"],
      contains: ["13:35", "1 day, 3 h 23 min", "30 min", "3 h"],
    },
  },
  {
    name: "5: saying a place doesn't override a recent share",
    message: "I'm in Kathmandu now",
    expect: { tools: ["set_my_location"], contains: ["Lisbon", "share"] },
  },
  {
    name: "6: 'tomorrow' just after midnight",
    world: { now: "2026-10-13T23:30:00Z" },
    message: "What's on tomorrow?",
    expect: {
      tools: ["events_on_day"],
      contains: ["Wed 14 Oct", "Thu 15 Oct"],
      excludes: [/17:05/],
    },
  },
  {
    name: "7: nothing known about your location",
    world: { locations: [] },
    message: "What time is it?",
    expect: { contains: ["where", "share"], excludes: [/\d{1,2}:\d{2}/] },
  },
  {
    name: "8: after landing, from your trip",
    world: { now: "2026-10-15T14:00:00Z" },
    message: "What time is it?",
    expect: { contains: ["10:00", "New York", "trip"] },
  },
  {
    name: "9: mid-flight",
    world: { now: "2026-10-14T20:00:00Z" },
    message: "What time is it?",
    expect: { contains: ["21:00", "16:00"] },
  },
  {
    name: "10: when does my flight land?",
    world: { trips: [tokyoToHonolulu] },
    message: "When does my flight land?",
    expect: { tools: ["get_next_event"], contains: ["Mon 2 Nov", "09:00", "Honolulu", "7 h"] },
  },
  {
    name: "11: saying a place with no recent share",
    world: { locations: [] },
    message: "I'm in Kathmandu now",
    expect: { tools: ["set_my_location"], contains: ["Kathmandu", "14:57", "said"] },
  },
];
