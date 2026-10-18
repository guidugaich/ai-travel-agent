import { Temporal } from "temporal-polyfill";
import type { Location, Trip, TripEvent } from "./domain.js";
import { cityName } from "./time/format.js";
import { toZoned, type WallTime } from "./time/time.js";

interface InTransit {
  readonly kind: "in_transit";
  readonly event: TripEvent;
  readonly fromZone: string;
  readonly toZone: string;
  readonly since: Temporal.Instant;
}

export type Whereabouts =
  | {
      readonly kind: "known";
      readonly zone: string;
      readonly placeName: string;
      readonly basis: Location["source"] | "trip";
      readonly confidence: "high" | "medium";
      readonly since: Temporal.Instant;
    }
  | InTransit
  | { readonly kind: "unknown" };

type TripPosition =
  { readonly kind: "at"; readonly zone: string; readonly since: Temporal.Instant } | InTransit;

const SHARE_FRESH_HOURS = 3 * 24;

/**
 * Where the user is now.
 * 1. A shared location from the last 3 days wins, unless the trip moved them after it.
 * 2. Otherwise the newest evidence wins: any shared location, something they said, or the trip.
 * 3. Otherwise unknown.
 */
export function resolveWhereabouts(
  now: Temporal.Instant,
  locations: readonly Location[],
  trips: readonly Trip[],
): Whereabouts {
  const position = tripPosition(now, trips);
  const newerThanTrip = (location: Location) =>
    position === null || Temporal.Instant.compare(location.setAt, position.since) >= 0;

  const shared = newest(locations.filter((location) => location.source === "shared_location"));
  if (
    shared !== null &&
    shared.setAt.until(now).total({ unit: "hours" }) <= SHARE_FRESH_HOURS &&
    newerThanTrip(shared)
  ) {
    return fromLocation(shared, "high");
  }

  const latest = newest(locations);
  if (latest !== null && newerThanTrip(latest)) return fromLocation(latest, "medium");

  if (position === null) return { kind: "unknown" };
  if (position.kind === "in_transit") return position;
  return {
    kind: "known",
    zone: position.zone,
    placeName: cityName(position.zone),
    basis: "trip",
    confidence: "medium",
    since: position.since,
  };
}

function fromLocation(location: Location, confidence: "high" | "medium"): Whereabouts {
  return {
    kind: "known",
    zone: location.zone,
    placeName: location.placeName,
    basis: location.source,
    confidence,
    since: location.setAt,
  };
}

function newest(locations: readonly Location[]): Location | null {
  return locations.reduce<Location | null>(
    (best, location) =>
      best === null || Temporal.Instant.compare(location.setAt, best.setAt) > 0 ? location : best,
    null,
  );
}

/** The most recent thing the trip says about where the user is. */
function tripPosition(now: Temporal.Instant, trips: readonly Trip[]): TripPosition | null {
  let latest: TripPosition | null = null;
  for (const event of trips.flatMap((trip) => trip.events)) {
    const position = positionFrom(event, now);
    if (position === null) continue;
    if (position.kind === "in_transit") return position;
    if (latest === null || Temporal.Instant.compare(position.since, latest.since) > 0) {
      latest = position;
    }
  }
  return latest;
}

function positionFrom(event: TripEvent, now: Temporal.Instant): TripPosition | null {
  const endWall = event.end;
  if (endWall === undefined) return null;

  const start = instantOf(event.start);
  const end = instantOf(endWall);
  if (Temporal.Instant.compare(now, start) < 0) return null;
  const inProgress = Temporal.Instant.compare(now, end) < 0;

  switch (event.kind) {
    case "flight":
    case "train":
    case "bus":
    case "ferry":
      return inProgress
        ? {
            kind: "in_transit",
            event,
            fromZone: event.start.zone,
            toZone: endWall.zone,
            since: start,
          }
        : { kind: "at", zone: endWall.zone, since: end };
    case "stay":
      return inProgress ? { kind: "at", zone: event.start.zone, since: start } : null;
    case "activity":
    case "call":
      return null;
  }
}

function instantOf(time: WallTime): Temporal.Instant {
  const result = toZoned(time);
  // Stored events were validated on import, so this signals corrupted data.
  if (!result.ok) throw new Error(`Stored event has an invalid time: ${result.error.kind}`);
  return result.value.toInstant();
}
