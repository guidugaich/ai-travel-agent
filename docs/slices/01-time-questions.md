# Slice 1: Time questions

**Status:** accepted on 2026-10-11 (D1–D7 decided; D8 and D9 are decided at steps 7 and 6). In progress.

## What you can do after this slice

In Telegram, with a trip loaded from a seed file:

- Ask "what time is it?" or "what time is it in Kathmandu?"
- Tap **Share my location**, or say "I'm in Lisbon", and the bot uses that timezone.
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
- **Your location:** you said "I'm in Lisbon" on 12 Oct.
- **Your settings:** 30 min to the airport.
- **Your trip, "US East Coast":** flight LIS → JFK, departing Wed 14 Oct 17:05 `Europe/Lisbon` and arriving 19:40 `America/New_York`, marked international. Only examples 3, 4, 6, 8, 9 and 10 use a trip. Examples 1, 2, 5 and 7 need only the clock and your location.

| #   | You say                                                                                                                  | The bot must                                             | Values the reply must contain                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | What time is it?                                                                                                         | Answer from the preamble                                 | 10:12, Lisbon                                                                                   |
| 2   | What time is it in Kathmandu?                                                                                            | Call `time_in_zone` with `Asia/Kathmandu`                | 14:57                                                                                           |
| 3   | When is my next event?                                                                                                   | Call `get_next_event`                                    | tomorrow (Wed 14 Oct), 17:05 Lisbon time, 19:40 New York time, 7 h 35 min, in 1 day, 6 h 53 min |
| 4   | When do I need to leave for it?                                                                                          | Call `compute_leave_by`                                  | 13:35, in 1 day, 3 h 23 min, 30 min to the airport, 3 h before an international flight          |
| 5   | I'm in Kathmandu now                                                                                                     | Call `set_my_location` with `Asia/Kathmandu` and confirm | Kathmandu, 14:57                                                                                |
| 6   | What's on tomorrow? _(now: 00:30 Wed 14 Oct in Lisbon, `2026-10-13T23:30:00Z`)_                                          | Ask which day you mean; don't answer                     | Wed 14 Oct, Thu 15 Oct                                                                          |
| 7   | What time is it? _(nothing known about your location)_                                                                   | Ask where you are and point to the share button          | (no time)                                                                                       |
| 8   | What time is it? _(now `2026-10-15T14:00:00Z`; your flight landed in New York after you said "Lisbon")_                  | Use New York from the trip, and say so                   | 10:00, New York, based on your trip                                                             |
| 9   | What time is it? _(now `2026-10-14T20:00:00Z`, mid-flight)_                                                              | Say you're in flight and give both times                 | 21:00 Lisbon, 16:00 New York                                                                    |
| 10  | When does my flight land? _(trip: NRT → HNL, departing Mon 2 Nov 21:00 `Asia/Tokyo`, arriving 09:00 `Pacific/Honolulu`)_ | Call `get_next_event`                                    | Mon 2 Nov, 09:00 Honolulu time, 7 h                                                             |

Each example is checked three ways:

- **Unit tests** check the exact values the core computes.
- **Conversation tests** use a scripted fake model to check that the right tools are called and that the output check passes.
- **Evals** check that real models produce replies containing the listed values.

A model's wording varies from run to run, so replies are checked for their values, never for exact text.

### Time edge cases (unit tests on the core)

