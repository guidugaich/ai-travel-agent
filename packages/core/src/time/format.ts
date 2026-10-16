import type { Temporal } from "temporal-polyfill";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MINUTES_PER_DAY = 24 * 60;

/** "17:05" */
export function formatClock(time: Temporal.ZonedDateTime): string {
  return `${pad(time.hour)}:${pad(time.minute)}`;
}

/** "Wed 14 Oct", plus the year when it isn't `today`'s year. */
export function formatDate(date: Temporal.PlainDate, today: Temporal.PlainDate): string {
  const text = `${pick(WEEKDAYS, date.dayOfWeek - 1)} ${String(date.day)} ${pick(MONTHS, date.month - 1)}`;
  return date.year === today.year ? text : `${text} ${String(date.year)}`;
}

/** "1 day, 6 h 53 min". Seconds are dropped and the sign is ignored; callers phrase "ago". */
export function formatDuration(duration: Temporal.Duration): string {
  const totalMinutes = Math.floor(Math.abs(duration.total({ unit: "minutes" })));
  const days = Math.floor(totalMinutes / MINUTES_PER_DAY);
  const hours = Math.floor((totalMinutes % MINUTES_PER_DAY) / 60);
  const minutes = totalMinutes % 60;

  const clock = [hours > 0 ? `${String(hours)} h` : "", minutes > 0 ? `${String(minutes)} min` : ""]
    .filter((part) => part !== "")
    .join(" ");
  if (days === 0) return clock === "" ? "0 min" : clock;

  const dayPart = `${String(days)} ${days === 1 ? "day" : "days"}`;
  return clock === "" ? dayPart : `${dayPart}, ${clock}`;
}

/** "America/New_York" → "New York" */
export function cityName(zone: string): string {
  const last = zone.split("/").at(-1) ?? zone;
  return last.replaceAll("_", " ");
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function pick<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new RangeError(`No item at index ${String(index)}`);
  return item;
}
