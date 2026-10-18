import type { Temporal } from "temporal-polyfill";
import { elapsed } from "./time.js";

export type EventKind = "flight" | "train" | "bus" | "ferry" | "stay" | "activity" | "call";

export type LeaveByEvent =
  | { readonly kind: "flight"; readonly international: boolean; readonly start: Temporal.Instant }
  | { readonly kind: Exclude<EventKind, "flight">; readonly start: Temporal.Instant };

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
      return event.international ? 180 : 120;
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
