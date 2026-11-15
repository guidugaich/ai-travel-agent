import { describe, expect, test } from "vitest";
import type { NewTrip, User } from "./domain.js";
import { computeLeaveBy, eventsOnDay, getNextEvent } from "./events.js";
import { sharedLisbon, usEastCoast } from "./testing/fixtures.js";
import type { MemoryRepository } from "./testing/memory-repository.js";
import { setupDeps, testUser as user } from "./testing/setup.js";

const withAirportSetting: User = { id: user, transitMinutes: { airport: 30 } };

const tokyoToHonolulu: NewTrip = {
  title: "Pacific",
  startDate: "2026-11-02",
  events: [
    {
      kind: "flight",
      title: "Flight NRT → HNL",
      start: { local: "2026-11-02T21:00", zone: "Asia/Tokyo" },
      end: { local: "2026-11-02T09:00", zone: "Pacific/Honolulu" },
      flight: { from: "NRT", to: "HNL", international: true },
    },
  ],
};

const dinnerTonight: NewTrip = {
  title: "Lisbon",
  startDate: "2026-10-13",
  events: [
    {
      kind: "activity",
      title: "Dinner",
      start: { local: "2026-10-13T20:00", zone: "Europe/Lisbon" },
    },
  ],
};

async function firstEventId(repo: MemoryRepository): Promise<string> {
  const [trip] = await repo.getTrips(user);
  const id = trip?.events[0]?.id;
  if (id === undefined) throw new Error("no event stored");
  return id;
}

describe("getNextEvent", () => {
  test("example 3: your flight tomorrow", async () => {
    const { deps } = await setupDeps({ locations: [sharedLisbon], trips: [usEastCoast] });
    expect(await getNextEvent(user, undefined, deps)).toEqual({
      id: expect.any(String) as unknown,
      title: "Flight LIS → JFK",
      kind: "flight",
      start: {
        place: "Lisbon",
        zone: "Europe/Lisbon",
        localTime: "17:05",
        date: "Wed 14 Oct",
        relativeDay: "tomorrow",
      },
      end: {
        place: "New York",
        zone: "America/New_York",
        localTime: "19:40",
        date: "Wed 14 Oct",
        relativeDay: "tomorrow",
      },
      duration: "7 h 35 min",
      startsIn: "1 day, 6 h 53 min",
    });
  });

  test("example 10: over the date line, it lands at an earlier local time", async () => {
    const { deps } = await setupDeps({ locations: [sharedLisbon], trips: [tokyoToHonolulu] });
    expect(await getNextEvent(user, "flight", deps)).toMatchObject({
      start: { place: "Tokyo", localTime: "21:00", date: "Mon 2 Nov", relativeDay: null },
      end: { place: "Honolulu", localTime: "09:00", date: "Mon 2 Nov" },
      duration: "7 h",
    });
  });

  test("the earliest upcoming event wins, whatever trip it's in", async () => {
    const { deps } = await setupDeps({
      locations: [sharedLisbon],
      trips: [usEastCoast, dinnerTonight],
    });
    expect(await getNextEvent(user, undefined, deps)).toMatchObject({
      title: "Dinner",
      start: { relativeDay: "today" },
      end: null,
      duration: null,
    });
  });

  test("'my flight' finds the next flight, even with something else before it", async () => {
    const { deps } = await setupDeps({
      locations: [sharedLisbon],
      trips: [usEastCoast, dinnerTonight],
    });
    expect(await getNextEvent(user, "flight", deps)).toMatchObject({
      title: "Flight LIS → JFK",
    });
  });

  test("nothing ahead means no next event", async () => {
    const { deps } = await setupDeps({ now: "2026-10-20T10:00:00Z", trips: [usEastCoast] });
    expect(await getNextEvent(user, undefined, deps)).toBeNull();
  });
});

