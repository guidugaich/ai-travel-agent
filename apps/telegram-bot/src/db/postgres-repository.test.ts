import type { EventKind, Location, NewTrip, Repository } from "@ai-travel-agent/core";
import { Temporal } from "temporal-polyfill";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { openTestDatabase } from "../testing/test-database.ts";
import { migrate } from "./migrate.ts";
import { postgresRepository } from "./postgres-repository.ts";
import type { Sql } from "./sql.ts";

const you = "00000000-0000-4000-8000-000000000001";
const someoneElse = "00000000-0000-4000-8000-000000000002";

const usEastCoast: NewTrip = {
  title: "US East Coast",
  startDate: "2026-10-14",
  endDate: "2026-10-28",
  events: [
    {
      kind: "flight",
      title: "Flight LIS → JFK",
      start: { local: "2026-10-14T17:05", zone: "Europe/Lisbon" },
      end: { local: "2026-10-14T19:40", zone: "America/New_York" },
      flight: { from: "LIS", to: "JFK", international: true },
    },
    {
      kind: "stay",
      title: "Hotel in Brooklyn",
      start: { local: "2026-10-14T21:00", zone: "America/New_York" },
      end: { local: "2026-10-18T11:00", zone: "America/New_York" },
    },
  ],
};

const porto: NewTrip = {
  title: "Porto",
  startDate: "2026-11-20",
  events: [
    {
      kind: "activity",
      title: "Port tasting",
      start: { local: "2026-11-20T16:00", zone: "Europe/Lisbon" },
    },
  ],
};

/** What getTrips should return for these trips: the same data, plus ids. */
function withIds(trips: readonly NewTrip[]): unknown[] {
  return trips.map((trip) => ({
    ...trip,
    id: expect.any(String) as unknown,
    events: trip.events.map((event) => ({ ...event, id: expect.any(String) as unknown })),
  }));
}

/** Temporal values have no visible fields, so compare them as text. */
async function locationsOf(repo: Repository, userId: string) {
  const locations = await repo.getLocations(userId);
  return locations.map((location) => ({ ...location, setAt: location.setAt.toString() }));
}

let db: Sql;
let close: () => Promise<void>;
let repo: Repository;

beforeAll(async () => {
  ({ db, close } = await openTestDatabase());
  await migrate(db);
  repo = postgresRepository(db);
});

beforeEach(async () => {
  await db.exec("truncate users cascade");
  await repo.saveUser({ id: you });
});

afterAll(async () => {
  await close();
});

describe("users", () => {
  test("an unknown user is null", async () => {
    expect(await repo.getUser(someoneElse)).toBeNull();
  });

  test("a saved user comes back", async () => {
    expect(await repo.getUser(you)).toStrictEqual({ id: you });
  });

  test("no travel times are stored: migration 003 removed those columns", async () => {
    const { rows } = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns
       where table_name in ('users', 'events') and column_name like 'transit%'`,
    );
    expect(rows).toEqual([]);
  });
});

describe("trips", () => {
  test("trips come back as imported, in order, with ids", async () => {
    await repo.replaceTrips(you, [usEastCoast, porto]);
    expect(await repo.getTrips(you)).toStrictEqual(withIds([usEastCoast, porto]));
  });

  test("importing again replaces the previous trips and their events", async () => {
    await repo.replaceTrips(you, [usEastCoast]);
    await repo.replaceTrips(you, [porto]);
    expect(await repo.getTrips(you)).toStrictEqual(withIds([porto]));
    const { rows } = await db.query<{ count: number }>("select count(*)::int as count from events");
    expect(rows[0]?.count).toBe(1);
  });

  test("a failed import leaves the previous trips untouched", async () => {
    await repo.replaceTrips(you, [usEastCoast]);
    // The second trip's event breaks a database rule, after the first trip is already written.
    const broken: NewTrip = {
      title: "Broken",
      startDate: "2026-11-21",
      events: [
        {
          kind: "boat" as EventKind,
          title: "Boat",
          start: { local: "2026-11-21T10:00", zone: "Europe/Lisbon" },
        },
      ],
    };
    await expect(repo.replaceTrips(you, [porto, broken])).rejects.toThrow();
    expect(await repo.getTrips(you)).toStrictEqual(withIds([usEastCoast]));
  });

  test("each user sees only their own trips", async () => {
    await repo.saveUser({ id: someoneElse });
    await repo.replaceTrips(you, [usEastCoast]);
    await repo.replaceTrips(someoneElse, [porto]);
    expect(await repo.getTrips(you)).toStrictEqual(withIds([usEastCoast]));
  });
});

describe("locations", () => {
  const sharedLisbon: Location = {
    zone: "Europe/Lisbon",
    placeName: "Lisbon",
    source: "shared_location",
    setAt: Temporal.Instant.from("2026-10-12T10:00:00.123Z"),
  };
  const saidKathmandu: Location = {
    zone: "Asia/Kathmandu",
    placeName: "Kathmandu",
    source: "user_said",
    setAt: Temporal.Instant.from("2026-10-13T09:12:00Z"),
  };

  test("none yet", async () => {
    expect(await repo.getLocations(you)).toEqual([]);
  });

  test("the time it was set comes back to the millisecond", async () => {
    await repo.setLocation(you, sharedLisbon);
    expect(await locationsOf(repo, you)).toStrictEqual([
      { ...sharedLisbon, setAt: "2026-10-12T10:00:00.123Z" },
    ]);
  });

  test("one per source: a new one replaces the old one from the same source", async () => {
    const sharedPorto: Location = {
      zone: "Europe/Lisbon",
      placeName: "Porto",
      source: "shared_location",
      setAt: Temporal.Instant.from("2026-10-14T08:00:00Z"),
    };
    await repo.setLocation(you, sharedLisbon);
    await repo.setLocation(you, saidKathmandu);
    await repo.setLocation(you, sharedPorto);
    expect(await locationsOf(repo, you)).toStrictEqual([
      { ...sharedPorto, setAt: "2026-10-14T08:00:00Z" },
      { ...saidKathmandu, setAt: "2026-10-13T09:12:00Z" },
    ]);
  });
});

describe("deleting a user", () => {
  test("removes all their data in one statement", async () => {
    await repo.replaceTrips(you, [usEastCoast]);
    await repo.setLocation(you, {
      zone: "Europe/Lisbon",
      placeName: "Lisbon",
      source: "shared_location",
      setAt: Temporal.Instant.from("2026-10-12T10:00:00Z"),
    });

    await db.query("delete from users where id = $1", [you]);

    const { rows } = await db.query<{ trips: number; events: number; locations: number }>(
      `select (select count(*)::int from trips) as trips,
              (select count(*)::int from events) as events,
              (select count(*)::int from locations) as locations`,
    );
    expect(rows[0]).toEqual({ trips: 0, events: 0, locations: 0 });
  });
});
