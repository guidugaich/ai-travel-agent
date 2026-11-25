# 0003. Use Postgres, with PGlite for tests

- Status: Accepted, amended on 2026-11-25 (local development)
- Date: 2026-10-11

## Context

Slice 1 needs a database for trips, location state, conversations and usage. The project aims to be production-ready, and later clients (web or mobile) will share the same data. It runs as a single process, for a single user at first, on under $20/month in the EU.

Checked on 2026-10-11:

- Node 24 has SQLite built in (`node:sqlite`, "release candidate" in its docs).
- PGlite 0.5.8 is real Postgres compiled to WebAssembly, running inside Node with no server. It has no install scripts.
- Docker 28.5 is installed on the development machine.

## Options considered

1. **SQLite, built into Node.** No dependency and nothing to run; tests use an in-memory database. The host needs a persistent disk and a backup routine. A single file can't be shared by several servers, so the web/mobile stage would probably mean migrating.
2. **Postgres, with Docker for tests.** The most standard setup, with one driver everywhere. Docker has to be running for tests and git hooks, and tests are slower.
3. **Postgres, with PGlite for tests and local development.** The same database engine everywhere, and `pnpm test` stays self-contained. It needs a thin layer so the same repository code runs on both PGlite and the production driver, and PGlite is pre-1.0.

## Decision

Option 3.

- **Production:** a managed Postgres in the EU, with the provider chosen at deployment (slice 1, step 7).
- **Tests:** PGlite in memory, or a real Postgres when `TEST_DATABASE_URL` is set, as it is in CI.
- **Local development:** Postgres 18 in Docker (`docker-compose.yml`), since 2026-11-25. It was PGlite until then.
- **Repository adapters:** written against a minimal "run this SQL with these parameters" interface, with one implementation for PGlite and one for the `pg` driver.

## Consequences

- No migration is needed when more clients or processes arrive. Backups are the managed provider's job.
- If PGlite turns out to behave differently from production Postgres for something we use, tests switch to option 2 (Postgres in Docker), which is already possible on the development machine and in CI.
- When the provider is chosen, check its free-tier limits. Some providers pause inactive databases, which a personal bot would hit.
- When the Postgres libraries are added, they go on the list of libraries the core may not import (`.dependency-cruiser.cjs`).

## Amendment, 2026-11-25

Local development moved from PGlite to Postgres in Docker (slice 1, D14). PGlite allows one connection, so the bot and `pnpm seed` needed a lock, and nothing else, such as psql, could look while the bot ran. Dev also never used the production driver, so driver differences would first show up in production. Tests keep PGlite, so `pnpm test` and the git hooks still need no Docker. CI runs the storage tests on a real Postgres instead.
