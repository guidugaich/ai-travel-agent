-- Every table links back to users with "on delete cascade": deleting a user deletes all their data.

create table users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint unique check (telegram_id > 0),
  transit_airport_minutes integer check (transit_airport_minutes >= 0),
  transit_other_minutes integer check (transit_other_minutes >= 0)
);

create table trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  position integer not null,
  title text not null,
  start_date date not null,
  end_date date
);

-- Times are stored as the core uses them: wall time as text, plus an IANA zone.
create table events (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  position integer not null,
  kind text not null check (kind in ('flight', 'train', 'bus', 'ferry', 'stay', 'activity', 'call')),
  title text not null,
  start_local text not null,
  start_zone text not null,
  end_local text,
  end_zone text,
  transit_minutes integer check (transit_minutes >= 0),
  flight_from text,
  flight_to text,
  flight_international boolean,
  check ((end_local is null) = (end_zone is null)),
  check ((flight_from is null) = (flight_to is null)),
  check ((flight_from is null) = (flight_international is null))
);

create table locations (
  user_id uuid not null references users (id) on delete cascade,
  source text not null check (source in ('shared_location', 'user_said')),
  zone text not null,
  place_name text not null,
  set_at timestamptz not null,
  primary key (user_id, source)
);
