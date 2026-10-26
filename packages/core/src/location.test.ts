import { describe, expect, test } from "vitest";
import type { Location, NewTrip } from "./domain.js";
import { currentContext, setLocation, timeInZone } from "./location.js";
import type { Deps } from "./ports.js";
import { sharedLisbon, usEastCoast } from "./testing/fixtures.js";
import { fixedClock } from "./testing/fixed-clock.js";
import { MemoryRepository } from "./testing/memory-repository.js";

const user = "user-1";

async function setup(options: {
  now?: string;
  locations?: readonly Location[];
  trips?: readonly NewTrip[];
}): Promise<{ deps: Deps; repo: MemoryRepository }> {
  const repo = new MemoryRepository();
  for (const location of options.locations ?? []) await repo.setLocation(user, location);
  await repo.replaceTrips(user, options.trips ?? []);
  return { deps: { clock: fixedClock(options.now ?? "2026-10-13T09:12:00Z"), repo }, repo };
}

describe("currentContext", () => {
  test("example 1: you shared Lisbon yesterday", async () => {
    const { deps } = await setup({ locations: [sharedLisbon], trips: [usEastCoast] });
    expect(await currentContext(user, deps)).toEqual({
      now: "2026-10-13T09:12:00Z",
      whereabouts: {
        kind: "known",
        place: "Lisbon",
        zone: "Europe/Lisbon",
        localTime: "10:12",
        localDate: "Tue 13 Oct",
        basis: "shared_location",
        confidence: "high",
      },
      activeTrip: null,
    });
  });

  test("example 7: nothing known", async () => {
    const { deps } = await setup({});
    expect((await currentContext(user, deps)).whereabouts).toEqual({ kind: "unknown" });
  });

  test("example 8: your flight landed in New York after you shared Lisbon", async () => {
    const { deps } = await setup({
      now: "2026-10-15T14:00:00Z",
      locations: [sharedLisbon],
      trips: [usEastCoast],
    });
    expect(await currentContext(user, deps)).toMatchObject({
      whereabouts: {
        kind: "known",
        place: "New York",
        localTime: "10:00",
        basis: "trip",
        confidence: "medium",
      },
      activeTrip: "US East Coast",
    });
  });

  test("example 9: mid-flight, both local times", async () => {
    const { deps } = await setup({
      now: "2026-10-14T20:00:00Z",
      locations: [sharedLisbon],
      trips: [usEastCoast],
    });
    expect((await currentContext(user, deps)).whereabouts).toEqual({
      kind: "in_transit",
      event: "Flight LIS → JFK",
      from: { place: "Lisbon", zone: "Europe/Lisbon", localTime: "21:00" },
      to: { place: "New York", zone: "America/New_York", localTime: "16:00" },
    });
  });
});

describe("timeInZone", () => {
  test("example 2: what time is it in Kathmandu?", async () => {
    const { deps } = await setup({});
    expect(timeInZone("Asia/Kathmandu", deps)).toEqual({
      ok: true,
      value: {
        place: "Kathmandu",
        zone: "Asia/Kathmandu",
        localTime: "14:57",
        localDate: "Tue 13 Oct",
      },
    });
  });

  test("an unknown zone is refused", async () => {
    const { deps } = await setup({});
    expect(timeInZone("Mars/Olympus", deps)).toEqual({
      ok: false,
      error: { kind: "invalid_zone", zone: "Mars/Olympus" },
    });
  });
});

describe("setLocation", () => {
  const kathmandu = { zone: "Asia/Kathmandu", placeName: "Kathmandu" };

  test("example 5: what you say doesn't override yesterday's shared location", async () => {
    const { deps, repo } = await setup({ locations: [sharedLisbon] });
    const result = await setLocation(user, { ...kathmandu, source: "user_said" }, deps);
    expect(result).toMatchObject({
      ok: true,
      value: { inEffect: false, current: { kind: "known", place: "Lisbon" } },
    });
    expect((await repo.getLocations(user)).map((location) => location.source).sort()).toEqual([
      "shared_location",
      "user_said",
    ]);
  });

  test("example 11: with no recent share, what you say is used", async () => {
    const { deps } = await setup({});
    const result = await setLocation(user, { ...kathmandu, source: "user_said" }, deps);
    expect(result).toEqual({
      ok: true,
      value: {
        inEffect: true,
        current: {
          kind: "known",
          place: "Kathmandu",
          zone: "Asia/Kathmandu",
          localTime: "14:57",
          localDate: "Tue 13 Oct",
          basis: "user_said",
          confidence: "medium",
        },
      },
    });
  });

  test("a shared location takes effect with high confidence", async () => {
    const { deps } = await setup({ locations: [sharedLisbon] });
    const result = await setLocation(user, { ...kathmandu, source: "shared_location" }, deps);
    expect(result).toMatchObject({
      ok: true,
      value: { inEffect: true, current: { place: "Kathmandu", confidence: "high" } },
    });
  });

  test("an unknown zone is refused and nothing is stored", async () => {
    const { deps, repo } = await setup({});
    const result = await setLocation(
      user,
      { zone: "Mars/Olympus", placeName: "Olympus", source: "user_said" },
      deps,
    );
    expect(result).toEqual({ ok: false, error: { kind: "invalid_zone", zone: "Mars/Olympus" } });
    expect(await repo.getLocations(user)).toEqual([]);
  });
});
