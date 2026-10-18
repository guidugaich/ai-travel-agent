import { Temporal } from "temporal-polyfill";
import { describe, expect, test } from "vitest";
import { elapsed, toZoned, zonedAt, type WallTime } from "./time.js";

function instantOf(time: WallTime): Temporal.Instant {
  const result = toZoned(time);
  if (!result.ok) throw new Error(`expected a valid time, got ${result.error.kind}`);
  return result.value.toInstant();
}

describe("toZoned: wall time + zone → an exact moment", () => {
  test("a normal time", () => {
    expect(instantOf({ local: "2026-10-14T17:05", zone: "Europe/Lisbon" }).toString()).toBe(
      "2026-10-14T16:05:00Z",
    );
  });

  test("a time that doesn't exist (clocks spring forward) is refused", () => {
    expect(toZoned({ local: "2027-03-28T01:30", zone: "Europe/Lisbon" })).toEqual({
      ok: false,
      error: { kind: "nonexistent", local: "2027-03-28T01:30", zone: "Europe/Lisbon" },
    });
  });

  test("a time that happens twice (clocks fall back) is refused", () => {
    expect(toZoned({ local: "2026-10-25T01:30", zone: "Europe/Lisbon" })).toEqual({
      ok: false,
      error: { kind: "ambiguous", local: "2026-10-25T01:30", zone: "Europe/Lisbon" },
    });
  });

  test("an unknown zone is refused", () => {
    expect(toZoned({ local: "2026-10-14T17:05", zone: "Mars/Olympus" })).toEqual({
      ok: false,
      error: { kind: "invalid_zone", zone: "Mars/Olympus" },
    });
  });

  test("an invalid local time is refused", () => {
    expect(toZoned({ local: "2026-13-40T25:00", zone: "Europe/Lisbon" })).toEqual({
      ok: false,
      error: { kind: "invalid_local_time", local: "2026-13-40T25:00" },
    });
  });

  test("a zone whose rules changed: Mexico City has had no DST since 2022", () => {
    const result = toZoned({ local: "2027-04-10T12:00", zone: "America/Mexico_City" });
    expect(result.ok && result.value.offset).toBe("-06:00");
    expect(result.ok && result.value.toInstant().toString()).toBe("2027-04-10T18:00:00Z");
  });
});

describe("elapsed: real time between two moments", () => {
  test("a day across the fall-back change is 25 hours", () => {
    const from = instantOf({ local: "2026-10-24T12:00", zone: "Europe/Lisbon" });
    const to = instantOf({ local: "2026-10-25T12:00", zone: "Europe/Lisbon" });
    expect(elapsed(from, to).toString()).toBe("PT25H");
  });

  test("LIS → JFK takes 7 h 35 min", () => {
    const departs = instantOf({ local: "2026-10-14T17:05", zone: "Europe/Lisbon" });
    const arrives = instantOf({ local: "2026-10-14T19:40", zone: "America/New_York" });
    expect(elapsed(departs, arrives).toString()).toBe("PT7H35M");
  });

  test("overnight JFK → LIS in the week Europe and the US are out of sync", () => {
    const departs = instantOf({ local: "2026-10-26T18:30", zone: "America/New_York" });
    const arrives = instantOf({ local: "2026-10-27T06:15", zone: "Europe/Lisbon" });
    expect(elapsed(departs, arrives).toString()).toBe("PT7H45M");
  });

  test("westbound over the date line: lands at an earlier local time than it left", () => {
    const departs = instantOf({ local: "2026-11-02T21:00", zone: "Asia/Tokyo" });
    const arrives = instantOf({ local: "2026-11-02T09:00", zone: "Pacific/Honolulu" });
    expect(elapsed(departs, arrives).toString()).toBe("PT7H");
  });

  test("eastbound over the date line: lands the next local day", () => {
    const departs = instantOf({ local: "2026-11-03T13:00", zone: "Pacific/Honolulu" });
    const arrives = instantOf({ local: "2026-11-04T17:30", zone: "Asia/Tokyo" });
    expect(elapsed(departs, arrives).toString()).toBe("PT9H30M");
  });

  test("time until a future moment, and a negative duration for a past one", () => {
    const now = Temporal.Instant.from("2026-10-13T09:12:00Z");
    const departs = Temporal.Instant.from("2026-10-14T16:05:00Z");
    expect(elapsed(now, departs).toString()).toBe("PT30H53M");
    expect(elapsed(departs, now).toString()).toBe("-PT30H53M");
  });
});

describe("zonedAt: the same moment in different zones", () => {
  const now = Temporal.Instant.from("2026-10-13T09:12:00Z");

  test.each([
    ["Europe/Lisbon", "2026-10-13T10:12:00"],
    ["Asia/Kolkata", "2026-10-13T14:42:00"],
    ["Asia/Kathmandu", "2026-10-13T14:57:00"],
    ["Australia/Eucla", "2026-10-13T17:57:00"],
    ["Pacific/Chatham", "2026-10-13T22:57:00"],
    ["America/New_York", "2026-10-13T05:12:00"],
  ])("%s", (zone, expected) => {
    const result = zonedAt(now, zone);
    expect(result.ok && result.value.toPlainDateTime().toString()).toBe(expected);
  });

  test("an unknown zone is refused", () => {
    expect(zonedAt(now, "Mars/Olympus")).toEqual({
      ok: false,
      error: { kind: "invalid_zone", zone: "Mars/Olympus" },
    });
  });
});
