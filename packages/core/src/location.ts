import { Temporal } from "temporal-polyfill";
import type { Location, Trip, UserId } from "./domain.js";
import type { Deps } from "./ports.js";
import { cityName, formatClock, formatDate } from "./time/format.js";
import { zonedAt, type Result, type TimeError } from "./time/time.js";
import { resolveWhereabouts, type Whereabouts } from "./whereabouts.js";

/** A zone's current local time, ready to say. */
export interface PlaceTime {
  readonly place: string;
  readonly zone: string;
  readonly localTime: string;
}

export interface ZoneTime extends PlaceTime {
  readonly localDate: string;
}

/** Where the user is, ready to say. */
export type WhereaboutsView =
  | {
      readonly kind: "known";
      readonly place: string;
      readonly zone: string;
      readonly localTime: string;
      readonly localDate: string;
      readonly basis: "shared_location" | "user_said" | "trip";
      readonly confidence: "high" | "medium";
    }
  | {
      readonly kind: "in_transit";
      readonly event: string;
      readonly from: PlaceTime;
      readonly to: PlaceTime;
    }
  | { readonly kind: "unknown" };

/** What the agent's preamble is built from on every turn. */
export interface Context {
  readonly now: string;
  readonly whereabouts: WhereaboutsView;
  readonly activeTrip: string | null;
}

export async function currentContext(userId: UserId, deps: Deps): Promise<Context> {
  const now = deps.clock.now();
  const { whereabouts, trips } = await locate(userId, now, deps);
  return {
    now: now.toString(),
    whereabouts: describe(whereabouts, now),
    activeTrip: activeTrip(trips, localDate(whereabouts, now)),
  };
}

export function timeInZone(zone: string, deps: Deps): Result<ZoneTime, TimeError> {
  const zoned = zonedAt(deps.clock.now(), zone);
  if (!zoned.ok) return zoned;
  const date = zoned.value.toPlainDate();
  return {
    ok: true,
    value: {
      place: cityName(zone),
      zone,
      localTime: formatClock(zoned.value),
      localDate: formatDate(date, date),
    },
  };
}

/** Stores a shared location or something the user said, and reports whether it now applies. */
export async function setLocation(
  userId: UserId,
  input: { readonly zone: string; readonly placeName: string; readonly source: Location["source"] },
  deps: Deps,
): Promise<Result<{ readonly inEffect: boolean; readonly current: WhereaboutsView }, TimeError>> {
  const now = deps.clock.now();
  const zoned = zonedAt(now, input.zone);
  if (!zoned.ok) return zoned;

  await deps.repo.setLocation(userId, { ...input, setAt: now });
  const { whereabouts } = await locate(userId, now, deps);
  const inEffect =
    whereabouts.kind === "known" &&
    whereabouts.basis === input.source &&
    whereabouts.since.equals(now);
  return { ok: true, value: { inEffect, current: describe(whereabouts, now) } };
}

async function locate(userId: UserId, now: Temporal.Instant, deps: Deps) {
  const [locations, trips] = await Promise.all([
    deps.repo.getLocations(userId),
    deps.repo.getTrips(userId),
  ]);
  return { whereabouts: resolveWhereabouts(now, locations, trips), trips };
}

function describe(whereabouts: Whereabouts, now: Temporal.Instant): WhereaboutsView {
  switch (whereabouts.kind) {
    case "known": {
      const local = now.toZonedDateTimeISO(whereabouts.zone);
      return {
        kind: "known",
        place: whereabouts.placeName,
        zone: whereabouts.zone,
        localTime: formatClock(local),
        localDate: formatDate(local.toPlainDate(), local.toPlainDate()),
        basis: whereabouts.basis,
        confidence: whereabouts.confidence,
      };
    }
    case "in_transit":
      return {
        kind: "in_transit",
        event: whereabouts.event.title,
        from: placeTime(whereabouts.fromZone, now),
        to: placeTime(whereabouts.toZone, now),
      };
    case "unknown":
      return { kind: "unknown" };
  }
}

function placeTime(zone: string, now: Temporal.Instant): PlaceTime {
  return { place: cityName(zone), zone, localTime: formatClock(now.toZonedDateTimeISO(zone)) };
}

/** The user's calendar date: in their zone, the departure zone in transit, or UTC if unknown. */
function localDate(whereabouts: Whereabouts, now: Temporal.Instant): Temporal.PlainDate {
  switch (whereabouts.kind) {
    case "known":
      return now.toZonedDateTimeISO(whereabouts.zone).toPlainDate();
    case "in_transit":
      return now.toZonedDateTimeISO(whereabouts.fromZone).toPlainDate();
    case "unknown":
      return now.toZonedDateTimeISO("UTC").toPlainDate();
  }
}

function activeTrip(trips: readonly Trip[], today: Temporal.PlainDate): string | null {
  const active = trips.find(
    (trip) =>
      Temporal.PlainDate.compare(today, trip.startDate) >= 0 &&
      (trip.endDate === undefined || Temporal.PlainDate.compare(today, trip.endDate) <= 0),
  );
  return active?.title ?? null;
}
