import { Temporal } from "temporal-polyfill";
import type { EventKind } from "../domain.ts";

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

/** Where a travel time came from: given in this conversation, stored on the event, or the user's setting. */
export type TravelTimeSource = "you_told_me" | "event" | "setting";

const SOURCES: Record<TravelTimeSource, string> = {
  you_told_me: "you told me",
  event: "set for this event",
  setting: "your setting",
};

const DESTINATIONS: Record<EventKind, string | null> = {
  flight: "the airport",
  train: "the station",
  bus: "the bus stop",
  ferry: "the port",
  stay: null,
  activity: null,
  call: null,
};

/** "17:05" */
export function formatClock(time: Temporal.ZonedDateTime): string {
  return `${pad(time.hour)}:${pad(time.minute)}`;
}

/** "Wed 14 Oct", plus the year when it isn't `today`'s year. */
export function formatDate(date: Temporal.PlainDate, today: Temporal.PlainDate): string {
  const text = `${pick(WEEKDAYS, date.dayOfWeek - 1)} ${date.day} ${pick(MONTHS, date.month - 1)}`;
  return date.year === today.year ? text : `${text} ${date.year}`;
}

/** "1 day, 6 h 53 min". Seconds are dropped and the sign is ignored; callers phrase "ago". */
export function formatDuration(duration: Temporal.Duration): string {
  const totalMinutes = Math.floor(Math.abs(duration.total({ unit: "minutes" })));
  const days = Math.floor(totalMinutes / MINUTES_PER_DAY);
  const hours = Math.floor((totalMinutes % MINUTES_PER_DAY) / 60);
  const minutes = totalMinutes % 60;

  const clock = [hours > 0 ? `${hours} h` : "", minutes > 0 ? `${minutes} min` : ""]
    .filter((part) => part !== "")
    .join(" ");
  if (days === 0) return clock === "" ? "0 min" : clock;

  const dayPart = `${days} ${days === 1 ? "day" : "days"}`;
  return clock === "" ? dayPart : `${dayPart}, ${clock}`;
}

/** "30 min to the airport (your setting)", "at the airport 3 h before an international flight" */
export function formatLeaveAssumptions(
  event: { readonly kind: EventKind; readonly flight?: { readonly international: boolean } },
  travel: { readonly minutes: number; readonly source: TravelTimeSource },
  bufferMinutes: number,
): string[] {
  const destination = DESTINATIONS[event.kind];
  const way = destination === null ? "to get there" : `to ${destination}`;
  const travelLine = `${formatMinutes(travel.minutes)} ${way} (${SOURCES[travel.source]})`;
  if (destination === null || bufferMinutes === 0) return [travelLine];

  const departure =
    event.kind !== "flight"
      ? `the ${event.kind}`
      : event.flight?.international === true
        ? "an international flight"
        : "a domestic flight";
  return [travelLine, `at ${destination} ${formatMinutes(bufferMinutes)} before ${departure}`];
}

/** "America/New_York" → "New York"; at sea, "Etc/GMT+3" → "UTC-03:00" */
export function cityName(zone: string): string {
  if (zone.startsWith("Etc/")) {
    // Fixed offset, no daylight saving, so any moment gives it. The name's sign is inverted.
    const { offset } = Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(zone);
    return offset === "+00:00" ? "UTC" : `UTC${offset}`;
  }
  const last = zone.split("/").at(-1) ?? zone;
  return last.replaceAll("_", " ");
}

function formatMinutes(minutes: number): string {
  return formatDuration(Temporal.Duration.from({ minutes }));
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function pick<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new RangeError(`No item at index ${index}`);
  return item;
}