| Case                                                           | Input                                               | Expected                                                                                    |
| -------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Nonexistent time (clocks spring forward)                       | 2027-03-28 01:30 `Europe/Lisbon`                    | Seed loader rejects it, naming the event                                                    |
| Ambiguous time (clocks fall back)                              | 2026-10-25 01:30 `Europe/Lisbon`                    | Rejected unless the event gives an offset: `+01:00` (first occurrence) or `+00:00` (second) |
| Duration across fall-back                                      | Sat 24 Oct 12:00 → Sun 25 Oct 12:00 `Europe/Lisbon` | 25 h, displayed as "1 day, 1 h" (not 24 h)                                                  |
| Overnight flight in the week Europe and the US are out of sync | JFK Mon 26 Oct 18:30 → LIS Tue 27 Oct 06:15         | 7 h 45 min                                                                                  |
| Date line, westbound                                           | NRT Mon 2 Nov 21:00 → HNL Mon 2 Nov 09:00           | 7 h (arrival's local time is earlier than departure's)                                      |
| Date line, eastbound                                           | HNL Tue 3 Nov 13:00 → NRT Wed 4 Nov 17:30           | 9 h 30 min                                                                                  |
| Offsets of 30 and 45 minutes                                   | `2026-10-13T09:12:00Z`                              | Kolkata 14:42, Kathmandu 14:57, Eucla 17:57, Chatham 22:57                                  |
| A zone whose rules changed (Mexico dropped DST in 2022)        | 2027-04-10 12:00 `America/Mexico_City`              | UTC−06:00, so `18:00Z`                                                                      |
| "Tomorrow" late in the evening                                 | 23:59 Tue 13 Oct, Lisbon                            | Wed 14 Oct, no question                                                                     |
| "Tomorrow" just after midnight                                 | 00:30 Wed 14 Oct, Lisbon                            | Ambiguous: offer Wed 14 Oct and Thu 15 Oct                                                  |

## Time rules

**Storage.** An event's time is stored as local wall time plus an IANA zone (`2026-10-14T17:05` + `Europe/Lisbon`), which is what the ticket says. If a time occurs twice (when clocks fall back), the offset is stored as well. Instants, durations and "time until" are computed when needed, never stored.

**Your current timezone, decided in code:**

1. Start from the most recent thing _you_ confirmed: a shared location, or a statement like "I'm in Lisbon". That's _high_ confidence.
2. If your trip moved you since then (a flight landed in another zone after you confirmed), use the trip's zone. That's _medium_ confidence, and the reply says "based on your trip".
3. If you haven't confirmed anything, use the trip if it covers now (a stay, or after an arrival). Also _medium_.
4. Between a flight's departure and its arrival, you're _in flight_: answer with both local times.
5. Otherwise the timezone is _unknown_: ask, and point to the share button.
6. A confirmation older than 7 days drops to _medium_, and the reply mentions its age.

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

Travel time comes from, in order: the event's own `transit_minutes`, then your settings (`airport` for flights, `other` for everything else), then asking you. If the leave time has already passed, the reply says how late you are and how long until the event.

**Formatting** (always done by code):

- **Times:** 24-hour, "17:05".
- **Places:** the IANA city with spaces, "New York".
- **Dates:** "Wed 14 Oct", with the year added when it isn't the current one.
- **Relative days:** "today", "tomorrow" or "yesterday", in your local date.
- **Durations:** "1 day, 6 h 53 min".
- **Language:** English only. All user-facing strings live in one place, so other languages can be added later.

## Tools the model can call

Each tool is a thin wrapper over one core function. Inputs are validated with zod. Results include ready-to-say `display` strings, so the model only ever repeats values.

| Tool               | Input                                                 | Returns                                                                              |
| ------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `time_in_zone`     | `zone`, a valid IANA name                             | Local time, date and city in that zone                                               |
| `set_my_location`  | `zone`, `place_name`                                  | Your stored location, plus its local time now (so you can spot a wrong zone)         |
| `get_next_event`   | (none)                                                | The next event: start and end in their own zones, duration, relative day, time until |
| `events_on_day`    | `day`: `today`, `tomorrow`, a weekday or `YYYY-MM-DD` | That day's events, _or_ `ambiguous` with options to offer you                        |
| `compute_leave_by` | `event_id`, optional `transit_minutes`                | The leave time, time until then, and the assumptions; _or_ `need_transit_time`       |

These don't go through the model at all; the Telegram adapter calls the core directly:

