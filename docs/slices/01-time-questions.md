# Slice 1: Time questions

**Status:** accepted on 2026-10-11 (D1–D7 decided; D8 and D9 are decided at steps 7 and 6). In progress.

## What you can do after this slice

In Telegram, with a trip loaded from a seed file:

- Ask "what time is it?" or "what time is it in Kathmandu?"
- Tap **Share my location** (the most reliable way), or say where you are ("I'm in Lisbon"). What you say only counts when you haven't shared a location in the last 3 days, or your trip has moved you since.
- Ask "when is my next event?" or "what's on tomorrow?"
- Ask "when do I need to leave for it?" and get a time with its assumptions.

Out of scope:

- Changing the plan (slice 2).
- Live location.
- Reminders.
- Other channels or languages.
- Web or mobile.
- Booking.

## Examples

These are the acceptance tests. Every value was computed with the time library chosen below.

**Default setup.** Unless an example says otherwise:

- **Now:** `2026-10-13T09:12:00Z` (Tue 13 Oct, 10:12 in Lisbon).
- **Your location:** you shared your location in Lisbon on 12 Oct.
- **Your settings:** 30 min to the airport.
- **Your trip, "US East Coast":** flight LIS → JFK, departing Wed 14 Oct 17:05 `Europe/Lisbon` and arriving 19:40 `America/New_York`, marked international. Only examples 3, 4, 6, 8, 9 and 10 use a trip. Examples 1, 2, 5, 7 and 11 need only the clock and your location.

| #   | You say                                                                                                                  | The bot must                                                                                             | Values the reply must contain                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | What time is it?                                                                                                         | Answer from the preamble                                                                                 | 10:12, Lisbon                                                                                              |
| 2   | What time is it in Kathmandu?                                                                                            | Call `time_in_zone` with `Asia/Kathmandu`                                                                | 14:57                                                                                                      |
| 3   | When is my next event?                                                                                                   | Call `get_next_event`                                                                                    | tomorrow (Wed 14 Oct), 17:05 Lisbon time, 19:40 New York time (optional: 7 h 35 min, in 1 day, 6 h 53 min) |
| 4   | When do I need to leave for it?                                                                                          | Call `compute_leave_by`                                                                                  | 13:35, in 1 day, 3 h 23 min, 30 min to the airport, 3 h before an international flight                     |
| 5   | I'm in Kathmandu now                                                                                                     | Call `set_my_location`; keep Lisbon, because you shared it in the last 3 days, and suggest sharing again | Lisbon, Share my location                                                                                  |
| 6   | What's on tomorrow? _(now: 00:30 Wed 14 Oct in Lisbon, `2026-10-13T23:30:00Z`)_                                          | Ask which day you mean; don't answer                                                                     | Wed 14 Oct, Thu 15 Oct                                                                                     |
| 7   | What time is it? _(nothing known about your location)_                                                                   | Ask where you are and point to the share button                                                          | (no time)                                                                                                  |
| 8   | What time is it? _(now `2026-10-15T14:00:00Z`; your flight landed in New York after you shared Lisbon)_                  | Use New York from the trip, and say so                                                                   | 10:00, New York, based on your trip                                                                        |
| 9   | What time is it? _(now `2026-10-14T20:00:00Z`, mid-flight)_                                                              | Say you're in flight and give both times                                                                 | 21:00 Lisbon, 16:00 New York                                                                               |
| 10  | When does my flight land? _(trip: NRT → HNL, departing Mon 2 Nov 21:00 `Asia/Tokyo`, arriving 09:00 `Pacific/Honolulu`)_ | Call `get_next_event` with `kind: flight`                                                                | Mon 2 Nov, 09:00 Honolulu time                                                                             |
| 11  | I'm in Kathmandu now _(no shared location in the last 3 days)_                                                           | Call `set_my_location` with `Asia/Kathmandu` and confirm                                                 | Kathmandu, 14:57, based on what you said                                                                   |

Each example is checked three ways:

- **Unit tests** check the exact values the core computes.
- **Conversation tests** use a scripted fake model to check that the right tools are called and that the output check passes.
- **Evals** check that real models produce replies containing the listed values.

