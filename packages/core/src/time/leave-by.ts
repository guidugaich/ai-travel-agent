import type { Temporal } from "temporal-polyfill";
import type { EventKind } from "../domain.js";
import { elapsed } from "./time.js";

/** What leave-by needs: the kind, the start, and whether a flight is international. */
export interface LeaveByEvent {
  readonly kind: EventKind;
  readonly start: Temporal.Instant;
  readonly flight?: { readonly international: boolean };
}

export interface LeavePlan {
  readonly leaveAt: Temporal.Instant;
  /** Negative when the leave time has already passed. */
  readonly leaveIn: Temporal.Duration;
  readonly late: boolean;
  readonly bufferMinutes: number;
  readonly transitMinutes: number;
}

/** How long before the start to be there. */
export function bufferMinutes(event: LeaveByEvent): number {
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

/** Leave time = start − buffer − travel time. */
export function leaveBy(
  event: LeaveByEvent,
  transitMinutes: number,
  now: Temporal.Instant,
): LeavePlan {
  const buffer = bufferMinutes(event);
  const leaveAt = event.start.subtract({ minutes: buffer + transitMinutes });
  const leaveIn = elapsed(now, leaveAt);
  return { leaveAt, leaveIn, late: leaveIn.sign < 0, bufferMinutes: buffer, transitMinutes };
}
