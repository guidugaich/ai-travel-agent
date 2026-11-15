import { Temporal } from "temporal-polyfill";
import type { Clock } from "../ports.ts";

/** A clock stopped at one moment, e.g. fixedClock("2026-10-13T09:12:00Z"). */
export function fixedClock(iso: string): Clock {
  const now = Temporal.Instant.from(iso);
  return { now: () => now };
}