A model's wording varies from run to run, so replies are checked for their values, never for exact text.

### Time edge cases (unit tests on the core)

| Case                                                           | Input                                               | Expected                                                                    |
| -------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------- |
| Nonexistent time (clocks spring forward)                       | 2027-03-28 01:30 `Europe/Lisbon`                    | Seed loader rejects it, naming the event                                    |
| Ambiguous time (clocks fall back)                              | 2026-10-25 01:30 `Europe/Lisbon`                    | Seed loader rejects it, naming the event: the time happens twice that night |
| Duration across fall-back                                      | Sat 24 Oct 12:00 → Sun 25 Oct 12:00 `Europe/Lisbon` | 25 h, displayed as "1 day, 1 h" (not 24 h)                                  |
| Overnight flight in the week Europe and the US are out of sync | JFK Mon 26 Oct 18:30 → LIS Tue 27 Oct 06:15         | 7 h 45 min                                                                  |
| Date line, westbound                                           | NRT Mon 2 Nov 21:00 → HNL Mon 2 Nov 09:00           | 7 h (arrival's local time is earlier than departure's)                      |
| Date line, eastbound                                           | HNL Tue 3 Nov 13:00 → NRT Wed 4 Nov 17:30           | 9 h 30 min                                                                  |
| Offsets of 30 and 45 minutes                                   | `2026-10-13T09:12:00Z`                              | Kolkata 14:42, Kathmandu 14:57, Eucla 17:57, Chatham 22:57                  |
| A zone whose rules changed (Mexico dropped DST in 2022)        | 2027-04-10 12:00 `America/Mexico_City`              | UTC−06:00, so `18:00Z`                                                      |
| "Tomorrow" late in the evening                                 | 23:59 Tue 13 Oct, Lisbon                            | Wed 14 Oct, no question                                                     |
| "Tomorrow" just after midnight                                 | 00:30 Wed 14 Oct, Lisbon                            | Ambiguous: offer Wed 14 Oct and Thu 15 Oct                                  |

## Time rules

**Storage.** An event's time is stored as local wall time plus an IANA zone (`2026-10-14T17:05` + `Europe/Lisbon`), which is what the ticket says. Times that don't exist or happen twice (in the hour when clocks change) are refused, with an error naming the event. Instants, durations and "time until" are computed when needed, never stored.

**Your current timezone, decided in code:**

1. **A shared location from the last 3 days wins** (_high_ confidence), unless your trip moved you after you shared it (for example, a flight landed in another zone). While it holds, what you _say_ ("I'm in Madrid") doesn't change your location; the bot suggests sharing again if you've moved.
2. **Otherwise, the newest evidence wins** (_medium_ confidence). It can be an older shared location, something you said ("I'm in Lisbon"), or your trip (an arrival, or a stay covering now). The reply says which one it used: "based on what you said", "based on your trip".
3. **Between a flight's departure and its arrival,** if that's the newest evidence, you're _in flight_: answer with both local times.
4. **Otherwise the timezone is _unknown_:** ask, and point to the share button.

**Ambiguity, where the bot asks instead of guessing:**

- "Today" or "tomorrow" between 00:00 and 03:59 your time.
- A weekday name that is today ("Friday?" asked on a Friday): today, or next week?
- An unknown timezone.
- A leave-by question when no travel time is known.

**Leave-by:** leave at the event start, minus the buffer, minus the travel time.

| Event                | Be there before the start |
| -------------------- | ------------------------- |
| International flight | 3 h                       |
| Domestic flight      | 2 h                       |
| Ferry                | 45 min                    |
| Train                | 20 min                    |
| Bus                  | 15 min                    |
| Anything else        | 0                         |

Travel time comes from, in order: what you just said ("it's 45 minutes to the airport"), the event's own `transit_minutes`, then your settings (`airport` for flights, `other` for everything else), then asking you. If the leave time has already passed, the reply says how late you are and how long until the event.

**Formatting** (always done by code):

