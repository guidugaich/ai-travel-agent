import { describe, expect, test } from "vitest";
import { unsupportedValues } from "./output-check.ts";

const leaveByResult = JSON.stringify({
  kind: "plan",
  event: "Flight LIS → JFK",
  leaveAt: { place: "Lisbon", localTime: "13:35", date: "Wed 14 Oct", relativeDay: "tomorrow" },
  leaveIn: "1 day, 3 h 23 min",
  startsIn: "1 day, 6 h 53 min",
  assumptions: [
    "30 min to the airport (your setting)",
    "at the airport 3 h before an international flight",
  ],
});

describe("unsupportedValues", () => {
  test("example 4's reply is fully backed by the leave-by result", () => {
    const reply =
      "Leave at 13:35 tomorrow (Wed 14 Oct), in 1 day, 3 h 23 min. That allows 30 min to the airport and 3 h before an international flight.";
    expect(unsupportedValues(reply, [leaveByResult])).toEqual([]);
  });

  test("a time that's in no source is reported", () => {
    expect(unsupportedValues("Leave at 13:30.", [leaveByResult])).toEqual(["13:30"]);
  });

  test("a duration counts only whole: part of a longer one isn't backed", () => {
    expect(unsupportedValues("Your flight is in 6 h.", [leaveByResult])).toEqual(["6 h"]);
  });

  test("a value written another way is reported, so the model copies it exactly", () => {
    expect(unsupportedValues("Leave at 1:35 pm, in 3 hours or 3h.", [leaveByResult])).toEqual([
      "1:35",
      "3 hours",
      "3h",
    ]);
  });

  test("the same day written in another order is accepted", () => {
    expect(unsupportedValues("On October 14th, or 14 Oct.", [leaveByResult])).toEqual([]);
  });

  test("relative days must come from a source too", () => {
    expect(unsupportedValues("Tomorrow, not tonight.", [leaveByResult])).toEqual(["tonight"]);
  });

  test("the clock inside a UTC timestamp isn't a source", () => {
    expect(unsupportedValues("It's 12:00.", ['{"now":"2026-10-13T09:12:00Z"}'])).toEqual(["12:00"]);
  });

  test("a reply without times or dates passes", () => {
    expect(unsupportedValues("Where are you right now?", [])).toEqual([]);
  });
});
