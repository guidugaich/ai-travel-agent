import type { Location, NewTrip, Trip, User, UserId } from "../domain.js";
import type { Repository } from "../ports.js";

export class MemoryRepository implements Repository {
  private readonly users = new Map<UserId, User>();
  private readonly trips = new Map<UserId, readonly Trip[]>();
  private readonly locations = new Map<UserId, readonly Location[]>();
  private nextId = 1;

  getUser(userId: UserId): Promise<User | null> {
    return Promise.resolve(this.users.get(userId) ?? null);
  }

  saveUser(user: User): Promise<void> {
    this.users.set(user.id, user);
    return Promise.resolve();
  }

  getTrips(userId: UserId): Promise<readonly Trip[]> {
    return Promise.resolve(this.trips.get(userId) ?? []);
  }

  replaceTrips(userId: UserId, trips: readonly NewTrip[]): Promise<void> {
    const stored = trips.map((trip) => ({
      ...trip,
      id: `trip-${this.nextId++}`,
      events: trip.events.map((event) => ({ ...event, id: `event-${this.nextId++}` })),
    }));
    this.trips.set(userId, stored);
    return Promise.resolve();
  }

  getLocations(userId: UserId): Promise<readonly Location[]> {
    return Promise.resolve(this.locations.get(userId) ?? []);
  }

  setLocation(userId: UserId, location: Location): Promise<void> {
    const others = (this.locations.get(userId) ?? []).filter(
      (existing) => existing.source !== location.source,
    );
    this.locations.set(userId, [...others, location]);
    return Promise.resolve();
  }
}