- **"Share my location" button:** always visible under the message box. It sends coordinates, which code turns into a zone (see D5). Coordinates aren't stored.
- **Identity and allowlist:** checked on every update.

**The output check.** Before a reply is sent, code finds every time, date, duration and relative day in it ("13:35", "Wed 14 Oct", "3 h", "tomorrow"). Each one must appear in this turn's tool results or in the preamble. If one doesn't, the model gets one retry with feedback. If it fails again, the bot sends the computed values in a plain, code-formatted reply.

## Data (only what slice 1 uses)

Everything below is stored in Postgres as ordinary tables, one row per trip, event and so on. JSON is used only for the seed file.

- **User:** id, Telegram id, travel-time settings (`airport`, `other` in minutes).
- **Location state:** user, zone, place name, source (`shared_location`, `user_said`), when it was set. Only the latest is kept.
- **Trip:** id, user, title, start date, optional end date, members (just the owner for now).
- **Event:** id, trip, kind (`flight`, `train`, `bus`, `ferry`, `stay`, `activity`, `call`), title, start and end as wall time plus zone (with an offset only when ambiguous), optional `transit_minutes`. Flights also have from/to airport codes and `international`.
- **Conversation:** the last 20 messages per user. Older ones are deleted.
- **Usage:** tokens used per user per day, for the cap.

**Seed file.** Until slice 2 lets you create trips by chat, this is how a trip gets into the database. You run `pnpm seed`, which:

1. Reads `seed.json` and checks its shape with zod.
2. Calls the core's `importTrips` service. That's the same validation that trips created by chat will go through in slice 2, so the import is just another driving adapter.
3. _Replaces_ your trips in the database, in one transaction: all or nothing. If any event is invalid, nothing changes and the error names the event.

Editing the file and running `pnpm seed` again brings the database back in line with it. The import runs only when you start it, never when the bot starts, and it's retired once slice 2 exists. The bot only ever reads the database, never the file. Tests don't use it either: each test builds its own made-up trip and sets a fake clock. All trips are fictional at this stage, so `seed.json` is committed like any other test data.

The format is JSON, validated with zod when it's loaded, with clear errors such as "event 'Flight LIS → JFK': 2027-03-28T01:30 doesn't exist in Europe/Lisbon (clocks jump forward)". Example:

```json
{
  "user": { "telegramId": 123456789, "transitMinutes": { "airport": 30, "other": 20 } },
  "trips": [
    {
      "title": "US East Coast",
      "start": "2026-10-14",
      "end": "2026-10-28",
      "events": [
        {
          "kind": "flight",
          "title": "Flight LIS → JFK",
          "from": "LIS",
          "to": "JFK",
          "international": true,
          "start": { "local": "2026-10-14T17:05", "zone": "Europe/Lisbon" },
          "end": { "local": "2026-10-14T19:40", "zone": "America/New_York" }
        }
      ]
    }
  ]
}
```

## Safety and cost

- **Allowlist:** only Telegram ids listed in `ALLOWED_TELEGRAM_IDS` get answers. Everyone else gets one polite refusal.
- **Daily token cap:** `DAILY_TOKEN_CAP` per user, 200,000 by default. Over the cap, the bot says so and states when the cap resets, in your local time, computed by code.
- **The agent loop stops after 8 model calls** per message.
- **Secrets live in `.env`,** which git ignores. `.env.example` lists the variable names.
- **No message text in logs.** Logs record ids, tool names, token counts and timings.

## Decisions

Each one was checked on 2026-10-11 against the npm registry, the official docs, or a quick experiment.

