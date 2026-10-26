import type { Temporal } from "temporal-polyfill";
import type { Location, NewTrip, Trip, User, UserId } from "./domain.js";

/** The only way core code learns the current time; tests pass a fixed one. */
export interface Clock {
  now(): Temporal.Instant;
}

/** What core services need from the outside world. */
export interface Deps {
  readonly clock: Clock;
  readonly repo: Repository;
}

/** Storage, implemented by Postgres in the app and by an in-memory fake in tests. */
export interface Repository {
  getUser(userId: UserId): Promise<User | null>;
  saveUser(user: User): Promise<void>;
  getTrips(userId: UserId): Promise<readonly Trip[]>;
  /** Replaces all of the user's trips at once, assigning ids. */
  replaceTrips(userId: UserId, trips: readonly NewTrip[]): Promise<void>;
  /** The latest location of each source: at most one shared, one said. */
  getLocations(userId: UserId): Promise<readonly Location[]>;
  /** Replaces the user's previous location from the same source. */
  setLocation(userId: UserId, location: Location): Promise<void>;
}
