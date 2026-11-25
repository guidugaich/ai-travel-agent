# 0004. Use Temporal (via temporal-polyfill) for all time logic

- Status: Accepted
- Date: 2026-10-11

## Context

Being right about time is the product's core promise, and every time calculation in `packages/core` goes through the time library. Node 24 doesn't ship the Temporal standard yet (checked: `globalThis.Temporal` is undefined). The library has to handle times that don't exist when clocks spring forward, and times that happen twice when they fall back, without guessing.

## Options considered

1. **`temporal-polyfill` 1.0.5** (updated 2026-09). The Temporal standard, which will eventually be built into JavaScript.
2. **`@js-temporal/polyfill` 0.5.1**, the reference polyfill. Last updated 2025-03.
3. **Luxon 3.7.2**, a mature library with a single `DateTime` type.

Experiment, run on 2026-10-11, using 01:30 in `Europe/Lisbon` on 2027-03-28 (doesn't exist) and on 2026-10-25 (happens twice):

- **Temporal** with `disambiguation: "reject"` threw an error in both cases.
- **Luxon** silently returned 02:30 for the first, and the earlier 01:30 for the second, with no way to refuse.

## Decision

Option 1. The core uses Temporal's types (`PlainDateTime` for wall times, `ZonedDateTime`, `Instant`, `Duration`) and always converts wall times with `disambiguation: "reject"`. An ambiguous time is accepted only when an explicit offset says which occurrence is meant.

_Update 2026-10-18:_ explicit offsets were dropped for simplicity. Times that happen twice are refused, like times that don't exist. Offset support can come back if a real event ever needs it.

## Consequences

- "Ask, don't guess" is enforced by the library, not by convention.
- Separate types keep wall times and instants from being mixed up by accident.
- When Node ships Temporal natively, the polyfill can be dropped. The API is the same standard.
- Timezone rules come from the runtime's built-in timezone database (ICU). A test pins one known rule change (Mexico dropping DST in 2022) so an outdated runtime shows up as a failing test.
