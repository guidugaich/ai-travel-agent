import type { Clock } from "@ai-travel-agent/core";
import { Temporal } from "temporal-polyfill";

/** The real time, in whole milliseconds, which Postgres stores and returns unchanged. */
export const systemClock: Clock = {
  // eslint-disable-next-line no-restricted-properties -- the one place allowed to read the clock
  now: () => Temporal.Instant.fromEpochMilliseconds(Date.now()),
};
