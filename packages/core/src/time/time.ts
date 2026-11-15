import { Temporal } from "temporal-polyfill";

/** A time as written on a ticket: local wall time in an IANA zone. */
export interface WallTime {
  readonly local: string;
  readonly zone: string;
}

export type TimeError =
  | { readonly kind: "invalid_zone"; readonly zone: string }
  | { readonly kind: "invalid_local_time"; readonly local: string }
  | { readonly kind: "nonexistent"; readonly local: string; readonly zone: string }
  | { readonly kind: "ambiguous"; readonly local: string; readonly zone: string };

export type Result<T, E> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const fail = <E>(error: E): Result<never, E> => ({ ok: false, error });

export function toZoned(time: WallTime): Result<Temporal.ZonedDateTime, TimeError> {
  if (!isKnownZone(time.zone)) return fail({ kind: "invalid_zone", zone: time.zone });

  let local: Temporal.PlainDateTime;
  try {
    local = Temporal.PlainDateTime.from(time.local);
  } catch {
    return fail({ kind: "invalid_local_time", local: time.local });
  }

  const earlier = local.toZonedDateTime(time.zone, { disambiguation: "earlier" });
  const later = local.toZonedDateTime(time.zone, { disambiguation: "later" });
  if (earlier.equals(later)) return ok(earlier);

  // Both candidates keep the requested wall time only when it happens twice.
  const kind =
    Temporal.PlainDateTime.compare(earlier.toPlainDateTime(), local) === 0
      ? "ambiguous"
      : "nonexistent";
  return fail({ kind, local: time.local, zone: time.zone });
}

/** For stored times, which were validated on import: a failure means corrupted data. */
export function zonedOrThrow(time: WallTime): Temporal.ZonedDateTime {
  const result = toZoned(time);
  if (!result.ok) throw new Error(`Stored time is invalid: ${result.error.kind}`);
  return result.value;
}

export function zonedAt(
  instant: Temporal.Instant,
  zone: string,
): Result<Temporal.ZonedDateTime, TimeError> {
  if (!isKnownZone(zone)) return fail({ kind: "invalid_zone", zone });
  return ok(instant.toZonedDateTimeISO(zone));
}

/** Real elapsed time, in hours and minutes; negative when `to` is before `from`. */
export function elapsed(from: Temporal.Instant, to: Temporal.Instant): Temporal.Duration {
  return from.until(to, { largestUnit: "hours" });
}

function isKnownZone(zone: string): boolean {
  try {
    Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(zone);
    return true;
  } catch {
    return false;
  }
}
