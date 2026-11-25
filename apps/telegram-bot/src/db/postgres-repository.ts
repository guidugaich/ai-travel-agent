import type { Sql } from "./sql.ts";
import type {
  EventKind,
  Location,
  Repository,
  Trip,
  TripEvent,
  User,
  UserId,
} from "@ai-travel-agent/core";
import { Temporal } from "temporal-polyfill";

interface UserRow {
  readonly id: string;
}

interface TripRow {
  readonly id: string;
  readonly title: string;
  readonly start_date: string;
  readonly end_date: string | null;
}

interface EventRow {
  readonly id: string;
  readonly trip_id: string;
  readonly kind: EventKind;
  readonly title: string;
  readonly start_local: string;
  readonly start_zone: string;
  readonly end_local: string | null;
  readonly end_zone: string | null;
  readonly flight_from: string | null;
  readonly flight_to: string | null;
  readonly flight_international: boolean | null;
}

interface LocationRow {
  readonly zone: string;
  readonly place_name: string;
  readonly source: Location["source"];
  readonly set_at: Date;
}

/** The core's Repository port, on Postgres. All SQL lives here; rows become domain types below. */
export function postgresRepository(db: Sql): Repository {
  return {
    async getUser(userId) {
      const { rows } = await db.query<UserRow>("select id from users where id = $1", [userId]);
      const [row] = rows;
      return row === undefined ? null : toUser(row);
    },

    async saveUser(user) {
      await db.query("insert into users (id) values ($1) on conflict (id) do nothing", [user.id]);
    },

    async getTrips(userId) {
      // Dates are read as text: as a JS Date they'd become midnight in some zone.
      const trips = await db.query<TripRow>(
        `select id, title, start_date::text as start_date, end_date::text as end_date
         from trips where user_id = $1 order by position`,
        [userId],
      );
      const events = await db.query<EventRow>(
        `select e.id, e.trip_id, e.kind, e.title, e.start_local, e.start_zone, e.end_local,
                e.end_zone, e.flight_from, e.flight_to, e.flight_international
         from events e join trips t on t.id = e.trip_id
         where t.user_id = $1 order by e.position`,
        [userId],
      );
      return trips.rows.map((trip) =>
        toTrip(
          trip,
          events.rows.filter((event) => event.trip_id === trip.id),
        ),
      );
    },

    async replaceTrips(userId, trips) {
      await db.transaction(async (tx) => {
        await tx.query("delete from trips where user_id = $1", [userId]);
        for (const [tripPosition, trip] of trips.entries()) {
          const { rows } = await tx.query<{ id: string }>(
            `insert into trips (user_id, position, title, start_date, end_date)
             values ($1, $2, $3, $4, $5) returning id`,
            [userId, tripPosition, trip.title, trip.startDate, trip.endDate ?? null],
          );
          const tripId = rows[0]?.id;
          if (tripId === undefined) throw new Error("Inserting a trip returned no id");

          for (const [position, event] of trip.events.entries()) {
            await tx.query(
              `insert into events (trip_id, position, kind, title, start_local, start_zone,
                 end_local, end_zone, flight_from, flight_to, flight_international)
               values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [
                tripId,
                position,
                event.kind,
                event.title,
                event.start.local,
                event.start.zone,
                event.end?.local ?? null,
                event.end?.zone ?? null,
                event.flight?.from ?? null,
                event.flight?.to ?? null,
                event.flight?.international ?? null,
              ],
            );
          }
        }
      });
    },

    async getLocations(userId) {
      const { rows } = await db.query<LocationRow>(
        `select zone, place_name, source, set_at from locations
         where user_id = $1 order by source`,
        [userId],
      );
      return rows.map(toLocation);
    },

    async setLocation(userId, location) {
      await db.query(
        `insert into locations (user_id, source, zone, place_name, set_at)
         values ($1, $2, $3, $4, $5)
         on conflict (user_id, source) do update set
           zone = excluded.zone, place_name = excluded.place_name, set_at = excluded.set_at`,
        [userId, location.source, location.zone, location.placeName, location.setAt.toString()],
      );
    },
  };
}

/** The user behind a Telegram account, created on first contact. The core never sees Telegram ids. */
export async function telegramUserId(db: Sql, telegramId: number): Promise<UserId> {
  const found = await db.query<{ id: string }>("select id from users where telegram_id = $1", [
    telegramId,
  ]);
  const existing = found.rows[0]?.id;
  if (existing !== undefined) return existing;

  const created = await db.query<{ id: string }>(
    "insert into users (telegram_id) values ($1) returning id",
    [telegramId],
  );
  const id = created.rows[0]?.id;
  if (id === undefined) throw new Error("Inserting a user returned no id");
  return id;
}

function toUser(row: UserRow): User {
  return { id: row.id };
}

function toTrip(row: TripRow, events: readonly EventRow[]): Trip {
  return {
    id: row.id,
    title: row.title,
    startDate: row.start_date,
    ...(row.end_date === null ? {} : { endDate: row.end_date }),
    events: events.map(toEvent),
  };
}

function toEvent(row: EventRow): TripEvent {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    start: { local: row.start_local, zone: row.start_zone },
    ...(row.end_local === null || row.end_zone === null
      ? {}
      : { end: { local: row.end_local, zone: row.end_zone } }),
    ...(row.flight_from === null || row.flight_to === null || row.flight_international === null
      ? {}
      : {
          flight: {
            from: row.flight_from,
            to: row.flight_to,
            international: row.flight_international,
          },
        }),
  };
}

function toLocation(row: LocationRow): Location {
  return {
    zone: row.zone,
    placeName: row.place_name,
    source: row.source,
    // Millisecond precision, the same as the system clock's.
    setAt: Temporal.Instant.fromEpochMilliseconds(row.set_at.getTime()),
  };
}
