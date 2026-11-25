import { describe, expect, test } from "vitest";
import { systemClock } from "./system-clock.ts";

describe("systemClock", () => {
  test("gives whole milliseconds, which Postgres stores and returns unchanged", () => {
    expect(systemClock.now().epochNanoseconds % 1_000_000n).toBe(0n);
  });

  test("moves forward", () => {
    const first = systemClock.now();
    expect(systemClock.now().epochMilliseconds).toBeGreaterThanOrEqual(first.epochMilliseconds);
  });
});
