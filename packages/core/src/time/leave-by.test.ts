import { Temporal } from "temporal-polyfill";
import { describe, expect, test } from "vitest";
import { bufferMinutes, leaveBy, type LeaveByEvent } from "./leave-by.js";

const instant = (iso: string) => Temporal.Instant.from(iso);

// Wed 14 Oct 2026, 17:05 in Lisbon.
const flightToNewYork: LeaveByEvent = {
  kind: "flight",
  international: true,
  start: instant("2026-10-14T16:05:00Z"),
};

describe("leaveBy", () => {
  test("the walkthrough example: leave at 13:35 Lisbon, in 1 day 3 h 23 min", () => {
    const plan = leaveBy(flightToNewYork, 30, instant("2026-10-13T09:12:00Z"));
    expect(plan.leaveAt.toString()).toBe("2026-10-14T12:35:00Z");
    expect(plan.leaveAt.toZonedDateTimeISO("Europe/Lisbon").toPlainTime().toString()).toBe(
      "13:35:00",
    );
    expect(plan).toMatchObject({ bufferMinutes: 180, transitMinutes: 30, late: false });
    expect(plan.leaveIn.toString()).toBe("PT27H23M");
  });

  test("already late: says by how much", () => {
    const plan = leaveBy(flightToNewYork, 30, instant("2026-10-14T13:00:00Z"));
    expect(plan.late).toBe(true);
    expect(plan.leaveIn.toString()).toBe("-PT25M");
  });

  test("exactly on time is not late", () => {
    const plan = leaveBy(flightToNewYork, 30, instant("2026-10-14T12:35:00Z"));
    expect(plan.late).toBe(false);
    expect(plan.leaveIn.toString()).toBe("PT0S");
  });
});

describe("bufferMinutes: how early to be there", () => {
  const start = instant("2026-10-14T16:05:00Z");

  test.each<[LeaveByEvent, number]>([
    [{ kind: "flight", international: true, start }, 180],
    [{ kind: "flight", international: false, start }, 120],
    [{ kind: "ferry", start }, 45],
    [{ kind: "train", start }, 20],
    [{ kind: "bus", start }, 15],
    [{ kind: "stay", start }, 0],
    [{ kind: "activity", start }, 0],
    [{ kind: "call", start }, 0],
  ])("%o → %i min", (event, expected) => {
    expect(bufferMinutes(event)).toBe(expected);
  });
});
