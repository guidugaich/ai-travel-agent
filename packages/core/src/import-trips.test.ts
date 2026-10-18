import { describe, expect, test } from "vitest";
import type { NewTrip } from "./domain.js";
import { importTrips } from "./import-trips.js";
import { usEastCoast } from "./testing/fixtures.js";
import { MemoryRepository } from "./testing/memory-repository.js";

const user = "user-1";

function tripWith(event: NewTrip["events"][number]): NewTrip {
  return { title: "Test trip", startDate: "2026-11-01", events: [event] };
}

describe("importTrips", () => {
  test("a valid trip is stored, with ids", async () => {
    const repo = new MemoryRepository();
    expect(await importTrips(user, [usEastCoast], { repo })).toEqual({
      ok: true,
      value: { trips: 1, events: 1 },
    });
    const [trip] = await repo.getTrips(user);
    expect(trip?.title).toBe("US East Coast");
    expect(trip?.events[0]?.id).toBeTypeOf("string");
  });

  test("a time that doesn't exist is reported with the event's name", async () => {
    const result = await importTrips(
      user,
      [
        tripWith({
          kind: "activity",
          title: "Night tour",
          start: { local: "2027-03-28T01:30", zone: "Europe/Lisbon" },
        }),
      ],
      { repo: new MemoryRepository() },
    );
    expect(result).toEqual({
      ok: false,
      error: [
        {
          kind: "bad_time",
          event: "Night tour",
          field: "start",
          error: { kind: "nonexistent", local: "2027-03-28T01:30", zone: "Europe/Lisbon" },
        },
      ],
    });
  });

  test("a time that happens twice is reported", async () => {
    const result = await importTrips(
      user,
      [
        tripWith({
          kind: "train",
          title: "Night train",
          start: { local: "2026-10-24T22:00", zone: "Europe/Lisbon" },
          end: { local: "2026-10-25T01:30", zone: "Europe/Lisbon" },
        }),
      ],
      { repo: new MemoryRepository() },
    );
    expect(result).toMatchObject({
      ok: false,
      error: [{ event: "Night train", field: "end", error: { kind: "ambiguous" } }],
    });
  });

  test("an event that ends before it starts is reported", async () => {
    const result = await importTrips(
      user,
      [
        tripWith({
          kind: "stay",
          title: "Hotel",
          start: { local: "2026-11-05T15:00", zone: "Asia/Tokyo" },
          end: { local: "2026-11-03T11:00", zone: "Asia/Tokyo" },
        }),
      ],
      { repo: new MemoryRepository() },
    );
    expect(result).toEqual({ ok: false, error: [{ kind: "ends_before_start", event: "Hotel" }] });
  });

  test("a date-line flight whose local arrival looks earlier is fine", async () => {
    const result = await importTrips(
      user,
      [
        tripWith({
          kind: "flight",
          title: "Flight NRT → HNL",
          start: { local: "2026-11-02T21:00", zone: "Asia/Tokyo" },
          end: { local: "2026-11-02T09:00", zone: "Pacific/Honolulu" },
          flight: { from: "NRT", to: "HNL", international: true },
        }),
      ],
      { repo: new MemoryRepository() },
    );
    expect(result.ok).toBe(true);
  });

  test("a flight without an arrival is reported", async () => {
    const result = await importTrips(
      user,
      [
        tripWith({
          kind: "flight",
          title: "Flight NRT → HNL",
          start: { local: "2026-11-02T21:00", zone: "Asia/Tokyo" },
          flight: { from: "NRT", to: "HNL", international: true },
        }),
      ],
      { repo: new MemoryRepository() },
    );
    expect(result).toEqual({
      ok: false,
      error: [{ kind: "missing", event: "Flight NRT → HNL", field: "end" }],
    });
  });

  test("a flight without its details (airports, international) is reported", async () => {
    const result = await importTrips(
      user,
      [
        tripWith({
          kind: "flight",
          title: "Flight NRT → HNL",
          start: { local: "2026-11-02T21:00", zone: "Asia/Tokyo" },
          end: { local: "2026-11-02T09:00", zone: "Pacific/Honolulu" },
        }),
      ],
      { repo: new MemoryRepository() },
    );
    expect(result).toEqual({
      ok: false,
      error: [{ kind: "missing", event: "Flight NRT → HNL", field: "flight" }],
    });
  });

  test("a stay without an end is reported", async () => {
    const result = await importTrips(
      user,
      [
        tripWith({
          kind: "stay",
          title: "Hotel",
          start: { local: "2026-11-03T15:00", zone: "Asia/Tokyo" },
        }),
      ],
      { repo: new MemoryRepository() },
    );
    expect(result).toEqual({
      ok: false,
      error: [{ kind: "missing", event: "Hotel", field: "end" }],
    });
  });

  test("all or nothing: one bad event means nothing changes", async () => {
    const repo = new MemoryRepository();
    await importTrips(user, [usEastCoast], { repo });
    const bad = tripWith({
      kind: "activity",
      title: "Night tour",
      start: { local: "2027-03-28T01:30", zone: "Europe/Lisbon" },
    });
    await importTrips(user, [bad], { repo });
    expect((await repo.getTrips(user)).map((trip) => trip.title)).toEqual(["US East Coast"]);
  });

  test("importing again replaces the user's trips", async () => {
    const repo = new MemoryRepository();
    await importTrips(user, [usEastCoast], { repo });
    await importTrips(
      user,
      [
        tripWith({
          kind: "call",
          title: "Team call",
          start: { local: "2026-11-01T10:00", zone: "Europe/Lisbon" },
        }),
      ],
      { repo },
    );
    expect((await repo.getTrips(user)).map((trip) => trip.title)).toEqual(["Test trip"]);
  });
});
