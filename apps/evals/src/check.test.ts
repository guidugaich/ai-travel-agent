import { describe, expect, test } from "vitest";
import { checkRun, type Expectations } from "./check.ts";

const leaveBy: Expectations = {
  tools: ["be_there_by"],
  contains: ["14:05", "1 day, 3 h 53 min"],
  excludes: [/2:05 pm/i],
};

const good = {
  reply: "Be there by 14:05 tomorrow, in 1 day, 3 h 53 min.",
  outcome: "answered",
  toolsCalled: ["get_next_event", "be_there_by"],
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
        reply: "Be there by 2:05 pm.",
        outcome: "fallback",
        toolsCalled: ["get_next_event"],
      }),
    ).toEqual([
      "outcome: fallback",
      "didn't call be_there_by",
      'missing "14:05"',
      'missing "1 day, 3 h 53 min"',
      "shouldn't match /2:05 pm/i",
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
