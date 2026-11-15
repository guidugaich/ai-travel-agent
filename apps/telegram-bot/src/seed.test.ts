import type { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { openDatabase } from "./db/database.ts";
import { postgresRepository, telegramUserId } from "./db/postgres-repository.ts";
import { seed } from "./seed.ts";

const telegramId = 123456789;

const flight = {
  kind: "flight",
  title: "Flight LIS → JFK",
  start: { local: "2026-10-14T17:05", zone: "Europe/Lisbon" },
  end: { local: "2026-10-14T19:40", zone: "America/New_York" },
  flight: { from: "LIS", to: "JFK", international: true },
};

const valid = {
  user: { telegramId, transitMinutes: { airport: 30 } },
  trips: [
    { title: "US East Coast", startDate: "2026-10-14", endDate: "2026-10-28", events: [flight] },
  ],
};

let db: PGlite;

beforeAll(async () => {
  db = await openDatabase("memory://");
});

beforeEach(async () => {
  await db.exec("truncate users cascade");
});

afterAll(async () => {
  await db.close();
});

async function stored() {
  const userId = await telegramUserId(db, telegramId);
  const repo = postgresRepository(db);
  return { user: await repo.getUser(userId), trips: await repo.getTrips(userId) };
}

describe("seed", () => {
  test("imports your trips and travel-time settings, for your Telegram id", async () => {
    expect(await seed(db, valid)).toEqual({ ok: true, value: { trips: 1, events: 1 } });
    const { user, trips } = await stored();
    expect(user?.transitMinutes).toStrictEqual({ airport: 30 });
    expect(trips.map((trip) => trip.title)).toEqual(["US East Coast"]);
  });

  test("running it again gives the same result, with no duplicates", async () => {
    await seed(db, valid);
    await seed(db, valid);
    const { rows } = await db.query<{ users: number; trips: number }>(
      `select (select count(*)::int from users) as users,
              (select count(*)::int from trips) as trips`,
    );
    expect(rows[0]).toEqual({ users: 1, trips: 1 });
  });

  test("a time that doesn't exist is refused by name, and nothing changes", async () => {
    await seed(db, valid);
    const springForward = {
      user: { telegramId, transitMinutes: { airport: 45 } },
      trips: [
        {
          ...valid.trips[0],
          events: [{ ...flight, start: { local: "2027-03-28T01:30", zone: "Europe/Lisbon" } }],
        },
      ],
    };

    expect(await seed(db, springForward)).toEqual({
      ok: false,
      error: [
        "event 'Flight LIS → JFK', start: 2027-03-28T01:30 doesn't exist in Europe/Lisbon (clocks jump forward)",
      ],
    });
    const { user, trips } = await stored();
    expect(user?.transitMinutes).toStrictEqual({ airport: 30 });
    expect(trips[0]?.events[0]?.start.local).toBe("2026-10-14T17:05");
  });

  test("a misspelt field is refused, saying where it is", async () => {
    const typo = { ...valid, user: { telegramId, transitMinutes: { airprot: 30 } } };
    const result = await seed(db, typo);
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error.join("\n")).toMatch(
      /Unrecognized key: "airprot"[\s\S]*user\.transitMinutes/,
    );
  });

  test("the committed example file is valid", async () => {
    const example: unknown = JSON.parse(
      await readFile(new URL("../../../seed.example.json", import.meta.url), "utf8"),
    );
    expect(await seed(db, example)).toMatchObject({ ok: true });
  });
});
