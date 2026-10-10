# Product

One page. Update it whenever a decision changes.

## What it is

A travel agent you talk to in chat. It takes a loose idea ("Asia this summer", "a hiking trip") and helps turn it into a concrete plan. It then keeps that plan as structured data, answers questions about it correctly (especially about time), and later helps you book through partner links.

## Why it's different

1. **It's never wrong about time.** What time it is where you are, which timezone you're in, when your flight lands in local time, when you need to leave. Tested code works these out and the language model only calls that code. When something is ambiguous, such as "tomorrow" asked at 00:30, it asks.
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
| Leave-by       | Defaults per event type plus your own overrides. Every answer states the assumptions it used.                                                                                                                                                                                                              |
| Companions     | Trip members and roles are in the data model from the start; sharing comes later                                                                                                                                                                                                                           |
| Beyond chat    | A standalone app, later; the HTTP API arrives with it. Web or mobile first is decided then, and mobile has the edge: it knows the device's timezone passively, without a permission prompt, and can use background location for travel times. A web page sees the browser's timezone only while it's open. |
| Language       | English only, with no user-facing text hardcoded, so other languages can be added later                                                                                                                                                                                                                    |

## Assumed defaults (change any of them)

- **Event types:** flights, ground transport (train, bus, ferry), stays (check-in and check-out), reservations and activities, calls. Date-only events and "08:00 wherever I am" reminders are supported in the model; recurring events come later.
- **Proactive messages:** none until the reminders slice. Then quiet hours 22:00–08:00 your local time, unless a departure is imminent.
- **Personalization:** store only what you said explicitly, show "what I know about you" with edit and delete, never store sensitive inferences.
- **Booking:** affiliate links only, hotels first. No payments.
- **Location:** only the derived timezone, the city name, the source ("shared location", "you said") and the time it was set are stored. Raw coordinates and location history are never stored.

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

## Competitors

As of 2026-10-07: general assistants (ChatGPT, Gemini), booking-site assistants (Expedia, which owns Layla, plus Booking.com and Kayak), AI-first startups (Mindtrip, Airial, Stardrift), chat-app bots (GuideGeek) and trip organizers (TripIt, Wanderlog). Planning from a loose idea is crowded. Nobody advertises being correct about time, or plan changes that are validated and can be undone.
