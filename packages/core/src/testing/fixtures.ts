import { Temporal } from "temporal-polyfill";
import type { Location, NewTrip, Trip } from "../domain.js";

// The spec's default setup (docs/slices/01-time-questions.md).

export const usEastCoast: NewTrip = {
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
  ],
};

export const sharedLisbon: Location = {
  zone: "Europe/Lisbon",
  placeName: "Lisbon",
  source: "shared_location",
  setAt: Temporal.Instant.from("2026-10-12T10:00:00Z"),
};

/** A trip as if it came back from storage, with ids. */
export function stored(trip: NewTrip): Trip {
  return {
    ...trip,
    id: "trip-test",
    events: trip.events.map((event, index) => ({ ...event, id: `event-test-${index}` })),
  };
}
