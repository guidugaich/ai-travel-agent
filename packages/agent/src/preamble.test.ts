import { currentContext } from "@ai-travel-agent/core";
import { setupDeps, sharedLisbon, testUser as user } from "@ai-travel-agent/core/testing";
import { describe, expect, test } from "vitest";
import { buildPreamble, INSTRUCTIONS } from "./preamble.ts";

describe("buildPreamble", () => {
  test("the instructions come first and never change, so providers can cache them", async () => {
    const lisbon = await setupDeps({ locations: [sharedLisbon] });
    const nowhere = await setupDeps({ now: "2026-10-20T08:00:00Z" });
    for (const { deps } of [lisbon, nowhere]) {
      expect(buildPreamble(await currentContext(user, deps)).startsWith(INSTRUCTIONS)).toBe(true);
    }
  });

  test("this turn's context comes last, exactly as the core computed it (example 1)", async () => {
    const { deps } = await setupDeps({ locations: [sharedLisbon] });
    const preamble = buildPreamble(await currentContext(user, deps));
    expect(preamble).toContain('"now": "2026-10-13T09:12:00Z"');
    expect(preamble).toContain('"place": "Lisbon"');
    expect(preamble).toContain('"localTime": "10:12"');
    expect(preamble).toContain('"basis": "shared_location"');
  });

  test("an unknown location is stated, so the model asks (example 7)", async () => {
    const { deps } = await setupDeps({});
    expect(buildPreamble(await currentContext(user, deps))).toContain('"kind": "unknown"');
  });
});
