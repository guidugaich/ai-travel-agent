import { describe, expect, test } from "vitest";
import type { NewTrip } from "./domain.ts";
import { beThereBy, eventsOnDay, getNextEvent } from "./events.ts";
import { sharedLisbon, usEastCoast } from "./testing/fixtures.ts";
import type { MemoryRepository } from "./testing/memory-repository.ts";
import { setupDeps, testUser as user } from "./testing/setup.ts";

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

describe("beThereBy", () => {
  test("example 4: be at the airport by 14:05, with the rule that gives it", async () => {
    const { deps, repo } = await setupDeps({ locations: [sharedLisbon], trips: [usEastCoast] });
    expect(await beThereBy(user, await firstEventId(repo), deps)).toEqual({
      kind: "plan",
      event: "Flight LIS → JFK",
      beThereBy: {
        place: "Lisbon",
        zone: "Europe/Lisbon",
        localTime: "14:05",
        date: "Wed 14 Oct",
        relativeDay: "tomorrow",
      },
      timeUntil: "1 day, 3 h 53 min",
      late: false,
      startsIn: "1 day, 6 h 53 min",
      rule: "at the airport 3 h before an international flight",
    });
  });

  test("a train: at the station 20 min before", async () => {
    const train: NewTrip = {
      title: "Porto",
      startDate: "2026-10-14",
      events: [
        {
          kind: "train",
          title: "Train to Porto",
          start: { local: "2026-10-14T09:00", zone: "Europe/Lisbon" },
          end: { local: "2026-10-14T11:50", zone: "Europe/Lisbon" },
        },
      ],
    };
    const { deps, repo } = await setupDeps({ locations: [sharedLisbon], trips: [train] });
    expect(await beThereBy(user, await firstEventId(repo), deps)).toMatchObject({
      beThereBy: { localTime: "08:40" },
      rule: "at the station 20 min before the train",
    });
  });

  test("an activity has no rule: be there when it starts", async () => {
    const { deps, repo } = await setupDeps({ locations: [sharedLisbon], trips: [dinnerTonight] });
    expect(await beThereBy(user, await firstEventId(repo), deps)).toMatchObject({
      beThereBy: { localTime: "20:00", relativeDay: "today" },
      rule: null,
    });
  });

  test("already late: says by how much", async () => {
    const { deps, repo } = await setupDeps({
      now: "2026-10-14T13:30:00Z",
      locations: [sharedLisbon],
      trips: [usEastCoast],
    });
    expect(await beThereBy(user, await firstEventId(repo), deps)).toMatchObject({
      late: true,
      timeUntil: "25 min",
      startsIn: "2 h 35 min",
    });
  });

  test("an unknown event", async () => {
    const { deps } = await setupDeps({ trips: [usEastCoast] });
    expect(await beThereBy(user, "nope", deps)).toEqual({ kind: "not_found" });
  });
});
