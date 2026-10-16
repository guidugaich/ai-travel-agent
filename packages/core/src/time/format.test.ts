import { Temporal } from "temporal-polyfill";
import { describe, expect, test } from "vitest";
import { cityName, formatClock, formatDate, formatDuration } from "./format.js";

describe("formatDuration", () => {
  test.each([
    ["PT7H35M", "7 h 35 min"],
    ["PT30H53M", "1 day, 6 h 53 min"],
    ["PT25H", "1 day, 1 h"],
    ["PT24H", "1 day"],
    ["PT48H5M", "2 days, 5 min"],
    ["PT45M", "45 min"],
    ["PT0S", "0 min"],
    ["PT1H0M59S", "1 h"],
    ["-PT2H35M", "2 h 35 min"],
  ])("%s → %s", (iso, expected) => {
    expect(formatDuration(Temporal.Duration.from(iso))).toBe(expected);
  });
});

describe("formatClock", () => {
  test("24-hour, zero-padded", () => {
    expect(formatClock(Temporal.ZonedDateTime.from("2026-11-02T09:00[Pacific/Honolulu]"))).toBe(
      "09:00",
    );
    expect(formatClock(Temporal.ZonedDateTime.from("2026-10-14T17:05[Europe/Lisbon]"))).toBe(
      "17:05",
    );
  });
});

describe("formatDate", () => {
  const today = Temporal.PlainDate.from("2026-10-13");

  test("this year: weekday, day and month", () => {
    expect(formatDate(Temporal.PlainDate.from("2026-10-14"), today)).toBe("Wed 14 Oct");
  });

  test("another year: the year is added", () => {
    expect(formatDate(Temporal.PlainDate.from("2027-03-28"), today)).toBe("Sun 28 Mar 2027");
  });
});

describe("cityName", () => {
  test.each([
    ["Europe/Lisbon", "Lisbon"],
    ["America/New_York", "New York"],
    ["America/Argentina/Buenos_Aires", "Buenos Aires"],
    ["UTC", "UTC"],
  ])("%s → %s", (zone, expected) => {
    expect(cityName(zone)).toBe(expected);
  });
});
