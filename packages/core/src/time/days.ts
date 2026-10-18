import { Temporal } from "temporal-polyfill";

export type DayResolution =
  | { readonly kind: "date"; readonly date: Temporal.PlainDate }
  | {
      readonly kind: "ambiguous";
      readonly options: readonly [Temporal.PlainDate, Temporal.PlainDate];
    }
  | { readonly kind: "unrecognized"; readonly phrase: string };

export type RelativeDay = "today" | "tomorrow" | "yesterday";

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

// Before 04:00, "today" and "tomorrow" may still refer to the day the user hasn't slept on yet.
const AMBIGUOUS_BEFORE_HOUR = 4;

/** Turns "today", "tomorrow", a weekday name or "YYYY-MM-DD" into a date in `now`'s zone. */
export function resolveDay(phrase: string, now: Temporal.ZonedDateTime): DayResolution {
  const today = now.toPlainDate();
  const early = now.hour < AMBIGUOUS_BEFORE_HOUR;
  const normalized = phrase.trim().toLowerCase();

  if (normalized === "today") {
    return early ? ambiguous(today.subtract({ days: 1 }), today) : found(today);
  }
  if (normalized === "tomorrow") {
    const next = today.add({ days: 1 });
    return early ? ambiguous(today, next) : found(next);
  }

  const weekdayIndex = WEEKDAYS.indexOf(normalized);
  if (weekdayIndex >= 0) {
    const daysAhead = (weekdayIndex + 1 - today.dayOfWeek + 7) % 7;
    return daysAhead === 0
      ? ambiguous(today, today.add({ days: 7 }))
      : found(today.add({ days: daysAhead }));
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    try {
      return found(Temporal.PlainDate.from(normalized));
    } catch {
      // An impossible date such as 2026-02-30 falls through to "unrecognized".
    }
  }
  return { kind: "unrecognized", phrase };
}

export function relativeDayLabel(
  date: Temporal.PlainDate,
  today: Temporal.PlainDate,
): RelativeDay | null {
  switch (today.until(date, { largestUnit: "days" }).days) {
    case 0:
      return "today";
    case 1:
      return "tomorrow";
    case -1:
      return "yesterday";
    default:
      return null;
  }
}

function found(date: Temporal.PlainDate): DayResolution {
  return { kind: "date", date };
}

function ambiguous(first: Temporal.PlainDate, second: Temporal.PlainDate): DayResolution {
  return { kind: "ambiguous", options: [first, second] };
}
