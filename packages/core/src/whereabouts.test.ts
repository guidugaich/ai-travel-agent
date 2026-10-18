import { Temporal } from "temporal-polyfill";
import { describe, expect, test } from "vitest";
import type { Location } from "./domain.js";
import { sharedLisbon, stored, usEastCoast } from "./testing/fixtures.js";
import { resolveWhereabouts } from "./whereabouts.js";

const at = (iso: string) => Temporal.Instant.from(iso);
const trips = [stored(usEastCoast)];

const said = (placeName: string, zone: string, setAt: string): Location => ({
  zone,
  placeName,
  source: "user_said",
  setAt: at(setAt),
});
const shared = (placeName: string, zone: string, setAt: string): Location => ({
  zone,
  placeName,
  source: "shared_location",
  setAt: at(setAt),
});

describe("resolveWhereabouts: a shared location from the last 3 days wins", () => {
  test("example 1: you shared Lisbon yesterday", () => {
    expect(resolveWhereabouts(at("2026-10-13T09:12:00Z"), [sharedLisbon], trips)).toMatchObject({
      kind: "known",
      zone: "Europe/Lisbon",
      placeName: "Lisbon",
      basis: "shared_location",
      confidence: "high",
    });
  });

  test("a fresh share beats something you said afterwards", () => {
    const saidMadrid = said("Madrid", "Europe/Madrid", "2026-10-13T09:00:00Z");
    expect(
      resolveWhereabouts(at("2026-10-13T09:12:00Z"), [sharedLisbon, saidMadrid], trips),
    ).toMatchObject({ placeName: "Lisbon", basis: "shared_location", confidence: "high" });
  });

  test("a share is fresh for exactly 3 days", () => {
    const sharedAt = "2026-10-12T10:00:00Z";
    expect(
      resolveWhereabouts(
        at("2026-10-15T10:00:00Z"),
        [shared("Lisbon", "Europe/Lisbon", sharedAt)],
        [],
      ),
    ).toMatchObject({ confidence: "high" });
    expect(
      resolveWhereabouts(
        at("2026-10-15T10:01:00Z"),
        [shared("Lisbon", "Europe/Lisbon", sharedAt)],
        [],
      ),
    ).toMatchObject({ confidence: "medium" });
  });

  test("a location shared during a flight beats being in transit", () => {
    const sharedMidFlight = shared("Ponta Delgada", "Atlantic/Azores", "2026-10-14T19:00:00Z");
    expect(resolveWhereabouts(at("2026-10-14T20:00:00Z"), [sharedMidFlight], trips)).toMatchObject({
      kind: "known",
      zone: "Atlantic/Azores",
      basis: "shared_location",
    });
  });
});

describe("resolveWhereabouts: otherwise the newest evidence wins", () => {
  test("example 8: a flight that landed after you shared Lisbon moves you", () => {
    expect(resolveWhereabouts(at("2026-10-15T14:00:00Z"), [sharedLisbon], trips)).toMatchObject({
      kind: "known",
      zone: "America/New_York",
      placeName: "New York",
      basis: "trip",
      confidence: "medium",
    });
  });

  test("example 9: during the flight you're in transit", () => {
    const result = resolveWhereabouts(at("2026-10-14T20:00:00Z"), [sharedLisbon], trips);
    expect(result).toMatchObject({
      kind: "in_transit",
      fromZone: "Europe/Lisbon",
      toZone: "America/New_York",
    });
    expect(result.kind === "in_transit" && result.event.title).toBe("Flight LIS → JFK");
  });

  test("a share older than 3 days loses to something you said since", () => {
    const saidPorto = said("Porto", "Europe/Lisbon", "2026-10-15T10:00:00Z");
    expect(
      resolveWhereabouts(at("2026-10-16T10:00:00Z"), [sharedLisbon, saidPorto], []),
    ).toMatchObject({ placeName: "Porto", basis: "user_said", confidence: "medium" });
  });

  test("something you said after landing beats the trip", () => {
    const saidBoston = said("Boston", "America/New_York", "2026-10-15T10:00:00Z");
    expect(
      resolveWhereabouts(at("2026-10-15T14:00:00Z"), [sharedLisbon, saidBoston], trips),
    ).toMatchObject({ placeName: "Boston", basis: "user_said", confidence: "medium" });
  });

  test("a landing after something you said beats what you said", () => {
    const saidLisbon = said("Lisbon", "Europe/Lisbon", "2026-10-13T10:00:00Z");
    expect(resolveWhereabouts(at("2026-10-15T14:00:00Z"), [saidLisbon], trips)).toMatchObject({
      zone: "America/New_York",
      basis: "trip",
    });
  });

  test("an old share is still used when there's nothing newer", () => {
    expect(resolveWhereabouts(at("2026-10-16T10:00:00Z"), [sharedLisbon], [])).toMatchObject({
      placeName: "Lisbon",
      basis: "shared_location",
      confidence: "medium",
    });
  });

  test("with nothing shared or said, a stay covering now tells where you are", () => {
    const tokyo = stored({
      title: "Japan",
      startDate: "2026-11-03",
      events: [
        {
          kind: "stay",
          title: "Hotel in Tokyo",
          start: { local: "2026-11-03T15:00", zone: "Asia/Tokyo" },
          end: { local: "2026-11-07T11:00", zone: "Asia/Tokyo" },
        },
      ],
    });
    expect(resolveWhereabouts(at("2026-11-04T00:00:00Z"), [], [tokyo])).toMatchObject({
      kind: "known",
      zone: "Asia/Tokyo",
      placeName: "Tokyo",
      basis: "trip",
      confidence: "medium",
    });
  });
});

describe("resolveWhereabouts: nothing known", () => {
  test("example 7: no location and no trip means unknown", () => {
    expect(resolveWhereabouts(at("2026-10-13T09:12:00Z"), [], [])).toEqual({ kind: "unknown" });
  });

  test("a trip that hasn't started yet says nothing about where you are", () => {
    expect(resolveWhereabouts(at("2026-10-13T09:12:00Z"), [], trips)).toEqual({
      kind: "unknown",
    });
  });
});
