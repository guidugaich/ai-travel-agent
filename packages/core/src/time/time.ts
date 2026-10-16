import { Temporal } from "temporal-polyfill";

/** A time as written on a ticket: local wall time in an IANA zone. */
export interface WallTime {
  readonly local: string;
  readonly zone: string;
  /** Only for times that happen twice; picks which occurrence is meant. */
  readonly offset?: string;
}

export type TimeError =
  | { readonly kind: "invalid_zone"; readonly zone: string }
  | { readonly kind: "invalid_local_time"; readonly local: string }
  | { readonly kind: "nonexistent"; readonly local: string; readonly zone: string }
  | {
      readonly kind: "ambiguous";
      readonly local: string;
      readonly zone: string;
      readonly offsets: readonly [string, string];
    }
  | {
      readonly kind: "offset_mismatch";
      readonly local: string;
      readonly zone: string;
      readonly offset: string;
    };

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

  const fields = {
    year: local.year,
    month: local.month,
    day: local.day,
    hour: local.hour,
    minute: local.minute,
    second: local.second,
    timeZone: time.zone,
  };

  if (time.offset !== undefined) {
    try {
      return ok(
        Temporal.ZonedDateTime.from(
          { ...fields, offset: time.offset },
          { offset: "reject", disambiguation: "reject" },
        ),
      );
    } catch {
      return fail({
        kind: "offset_mismatch",
        local: time.local,
        zone: time.zone,
        offset: time.offset,
      });
    }
  }

  const earlier = Temporal.ZonedDateTime.from(fields, { disambiguation: "earlier" });
  const later = Temporal.ZonedDateTime.from(fields, { disambiguation: "later" });
  if (earlier.equals(later)) return ok(earlier);

  // Both candidates keep the requested wall time only when it happens twice.
  if (Temporal.PlainDateTime.compare(earlier.toPlainDateTime(), local) === 0) {
    return fail({
      kind: "ambiguous",
      local: time.local,
      zone: time.zone,
      offsets: [earlier.offset, later.offset],
    });
  }
  return fail({ kind: "nonexistent", local: time.local, zone: time.zone });
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
