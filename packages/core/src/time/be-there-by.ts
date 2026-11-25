import type { Temporal } from "temporal-polyfill";
import type { EventKind } from "../domain.ts";
import { elapsed } from "./time.ts";

/** What be-there-by needs: the kind, the start, and whether a flight is international. */
export interface BeThereByEvent {
  readonly kind: EventKind;
  readonly start: Temporal.Instant;
  readonly flight?: { readonly international: boolean };
}

export interface BeThereByPlan {
  readonly at: Temporal.Instant;
  /** Negative when that time has already passed. */
  readonly until: Temporal.Duration;
  readonly late: boolean;
  readonly bufferMinutes: number;
}

/** How early to be there: a rule of thumb per event type. */
export function bufferMinutes(event: BeThereByEvent): number {
  switch (event.kind) {
    case "flight":
      return event.flight?.international === true ? 180 : 120;
    case "ferry":
      return 45;
    case "train":
      return 20;
    case "bus":
      return 15;
    case "stay":
    case "activity":
    case "call":
      return 0;
  }
}

/** Be there by = start − buffer. Travel time to get there is unknowable, so it's never added. */
export function beThereBy(event: BeThereByEvent, now: Temporal.Instant): BeThereByPlan {
  const buffer = bufferMinutes(event);
  const at = event.start.subtract({ minutes: buffer });
  const until = elapsed(now, at);
  return { at, until, late: until.sign < 0, bufferMinutes: buffer };
}
