import { Temporal } from "temporal-polyfill";
import type { EventKind, TripEvent, User, UserId } from "./domain.ts";
import { locate } from "./location.ts";
import type { Deps } from "./ports.ts";
import { relativeDayLabel, resolveDay, type RelativeDay } from "./time/days.ts";
import {
  cityName,
  formatClock,
  formatDate,
  formatDuration,
  formatLeaveAssumptions,
  type TravelTimeSource,
} from "./time/format.ts";
import { leaveBy } from "./time/leave-by.ts";
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

export type LeaveByAnswer =
  | {
      readonly kind: "plan";
      readonly event: string;
      readonly leaveAt: EventTime;
      /** Time until leaving or, when `late`, how late. */
      readonly leaveIn: string;
      readonly late: boolean;
      readonly startsIn: string | null;
      readonly assumptions: readonly string[];
    }
  | { readonly kind: "need_transit_time"; readonly event: string }
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

/** When to leave for an event. `transitMinutes` is a travel time the user just gave, if any. */
export async function computeLeaveBy(
  userId: UserId,
  eventId: string,
  transitMinutes: number | undefined,
  deps: Deps,
): Promise<LeaveByAnswer> {
  const [{ now, today, schedule }, user] = await Promise.all([
    load(userId, deps),
    deps.repo.getUser(userId),
  ]);
  const found = schedule.find(({ event }) => event.id === eventId);
  if (found === undefined) return { kind: "not_found" };

  const { event, start } = found;
  const travel = travelTime(event, transitMinutes, user);
  if (travel === null) return { kind: "need_transit_time", event: event.title };

  const plan = leaveBy({ ...event, start: start.toInstant() }, travel.minutes, now);
  return {
    kind: "plan",
    event: event.title,
    leaveAt: eventTime(plan.leaveAt.toZonedDateTimeISO(start.timeZoneId), today),
    leaveIn: formatDuration(plan.leaveIn),
    late: plan.late,
    startsIn: startsIn(start, now),
    assumptions: formatLeaveAssumptions(event, travel, plan.bufferMinutes),
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

function travelTime(
  event: TripEvent,
  given: number | undefined,
  user: User | null,
): { readonly minutes: number; readonly source: TravelTimeSource } | null {
  if (given !== undefined) return { minutes: given, source: "you_told_me" };
  if (event.transitMinutes !== undefined) return { minutes: event.transitMinutes, source: "event" };
  const setting =
    event.kind === "flight" ? user?.transitMinutes.airport : user?.transitMinutes.other;
  return setting === undefined ? null : { minutes: setting, source: "setting" };
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
