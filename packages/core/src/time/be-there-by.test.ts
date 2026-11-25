import { Temporal } from "temporal-polyfill";
import { describe, expect, test } from "vitest";
import { beThereBy, bufferMinutes, type BeThereByEvent } from "./be-there-by.ts";

const instant = (iso: string) => Temporal.Instant.from(iso);

// Wed 14 Oct 2026, 17:05 in Lisbon.
const flightToNewYork: BeThereByEvent = {
  kind: "flight",
  flight: { international: true },
  start: instant("2026-10-14T16:05:00Z"),
};

describe("beThereBy", () => {
  test("the walkthrough example: be at the airport by 14:05 Lisbon, in 1 day 3 h 53 min", () => {
    const plan = beThereBy(flightToNewYork, instant("2026-10-13T09:12:00Z"));
    expect(plan.at.toString()).toBe("2026-10-14T13:05:00Z");
    expect(plan.at.toZonedDateTimeISO("Europe/Lisbon").toPlainTime().toString()).toBe("14:05:00");
    expect(plan).toMatchObject({ bufferMinutes: 180, late: false });
    expect(plan.until.toString()).toBe("PT27H53M");
  });

  test("already late: says by how much", () => {
    const plan = beThereBy(flightToNewYork, instant("2026-10-14T13:30:00Z"));
    expect(plan.late).toBe(true);
    expect(plan.until.toString()).toBe("-PT25M");
  });

  test("exactly on time is not late", () => {
    const plan = beThereBy(flightToNewYork, instant("2026-10-14T13:05:00Z"));
    expect(plan.late).toBe(false);
    expect(plan.until.toString()).toBe("PT0S");
  });
});

describe("bufferMinutes: how early to be there", () => {
  const start = instant("2026-10-14T16:05:00Z");

  test.each<[BeThereByEvent, number]>([
    [{ kind: "flight", flight: { international: true }, start }, 180],
    [{ kind: "flight", flight: { international: false }, start }, 120],
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
