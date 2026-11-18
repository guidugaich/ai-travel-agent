import { Temporal } from "temporal-polyfill";
import type { EventKind, TripEvent, UserId } from "./domain.ts";
import { locate } from "./location.ts";
import type { Deps } from "./ports.ts";
import { relativeDayLabel, resolveDay, type RelativeDay } from "./time/days.ts";
import {
  cityName,
  formatClock,
  formatDate,
  formatBufferRule,
  formatDuration,
} from "./time/format.ts";
import { beThereBy as planBeThereBy } from "./time/be-there-by.ts";
import { elapsed, zonedOrThrow } from "./time/time.ts";
import { userToday, userZone } from "./whereabouts.ts";

/** A moment in its own zone, ready to say. `relativeDay` is relative to the user's today. */
export interface EventTime {
  readonly place: string;
  readonly zone: string;
  readonly localTime: string;
  readonly date: string;
  readonly relativeDay: RelativeDay | null;
}

export interface EventView {
  readonly id: string;
  readonly title: string;
  readonly kind: EventKind;
  readonly start: EventTime;
  readonly end: EventTime | null;
  readonly duration: string | null;
  /** Null once the event has started. */
  readonly startsIn: string | null;
}

export type DayEvents =
  | {
      readonly kind: "events";
      readonly date: string;
      readonly relativeDay: RelativeDay | null;
      readonly events: readonly EventView[];
    }
  | { readonly kind: "ambiguous"; readonly options: readonly [string, string] }
  | { readonly kind: "unrecognized"; readonly phrase: string }
  | { readonly kind: "unknown_location" };

export type BeThereByAnswer =
  | {
      readonly kind: "plan";
      readonly event: string;
      readonly beThereBy: EventTime;
      /** Time until then or, when `late`, how late. */
      readonly timeUntil: string;
      readonly late: boolean;
      readonly startsIn: string | null;
      /** "at the airport 3 h before an international flight", or null for events with no rule. */
      readonly rule: string | null;
    }
  | { readonly kind: "not_found" };

interface Scheduled {
  readonly event: TripEvent;
  readonly start: Temporal.ZonedDateTime;
}

/** The next event to start, or the next of one kind ("my flight"). */
export async function getNextEvent(
  userId: UserId,
  kind: EventKind | undefined,
  deps: Deps,
): Promise<EventView | null> {
  const { now, today, schedule } = await load(userId, deps);
  const next = schedule.find(
    ({ event, start }) =>
      (kind === undefined || event.kind === kind) &&
      Temporal.Instant.compare(start.toInstant(), now) > 0,
  );
  return next === undefined ? null : view(next, now, today);
}

/** The events starting on "today", "tomorrow", a weekday or a YYYY-MM-DD date. */
export async function eventsOnDay(userId: UserId, day: string, deps: Deps): Promise<DayEvents> {
  const { now, whereabouts, today, schedule } = await load(userId, deps);
  const zone = userZone(whereabouts);
  if (zone === null) return { kind: "unknown_location" };

  const resolved = resolveDay(day, now.toZonedDateTimeISO(zone));
  switch (resolved.kind) {
    case "unrecognized":
      return resolved;
    case "ambiguous": {
      const [first, second] = resolved.options;
      return { kind: "ambiguous", options: [formatDate(first, today), formatDate(second, today)] };
    }
    case "date": {
      const { date } = resolved;
      return {
        kind: "events",
        date: formatDate(date, today),
        relativeDay: relativeDayLabel(date, today),
        events: schedule
          .filter(({ start }) => start.toPlainDate().equals(date))
          .map((scheduled) => view(scheduled, now, today)),
      };
    }
  }
}

/** When to be at an event: its start minus a rule per event type. Travel time is never guessed. */
export async function beThereBy(
  userId: UserId,
  eventId: string,
  deps: Deps,
): Promise<BeThereByAnswer> {
  const { now, today, schedule } = await load(userId, deps);
  const found = schedule.find(({ event }) => event.id === eventId);
  if (found === undefined) return { kind: "not_found" };

  const { event, start } = found;
  const plan = planBeThereBy({ ...event, start: start.toInstant() }, now);
  return {
    kind: "plan",
    event: event.title,
    beThereBy: eventTime(plan.at.toZonedDateTimeISO(start.timeZoneId), today),
    timeUntil: formatDuration(plan.until),
    late: plan.late,
    startsIn: startsIn(start, now),
    rule: formatBufferRule(event, plan.bufferMinutes),
  };
}

/** Now, the user's today, and all their events in start order. */
async function load(userId: UserId, deps: Deps) {
  const now = deps.clock.now();
  const { whereabouts, trips } = await locate(userId, now, deps);
  const schedule: Scheduled[] = trips
    .flatMap((trip) => trip.events)
    .map((event) => ({ event, start: zonedOrThrow(event.start) }))
    .sort((a, b) => Temporal.ZonedDateTime.compare(a.start, b.start));
  return { now, whereabouts, today: userToday(whereabouts, now), schedule };
}

function view({ event, start }: Scheduled, now: Temporal.Instant, today: Temporal.PlainDate) {
  const end = event.end === undefined ? null : zonedOrThrow(event.end);
  return {
    id: event.id,
    title: event.title,
    kind: event.kind,
    start: eventTime(start, today),
    end: end === null ? null : eventTime(end, today),
    duration: end === null ? null : formatDuration(elapsed(start.toInstant(), end.toInstant())),
    startsIn: startsIn(start, now),
  } satisfies EventView;
}

function eventTime(time: Temporal.ZonedDateTime, today: Temporal.PlainDate): EventTime {
  const date = time.toPlainDate();
  return {
    place: cityName(time.timeZoneId),
    zone: time.timeZoneId,
    localTime: formatClock(time),
    date: formatDate(date, today),
    relativeDay: relativeDayLabel(date, today),
  };
}

function startsIn(start: Temporal.ZonedDateTime, now: Temporal.Instant): string | null {
  const until = elapsed(now, start.toInstant());
  return until.sign > 0 ? formatDuration(until) : null;
}
