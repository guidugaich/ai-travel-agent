import type { Temporal } from "temporal-polyfill";
import type { WallTime } from "./time/time.js";

export type UserId = string;

export interface User {
  readonly id: UserId;
  /** Usual travel time to an airport, and to anything else, in minutes. */
  readonly transitMinutes: { readonly airport?: number; readonly other?: number };
}

export type EventKind = "flight" | "train" | "bus" | "ferry" | "stay" | "activity" | "call";

export interface NewTripEvent {
  readonly kind: EventKind;
  readonly title: string;
  readonly start: WallTime;
  /** Required for flights, trains, buses, ferries and stays (checked on import). */
  readonly end?: WallTime;
  readonly transitMinutes?: number;
  /** Required for flights (checked on import). */
  readonly flight?: {
    readonly from: string;
    readonly to: string;
    readonly international: boolean;
  };
}

export interface TripEvent extends NewTripEvent {
  readonly id: string;
}

export interface NewTrip {
  readonly title: string;
  readonly startDate: string;
  readonly endDate?: string;
  readonly events: readonly NewTripEvent[];
}

export interface Trip {
  readonly id: string;
  readonly title: string;
  readonly startDate: string;
  readonly endDate?: string;
  readonly events: readonly TripEvent[];
}

/** Where the user is, as of `setAt`. A shared location is trusted more than something they said. */
export interface Location {
  readonly zone: string;
  readonly placeName: string;
  readonly source: "shared_location" | "user_said";
  readonly setAt: Temporal.Instant;
}
