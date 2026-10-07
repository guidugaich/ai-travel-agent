# Roadmap

The app is built in **slices**. Each slice is a small, complete version you can actually use, and the next one adds a capability on top. Before building a slice, it gets a short spec in `docs/slices/`: what you can do, example questions with their exact expected answers, and the decisions it needs.

## Slice 1: Time questions (next)

**After this slice you can, in Telegram:**

- Ask "what time is it?" or "what time is it in Tokyo?" and get the right answer, with the timezone named.
- Say where you are ("I'm in Lisbon") and the bot uses that timezone until you say otherwise. If you haven't said, it uses where your trip says you should be, and tells you so. If it can't tell, it asks.
- Ask "when is my next event?" about a trip loaded from a seed file. The answer shows the event's local time, your local time, and how long until then.
- Ask "when do I need to leave for it?" and get a time with its assumptions spelled out ("45 min to the airport + 3 h before an international flight").

**What gets built:**

- a text-only Telegram adapter;
- the agent loop;
- a handful of time tools;
- trip and event storage, with the seed file loader;
- the injectable clock;
- a check that every time in a reply comes from code;
- a small eval set.

**Done when:**

- Answers are right for a table of tricky cases: DST changes (including times that don't exist or happen twice), date-line crossings, overnight flights, 30- and 45-minute timezone offsets, "tomorrow" asked just after midnight, and you changing timezone mid-conversation.
- The bot asks instead of guessing when something is ambiguous.
- Every time shown in a reply was computed by code, not typed by the model.
- About 10 eval conversations run against 2–3 hosted models and 2 local models, giving a scorecard you use to pick the model.
- Only your Telegram account gets answers, and the daily token cap is enforced.

**Decisions this slice needs** (each one goes in the slice spec, with a recommendation):

- the time library;
- the database;
- the Telegram library;
- how we call LLMs;
- where to host.

## Slice 2: Changing the plan

**After this slice you can:**

- Say "I'm going to Lisbon 3–10 March" and get "Create new trip 'Lisbon, 3–10 Mar'?" with the buttons [Create] [Add to an existing trip] [Not now].
- Add, move and cancel events by chat. You see what will change before it's saved, confirm it, and can undo it.

**Done when:** nothing is saved without your confirmation; invalid changes (an arrival before its departure, impossible overlaps) are refused with a reason; undo restores the previous state; every change is recorded.

## Slice 3: From idea to draft trip

**After this slice you can:** say "I'd like a hiking trip in Asia in July". The agent asks about budget, length and style, suggests options with sources for anything that changes (seasons, entry rules), and saves a draft trip through slice 2's "Create new trip?" step.

**Done when:** suggestions cite their sources; nothing is saved without confirmation; suggestion quality is judged by a rubric-based eval.

## Slice 4: Personalization

**After this slice you can:** tell the agent your preferences once. It uses them in suggestions, and "what do you know about me?" shows them so you can edit or delete them.

**Done when:** only preferences you stated are stored; viewing, editing and deleting them all work.

## Slice 5: Booking links

**After this slice you can:** follow partner (affiliate) links from hotel suggestions and book on the partner's site.

**Done when:** links carry the affiliate tracking; no payments go through the app. The slice starts with a research step to find which programs accept a small new site.

## Later (order decided when we get there)

- Reminders ("leave in 30 minutes"), with quiet hours.
- Automatic timezone from Telegram live location.
- Importing booking emails and screenshots, then proposing events for you to confirm.
- Travel-time and flight-status data.
- Sharing trips with companions.
- A web app (which brings the HTTP API), then a mobile app.
- More chat channels and languages.