- **Times:** 24-hour, "17:05".
- **Places:** the IANA city with spaces, "New York".
- **Dates:** "Wed 14 Oct", with the year added when it isn't the current one.
- **Relative days:** "today", "tomorrow" or "yesterday", in your local date.
- **Durations:** "1 day, 6 h 53 min".
- **Language:** English only. All user-facing strings live in one place, so other languages can be added later.

## Tools the model can call

Each tool is a thin wrapper over one core function. Inputs are validated with zod. Results include ready-to-say `display` strings, so the model only ever repeats values.

| Tool               | Input                                                   | Returns                                                                                                                           |
| ------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `time_in_zone`     | `zone`, a valid IANA name                               | Local time, date and city in that zone                                                                                            |
| `set_my_location`  | `zone`, `place_name`                                    | Stores what you said, and whether it's in effect (a shared location from the last 3 days takes priority), plus its local time now |
| `get_next_event`   | optional `kind` (`flight`, `train`, …), for "my flight" | The next event, or the next of that kind: start and end in their own zones, duration, relative day, time until                    |
| `events_on_day`    | `day`: `today`, `tomorrow`, a weekday or `YYYY-MM-DD`   | That day's events, _or_ `ambiguous` with options to offer you                                                                     |
| `compute_leave_by` | `event_id`, optional `transit_minutes`                  | The leave time, time until then, and the assumptions; _or_ `need_transit_time`                                                    |

These don't go through the model at all; the Telegram adapter calls the core directly:

- **"Share my location" button:** always visible under the message box. It sends coordinates, which code turns into a zone (see D5). Coordinates aren't stored. The place is named after the zone's main city, so a share from Porto reads "Lisbon time"; at sea it's the offset from UTC ("UTC-03:00"). The bot confirms a new share; live location updates are saved without a reply.
- **Identity and allowlist:** checked on every update.

**The output check.** Before a reply is sent, code finds every time, date, duration and relative day in it ("13:35", "Wed 14 Oct", "3 h", "tomorrow"). Each one must appear in this turn's tool results or in the preamble. If one doesn't, the model gets one retry with feedback, within the same 8-call limit. If it fails again, the bot sends the computed values in a plain, code-formatted reply. The check is strict about form ("3 hours" fails when the tool said "3 h"), so the model learns to copy values exactly, and it matches durations whole: "6 h" taken from "1 day, 6 h 53 min" fails.

## Data (only what slice 1 uses)

Everything below is stored in Postgres as ordinary tables, one row per trip, event and so on. JSON is used only for the seed file.

- **User:** id, Telegram id, travel-time settings (`airport`, `other` in minutes).
- **Location state:** user, source (`shared_location` or `user_said`), zone, place name, when. The latest of each source is kept.
- **Trip:** id, user, title, start date, optional end date, members (just the owner for now).
- **Event:** id, trip, kind (`flight`, `train`, `bus`, `ferry`, `stay`, `activity`, `call`), title, start and end as wall time plus zone, optional `transit_minutes`. Flights also have from/to airport codes and `international`.
- **Conversation:** the last 20 messages per user, yours and the bot's. Tool calls and their results aren't kept: they hold values like "in 2 h" that go stale, so the model calls tools again each turn. Older messages are deleted. Anything worth keeping is saved through a core service, never left only in the chat.
- **Usage:** tokens used per user per day, for the cap (step 7).

**Seed file.** Until slice 2 lets you create trips by chat, this is how a trip gets into the database. You run `pnpm seed`, which:

1. Reads `seed.json` and checks its shape with zod. Unknown fields are refused, so a misspelt optional field can't be silently ignored.
2. Calls the core's `importTrips` service. That's the same validation that trips created by chat will go through in slice 2, so the import is just another driving adapter.
3. _Replaces_ your trips, in one transaction, then saves your travel-time settings. If any event is invalid, nothing changes and the error names the event, for example "event 'Flight LIS → JFK', start: 2027-03-28T01:30 doesn't exist in Europe/Lisbon (clocks jump forward)".

Editing the file and running `pnpm seed` again brings the database back in line with it. The import runs only when you start it, never when the bot starts, and it's retired once slice 2 exists. The bot only ever reads the database, never the file. Tests don't read `seed.json`; each test builds its own made-up trip and sets a fake clock.

