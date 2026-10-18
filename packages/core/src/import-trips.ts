import { Temporal } from "temporal-polyfill";
import type { EventKind, NewTrip, NewTripEvent, UserId } from "./domain.js";
import type { Repository } from "./ports.js";
import { toZoned, type Result, type TimeError } from "./time/time.js";

export type ImportProblem =
  | { readonly kind: "missing"; readonly event: string; readonly field: "end" | "flight" }
  | {
      readonly kind: "bad_time";
      readonly event: string;
      readonly field: "start" | "end";
      readonly error: TimeError;
    }
  | { readonly kind: "ends_before_start"; readonly event: string };

const NEEDS_END: ReadonlySet<EventKind> = new Set(["flight", "train", "bus", "ferry", "stay"]);

/** Replaces the user's trips, but only if every event is complete and its times are valid. */
export async function importTrips(
  userId: UserId,
  trips: readonly NewTrip[],
  deps: { readonly repo: Repository },
): Promise<Result<{ readonly trips: number; readonly events: number }, readonly ImportProblem[]>> {
  const problems = trips.flatMap((trip) => trip.events.flatMap(checkEvent));
  if (problems.length > 0) return { ok: false, error: problems };

  await deps.repo.replaceTrips(userId, trips);
  const events = trips.reduce((count, trip) => count + trip.events.length, 0);
  return { ok: true, value: { trips: trips.length, events } };
}

function checkEvent(event: NewTripEvent): ImportProblem[] {
  if (event.end === undefined && NEEDS_END.has(event.kind)) {
    return [{ kind: "missing", event: event.title, field: "end" }];
  }
  if (event.kind === "flight" && event.flight === undefined) {
    return [{ kind: "missing", event: event.title, field: "flight" }];
  }

  const start = toZoned(event.start);
  if (!start.ok) {
    return [{ kind: "bad_time", event: event.title, field: "start", error: start.error }];
  }
  if (event.end === undefined) return [];

  const end = toZoned(event.end);
  if (!end.ok) {
    return [{ kind: "bad_time", event: event.title, field: "end", error: end.error }];
  }
  return Temporal.ZonedDateTime.compare(end.value, start.value) <= 0
    ? [{ kind: "ends_before_start", event: event.title }]
    : [];
}
