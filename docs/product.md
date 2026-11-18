# Product

One page. Update it whenever a decision changes.

## What it is

A travel agent you talk to in chat. It takes a loose idea ("Asia this summer", "a hiking trip") and helps turn it into a concrete plan. It then keeps that plan as structured data, answers questions about it correctly (especially about time), and later helps you book through partner links.

## Why it's different

1. **It's never wrong about time.** What time it is where you are, which timezone you're in, when your flight lands in local time, when to be at the airport. Tested code works these out and the language model only calls that code. When something is ambiguous, such as "tomorrow" asked at 00:30, it asks.
2. **The plan is data, not prose.** Trips and events live in a database and change only through validated steps that you confirm. You can always undo.
3. **Facts that change come from sources.** Prices, opening seasons and entry rules come from tools with sources, never from the model's memory.

## Who it's for

- **Now:** the author, on real trips. Only allowlisted Telegram accounts get answers.
- **Later:** frequent travelers and digital nomads with multi-leg trips, overnight flights, timezone changes, and plans that change often.

## Goals

1. **Learn AI engineering** by building a real product: tool calling, agent loops, evals, model comparison.
2. **A portfolio piece:** a public repo that shows how it was built, through decisions, tests and evals.
3. **Maybe revenue later:** affiliate commissions, possibly a paid plan, decided once there's real usage data.

## Decisions so far

| Topic          | Decision                                                                                                                                                                                                                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First users    | Just the author, through an allowlisted Telegram account                                                                                                                                                                                                                                                   |
| LLM costs      | The author pays, with a hard daily cap per user. Pricing is decided later.                                                                                                                                                                                                                                 |
| Hosting        | Under $20/month, EU region, one process                                                                                                                                                                                                                                                                    |
| Models         | Provider-agnostic. Evals pick the model, including locally hosted ones.                                                                                                                                                                                                                                    |
| Trips          | A user has many trips. A trip may be open-ended, so a nomad can keep one rolling trip. Optional home base.                                                                                                                                                                                                 |
| Creating trips | Slice 1 reads a trip from a seed file. From slice 2, trips are created by chat, always through a "Create new trip?" confirmation; code suggests "add to an existing trip" when the dates overlap.                                                                                                          |
| Be there by    | A rule per event type, such as 3 h before an international flight, and the answer states it. Travel time to get there is never guessed: that needs live routing (later).                                                                                                                                   |
| Companions     | Trip members and roles are in the data model from the start; sharing comes later                                                                                                                                                                                                                           |
| Beyond chat    | A standalone app, later; the HTTP API arrives with it. Web or mobile first is decided then, and mobile has the edge: it knows the device's timezone passively, without a permission prompt, and can use background location for travel times. A web page sees the browser's timezone only while it's open. |
| Language       | English only, with no user-facing text hardcoded, so other languages can be added later                                                                                                                                                                                                                    |

## Assumed defaults (change any of them)

- **Event types:** flights, ground transport (train, bus, ferry), stays (check-in and check-out), reservations and activities, calls. Date-only events and "08:00 wherever I am" reminders are supported in the model; recurring events come later.
- **Proactive messages:** none until the reminders slice. Then quiet hours 22:00–08:00 your local time, unless a departure is imminent.
- **Personalization:** store only what you said explicitly, show "what I know about you" with edit and delete, never store sensitive inferences.
- **Booking:** affiliate links only, hotels first. No payments.
- **Location:** only the derived timezone, the city name, the source (a shared location or something you said) and when are stored. Raw coordinates and location history are never stored.

## Not doing now

- Real bookings or payments.
- Web or mobile apps, and an HTTP API.
- Chat channels other than Telegram. WhatsApp's business terms may not allow this kind of assistant; check the current terms before planning it.
- Languages other than English.
- Importing booking emails or screenshots.
- Sharing trips with companions (modelled, not built).

## Constraints

- Simplicity first: the simplest thing that works.
- Under $20/month for hosting, EU region. LLM spend capped per user per day.
- No secrets or personal data in the repo, logs or test data.

## Privacy (EU GDPR)

While you're the only user, the data is your own. Once anyone else uses the bot, the GDPR applies in full. This is an engineering checklist, not legal advice: check it against the regulation's text before others use the bot.

**Built in from the start**

- **Minimum data** (Art. 5): a shared location becomes a timezone and the coordinates are dropped. Logs hold ids and timings, never message text.
- **No personal data in the repo, logs or test data** (Art. 25, data protection by design). `seed.json`, which holds your Telegram id, is git-ignored.
- **One delete removes everything** (Art. 17, right to erasure): every table links to the user with `on delete cascade`, and a test checks it.
- **EU hosting** for the app and the database (step 7).

**When the step that needs it arrives**

- **Conversation history (slice 1, step 4):** keep only the last 20 messages per user (Art. 5, storage limitation).
- **Models (slice 1, step 6):** the LLM provider receives your messages, which makes it a processor (Art. 28) and may be a transfer outside the EU (Chapter V). The eval scorecard records each candidate's data terms: a data processing agreement, retention, whether inputs train models, and where processing happens. Self-hosted or EU-hosted models avoid the transfer.
- **Deploy (slice 1, step 7):** encrypted connections, and backups that expire (Art. 32, security).

**Before anyone else uses the bot**

- A short privacy notice on `/start` (Art. 13): what's stored, why, for how long, and who processes it, including Telegram and the LLM provider.
- `/export` and `/delete` commands (Art. 15, 17 and 20).
- A lawful basis for each use of the data (Art. 6).
- A plan for data breaches (Art. 33: tell the supervisory authority within 72 hours).

## Competitors

As of 2026-10-07: general assistants (ChatGPT, Gemini), booking-site assistants (Expedia, which owns Layla, plus Booking.com and Kayak), AI-first startups (Mindtrip, Airial, Stardrift), chat-app bots (GuideGeek) and trip organizers (TripIt, Wanderlog). Planning from a loose idea is crowded. Nobody advertises being correct about time, or plan changes that are validated and can be undone.