describe("eventsOnDay", () => {
  test("example 6: 'tomorrow' asked at 00:30 is ambiguous", async () => {
    const { deps } = await setupDeps({
      now: "2026-10-13T23:30:00Z",
      locations: [sharedLisbon],
      trips: [usEastCoast],
    });
    expect(await eventsOnDay(user, "tomorrow", deps)).toEqual({
      kind: "ambiguous",
      options: ["Wed 14 Oct", "Thu 15 Oct"],
    });
  });

  test("'tomorrow' in the morning lists tomorrow's events", async () => {
    const { deps } = await setupDeps({ locations: [sharedLisbon], trips: [usEastCoast] });
    const result = await eventsOnDay(user, "tomorrow", deps);
    expect(result).toMatchObject({ kind: "events", date: "Wed 14 Oct", relativeDay: "tomorrow" });
    expect(result.kind === "events" && result.events.map((event) => event.title)).toEqual([
      "Flight LIS → JFK",
    ]);
  });

  test("a day with nothing on it", async () => {
    const { deps } = await setupDeps({ locations: [sharedLisbon], trips: [usEastCoast] });
    expect(await eventsOnDay(user, "friday", deps)).toEqual({
      kind: "events",
      date: "Fri 16 Oct",
      relativeDay: null,
      events: [],
    });
  });

  test("without knowing where you are, 'tomorrow' can't be resolved", async () => {
    const { deps } = await setupDeps({ trips: [usEastCoast] });
    expect(await eventsOnDay(user, "tomorrow", deps)).toEqual({ kind: "unknown_location" });
  });

  test("a phrase it doesn't understand", async () => {
    const { deps } = await setupDeps({ locations: [sharedLisbon] });
    expect(await eventsOnDay(user, "next week", deps)).toEqual({
      kind: "unrecognized",
      phrase: "next week",
    });
  });
});

describe("computeLeaveBy", () => {
  test("example 4: leave at 13:35, with the assumptions spelled out", async () => {
    const { deps, repo } = await setupDeps({
      user: withAirportSetting,
      locations: [sharedLisbon],
      trips: [usEastCoast],
    });
    expect(await computeLeaveBy(user, await firstEventId(repo), undefined, deps)).toEqual({
      kind: "plan",
      event: "Flight LIS → JFK",
      leaveAt: {
        place: "Lisbon",
        zone: "Europe/Lisbon",
        localTime: "13:35",
        date: "Wed 14 Oct",
        relativeDay: "tomorrow",
      },
      leaveIn: "1 day, 3 h 23 min",
      late: false,
      startsIn: "1 day, 6 h 53 min",
      assumptions: [
        "30 min to the airport (your setting)",
        "at the airport 3 h before an international flight",
      ],
    });
  });

  test("a travel time you just gave beats your setting", async () => {
    const { deps, repo } = await setupDeps({
      user: withAirportSetting,
      locations: [sharedLisbon],
      trips: [usEastCoast],
    });
    expect(await computeLeaveBy(user, await firstEventId(repo), 45, deps)).toMatchObject({
      leaveAt: { localTime: "13:20" },
      assumptions: ["45 min to the airport (you told me)", expect.any(String) as unknown],
    });
  });

  test("an event's own travel time beats your setting", async () => {
    const train: NewTrip = {
      title: "Porto",
      startDate: "2026-10-14",
      events: [
        {
          kind: "train",
          title: "Train to Porto",
          start: { local: "2026-10-14T09:00", zone: "Europe/Lisbon" },
          end: { local: "2026-10-14T11:50", zone: "Europe/Lisbon" },
          transitMinutes: 15,
        },
      ],
    };
    const { deps, repo } = await setupDeps({
      user: { id: user, transitMinutes: { other: 40 } },
      locations: [sharedLisbon],
      trips: [train],
    });
    expect(await computeLeaveBy(user, await firstEventId(repo), undefined, deps)).toMatchObject({
      leaveAt: { localTime: "08:25" },
      assumptions: [
        "15 min to the station (set for this event)",
        "at the station 20 min before the train",
      ],
    });
  });

  test("with no travel time anywhere, it asks", async () => {
    const { deps, repo } = await setupDeps({ locations: [sharedLisbon], trips: [usEastCoast] });
    expect(await computeLeaveBy(user, await firstEventId(repo), undefined, deps)).toEqual({
      kind: "need_transit_time",
      event: "Flight LIS → JFK",
    });
  });

  test("already late: says by how much", async () => {
    const { deps, repo } = await setupDeps({
      now: "2026-10-14T13:00:00Z",
      user: withAirportSetting,
      locations: [sharedLisbon],
      trips: [usEastCoast],
    });
    expect(await computeLeaveBy(user, await firstEventId(repo), undefined, deps)).toMatchObject({
      late: true,
      leaveIn: "25 min",
      startsIn: "3 h 5 min",
    });
  });

  test("an unknown event", async () => {
    const { deps } = await setupDeps({ trips: [usEastCoast] });
    expect(await computeLeaveBy(user, "nope", undefined, deps)).toEqual({ kind: "not_found" });
  });
});
