import { Temporal } from "temporal-polyfill";
import { describe, expect, test } from "vitest";
import { relativeDayLabel, resolveDay } from "./days.js";

const at = (iso: string) => Temporal.ZonedDateTime.from(iso);
const date = (iso: string) => Temporal.PlainDate.from(iso);

describe("resolveDay", () => {
  test("late evening: 'tomorrow' is simply the next day", () => {
    const now = at("2026-10-13T23:59[Europe/Lisbon]");
    expect(resolveDay("tomorrow", now)).toEqual({ kind: "date", date: date("2026-10-14") });
    expect(resolveDay("today", now)).toEqual({ kind: "date", date: date("2026-10-13") });
  });

  test("just after midnight: 'tomorrow' could mean either day, so ask", () => {
    const now = at("2026-10-14T00:30[Europe/Lisbon]");
    expect(resolveDay("tomorrow", now)).toEqual({
      kind: "ambiguous",
      options: [date("2026-10-14"), date("2026-10-15")],
    });
    expect(resolveDay("today", now)).toEqual({
      kind: "ambiguous",
      options: [date("2026-10-13"), date("2026-10-14")],
    });
  });

  test("the ambiguous window ends at 04:00", () => {
    expect(resolveDay("tomorrow", at("2026-10-14T03:59[Europe/Lisbon]")).kind).toBe("ambiguous");
    expect(resolveDay("tomorrow", at("2026-10-14T04:00[Europe/Lisbon]"))).toEqual({
      kind: "date",
      date: date("2026-10-15"),
    });
  });

  test("the user's zone decides: one moment is 00:30 in Lisbon but 19:30 in New York", () => {
    const instant = Temporal.Instant.from("2026-10-13T23:30:00Z");
    expect(resolveDay("tomorrow", instant.toZonedDateTimeISO("Europe/Lisbon")).kind).toBe(
      "ambiguous",
    );
    expect(resolveDay("tomorrow", instant.toZonedDateTimeISO("America/New_York"))).toEqual({
      kind: "date",
      date: date("2026-10-14"),
    });
  });

  test("a weekday name means its next occurrence", () => {
    const tuesday = at("2026-10-13T10:12[Europe/Lisbon]");
    expect(resolveDay("friday", tuesday)).toEqual({ kind: "date", date: date("2026-10-16") });
    expect(resolveDay("Monday", tuesday)).toEqual({ kind: "date", date: date("2026-10-19") });
  });

  test("the weekday that is today could mean today or next week, so ask", () => {
    const tuesday = at("2026-10-13T10:12[Europe/Lisbon]");
    expect(resolveDay("tuesday", tuesday)).toEqual({
      kind: "ambiguous",
      options: [date("2026-10-13"), date("2026-10-20")],
    });
  });

  test("an ISO date is taken as-is", () => {
    const now = at("2026-10-13T10:12[Europe/Lisbon]");
    expect(resolveDay("2026-10-20", now)).toEqual({ kind: "date", date: date("2026-10-20") });
  });

  test("anything else is unrecognized", () => {
    const now = at("2026-10-13T10:12[Europe/Lisbon]");
    expect(resolveDay("next week", now)).toEqual({ kind: "unrecognized", phrase: "next week" });
    expect(resolveDay("2026-02-30", now)).toEqual({ kind: "unrecognized", phrase: "2026-02-30" });
  });
});

describe("relativeDayLabel", () => {
  const today = date("2026-10-13");

  test.each([
    ["2026-10-13", "today"],
    ["2026-10-14", "tomorrow"],
    ["2026-10-12", "yesterday"],
    ["2026-10-15", null],
  ])("%s → %s", (iso, expected) => {
    expect(relativeDayLabel(date(iso), today)).toBe(expected);
  });

  test("works across a month boundary", () => {
    expect(relativeDayLabel(date("2026-11-01"), date("2026-10-31"))).toBe("tomorrow");
  });
});
