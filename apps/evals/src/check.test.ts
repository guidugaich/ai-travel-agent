import { describe, expect, test } from "vitest";
import { checkRun, type Expectations } from "./check.ts";

const leaveBy: Expectations = {
  tools: ["compute_leave_by"],
  contains: ["13:35", "1 day, 3 h 23 min"],
  excludes: [/1:35 pm/i],
};

const good = {
  reply: "Leave at 13:35 tomorrow, in 1 day, 3 h 23 min.",
  outcome: "answered",
  toolsCalled: ["get_next_event", "compute_leave_by"],
} as const;

describe("checkRun", () => {
  test("a run with the right tools and values passes", () => {
    expect(checkRun(leaveBy, good)).toEqual([]);
  });

  test("a run fixed by the output check's retry still passes", () => {
    expect(checkRun(leaveBy, { ...good, outcome: "corrected" })).toEqual([]);
  });

  test("each problem is named", () => {
    expect(
      checkRun(leaveBy, {
        reply: "Leave at 1:35 pm.",
        outcome: "fallback",
        toolsCalled: ["get_next_event"],
      }),
    ).toEqual([
      "outcome: fallback",
      "didn't call compute_leave_by",
      'missing "13:35"',
      'missing "1 day, 3 h 23 min"',
      "shouldn't match /1:35 pm/i",
    ]);
  });

  test("values are found when a model writes non-breaking spaces, as gpt-oss does", () => {
    const reply = "Which day do you mean: Wed 14 Oct or Thu 15 Oct?";
    expect(checkRun({ contains: ["Wed 14 Oct", "Thu 15 Oct"] }, { ...good, reply })).toEqual([]);
  });

  test("values are found whatever their case", () => {
    expect(checkRun({ contains: ["Lisbon"] }, { ...good, reply: "Keeping LISBON." })).toEqual([]);
  });
});