| #   | Decision                   | Recommendation                                                                                                                                                                        | Why                                                                                                                                                                                                             | Alternatives                                                                                                                                 |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Time library               | **`temporal-polyfill` 1.0.5** (the Temporal standard; Node 24 doesn't have it built in yet)                                                                                           | Tested: with `disambiguation: "reject"` it refuses both nonexistent and ambiguous times, which is our "ask, don't guess" rule. Separate types for wall times, zoned times and instants.                         | Luxon 3.7: in the same test it silently moved 01:30 to 02:30 and silently picked one of two 01:30s                                           |
| D2  | Storage                    | **Postgres: managed in production, PGlite (Postgres running inside Node) for tests and local dev**, decided 2026-10-11, see [ADR 0003](../adr/0003-postgres-with-pglite-for-tests.md) | The industry standard, ready for future clients without a migration. PGlite keeps `pnpm test` self-contained: no Docker, no server.                                                                             | Postgres in Docker for tests (Docker must be running); SQLite built into Node (needs a disk and backups on the host, likely migration later) |
| D3  | Telegram                   | **grammY 1.46, using long polling** (our process asks Telegram for new messages)                                                                                                      | TypeScript-first and actively maintained. Long polling needs no public URL or HTTPS certificate, and works the same on your laptop and on a server.                                                             | Webhooks: need a public HTTPS endpoint; can switch later without touching the core                                                           |
| D4  | Calling LLMs               | **Our `LlmClient` port, plus one adapter for the "OpenAI-compatible chat completions" format, using plain `fetch`**                                                                   | One adapter reaches local models through Ollama and hosted models through gateways or providers' own compatible endpoints. Plain `fetch` lets you see exactly what's sent. To verify with real calls at step 6. | A provider SDK or a multi-provider library: hides the HTTP you're learning about                                                             |
| D5  | Coordinates → timezone     | **`geo-tz` 8.1** in the Telegram app, behind a port                                                                                                                                   | Accurate. 74 MB, which is fine on a server, and it stays out of the core.                                                                                                                                       | `@photostructure/tz-lookup`: 88 KB, but its README says about 30% of random points don't match the accurate result                           |
| D6  | "I'm in Lisbon" → timezone | **The model proposes an IANA zone, code checks it's real, and the reply echoes the zone and its local time**                                                                          | Simple. A wrong guess is visible right away ("Lisbon, 10:12 now").                                                                                                                                              | A city database: add it if evals show mistakes                                                                                               |
| D7  | Seed format                | **JSON, validated with zod**                                                                                                                                                          | No extra dependency                                                                                                                                                                                             | YAML: friendlier to write, but adds a dependency                                                                                             |
| D8  | Hosting                    | **Decided at step 7**, with a fresh price check                                                                                                                                       | Prices change. The constraints: EU, under $20/month, an always-on app process, and a managed Postgres with backups.                                                                                             | —                                                                                                                                            |
| D9  | Models                     | **Chosen at step 6 by the eval scorecard:** 2–3 hosted models, plus 2 local models that fit in 36 GB                                                                                  | Data, not opinion                                                                                                                                                                                               | —                                                                                                                                            |

D1 is costly to reverse, so it also has [ADR 0004](../adr/0004-temporal-for-time.md).

## Build order

Each step ends with tests passing, and something you can see.

1. **Time functions** in `packages/core`: wall time ↔ instant, durations, relative days, formatting, leave-by. Done when the edge-case table passes.
2. **Domain and seed:** zod schemas, the seed loader (rejecting bad times), core services, timezone resolution, in-memory repositories. Done when examples 1–10 pass at the core level.
3. **Storage:** Postgres adapters for trips, location state, conversations and usage, tested on PGlite; schema migrations; the `pnpm seed` import.
4. **The agent loop:** the LLM port, the tools, the preamble, the output check, all tested with a scripted fake model. Done when the conversation tests for examples 1–10 pass.
5. **Telegram:** grammY with long polling, the share button, the allowlist. Done when you can chat with your bot locally using the fake model's answers. You'll need to create the bot with BotFather.
6. **Real models:** the OpenAI-compatible adapter, and `pnpm eval` producing a scorecard (pass rate, latency, cost per conversation) for the candidates. You pick the model.
7. **Deploy:** choose a host (D8), set up backups, and turn on the daily cap. Done when the bot runs while your laptop is off.