`seed.json` holds your real Telegram id, so git ignores it. The committed [`seed.example.json`](../../seed.example.json) shows the format, which matches the core's trip types, and a test keeps it valid. Copy it to `seed.json` and edit your copy. The bot uses the real clock, so set the dates in the future before you run `pnpm seed`.

**Opening the database.** Every program that opens it (`pnpm seed` now, the bot from step 5) first applies any migrations it hasn't run yet. Locally the database lives in `.data/pglite/`, which git ignores. Only one program can have it open: a second one, such as `pnpm seed` while the bot runs, refuses with a message naming the first. A lock file next to the database (`.data/pglite.lock`) holds the process id; a lock left by a program that crashed is taken over.

## Safety and cost

- **Allowlist:** only Telegram ids listed in `ALLOWED_TELEGRAM_IDS` get answers. Everyone else gets one polite refusal that tells them their Telegram id, which is how you find yours. Group chats are ignored.
- **Daily token cap:** `DAILY_TOKEN_CAP` per user, 200,000 by default. Over the cap, the bot says so and states when the cap resets, in your local time, computed by code.
- **The agent loop stops after 8 model calls** per message.
- **Secrets live in `.env`,** which git ignores. `.env.example` lists the variable names.
- **No message text in logs.** Logs record ids, tool names, token counts and timings.

## Decisions

Each one was checked on 2026-10-11 against the npm registry, the official docs, or a quick experiment.

| #   | Decision                   | Recommendation                                                                                                                                                                                                                                      | Why                                                                                                                                                                                                             | Alternatives                                                                                                                                 |
| --- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Time library               | **`temporal-polyfill` 1.0.5** (the Temporal standard; Node 24 doesn't have it built in yet)                                                                                                                                                         | Tested: with `disambiguation: "reject"` it refuses both nonexistent and ambiguous times, which is our "ask, don't guess" rule. Separate types for wall times, zoned times and instants.                         | Luxon 3.7: in the same test it silently moved 01:30 to 02:30 and silently picked one of two 01:30s                                           |
| D2  | Storage                    | **Postgres: managed in production, PGlite (Postgres running inside Node) for tests and local dev**, decided 2026-10-11, see [ADR 0003](../adr/0003-postgres-with-pglite-for-tests.md). The `pg` driver for a real Postgres server arrives at step 7 | The industry standard, ready for future clients without a migration. PGlite keeps `pnpm test` self-contained: no Docker, no server.                                                                             | Postgres in Docker for tests (Docker must be running); SQLite built into Node (needs a disk and backups on the host, likely migration later) |
| D3  | Telegram                   | **grammY 1.46, using long polling** (our process asks Telegram for new messages)                                                                                                                                                                    | TypeScript-first and actively maintained. Long polling needs no public URL or HTTPS certificate, and works the same on your laptop and on a server.                                                             | Webhooks: need a public HTTPS endpoint; can switch later without touching the core                                                           |
| D4  | Calling LLMs               | **Our `LlmClient` port, plus one adapter for the "OpenAI-compatible chat completions" format, using plain `fetch`**                                                                                                                                 | One adapter reaches local models through Ollama and hosted models through gateways or providers' own compatible endpoints. Plain `fetch` lets you see exactly what's sent. To verify with real calls at step 6. | A provider SDK or a multi-provider library: hides the HTTP you're learning about                                                             |
| D5  | Coordinates → timezone     | **`geo-tz` 8.1** in the Telegram adapter                                                                                                                                                                                                            | Accurate. 74 MB, which is fine on a server, and it stays out of the core.                                                                                                                                       | `@photostructure/tz-lookup`: 88 KB, but its README says about 30% of random points don't match the accurate result                           |
| D6  | "I'm in Lisbon" → timezone | **The model proposes an IANA zone, code checks it's real, and the reply echoes the zone and its local time**                                                                                                                                        | Simple. A wrong guess is visible right away ("Lisbon, 10:12 now"). And a shared location from the last 3 days always takes priority.                                                                            | A city database: add it if evals show mistakes                                                                                               |
| D7  | Seed format                | **JSON, validated with zod**                                                                                                                                                                                                                        | No extra dependency                                                                                                                                                                                             | YAML: friendlier to write, but adds a dependency                                                                                             |
| D8  | Hosting                    | **Decided at step 7**, with a fresh price check                                                                                                                                                                                                     | Prices change. The constraints: EU, under $20/month, an always-on app process, and a managed Postgres with backups.                                                                                             | —                                                                                                                                            |
| D9  | Models                     | **Chosen at step 6 by the eval scorecard:** 2–3 hosted models, plus 2 local models that fit in 36 GB                                                                                                                                                | Data, not opinion                                                                                                                                                                                               | —                                                                                                                                            |
| D10 | Database access            | **Plain SQL in the database adapters**, one file per port, no ORM or query builder                                                                                                                                                                  | You see exactly what's sent, as with plain `fetch` in D4. Rows become domain types in one place                                                                                                                 | Drizzle or Kysely: typed queries, but another layer to learn                                                                                 |
| D11 | Migrations                 | **Numbered `.sql` files and a small runner** that records which have run, each in a transaction                                                                                                                                                     | Plain SQL, no tool to learn                                                                                                                                                                                     | node-pg-migrate, dbmate                                                                                                                      |
| D12 | Times in the database      | **Event times as text plus the zone**, exactly as the core uses them. Trip dates use `date`, read back as text                                                                                                                                      | Drivers turn Postgres dates and timestamps into JS `Date` objects in some zone. Tested: PGlite returned the date `2026-10-14` as midnight UTC                                                                   | `timestamp` columns with custom parsers                                                                                                      |

D10–D12 were added on 2026-11-15, during step 3. D1 is costly to reverse, so it also has [ADR 0004](../adr/0004-temporal-for-time.md).

## Build order

Each step ends with tests passing, and something you can see.

1. ✅ **Time functions** in `packages/core`: wall time ↔ instant, durations, relative days, formatting, leave-by. Done when the edge-case table passes.
2. ✅ **Domain and core services:** the trip import (rejecting bad times), timezone resolution, the services, an in-memory repository for tests. Done when examples 1–11 pass at the core level.
3. ✅ **Storage:** Postgres adapters for users, trips and location state, tested on PGlite; schema migrations; the `pnpm seed` import, with the seed file's zod schema.
4. ✅ **The agent loop:** the LLM port, the tools, the preamble, the output check, and conversation history, all tested with a scripted fake model. The LLM port reports token counts from the start. Done when the conversation tests for examples 1–11 pass.
5. ✅ **Telegram:** grammY with long polling, the share button, the allowlist (5B), and `pnpm bot` (5C). A lock on `.data/` (5A), because PGlite lets a second program open the same folder and silently loses its writes (tested on 0.5.16): with the bot running, `pnpm seed` must refuse. Done when you can chat with your bot locally using the fake model's answers. You'll need to create the bot with BotFather.
6. **Real models:** the OpenAI-compatible adapter (6A, in `packages/openai-compatible`), used by `pnpm bot` when `LLM_BASE_URL` and `LLM_MODEL` are set (6B), and `pnpm eval` in `apps/evals` (6C), producing a scorecard (pass rate, latency, cost per conversation, data terms) for the candidates. You pick the model (6D). Also check:

   - that each provider accepts the tool schemas zod generates (they include `$schema` and a very large `maximum`);
   - that the evals catch values used in the wrong place: the output check only proves a value came from our code, so a reply giving the arrival time as the departure passes it;
   - how the output check's fallback reply (a code block) looks in Telegram, since the stand-in model never triggers it.

   Local models so far (2026-11-18, a 36 GB Mac, Ollama 0.40.16 started with `OLLAMA_CONTEXT_LENGTH=8192`):

   - `qwen3.6:35b` doesn't fit: Ollama's MLX runner grew to 31 GB and the Mac swapped, so calls timed out. Dropped.
   - `gpt-oss:20b` (14 GB) fits, with a median of 3.6–5.2 s per conversation. Pass rate 16/33, then 24/33 after rewording the tool descriptions and naming the exact "based on …" phrases in the preamble.

7. **Deploy:** choose a host (D8), set up backups, and add the daily token cap with its usage counter. Done when the bot runs while your laptop is off.
