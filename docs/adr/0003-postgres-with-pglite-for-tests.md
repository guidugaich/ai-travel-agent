# 0003. Use Postgres, with PGlite for tests and local development

- Status: Accepted
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
- **Tests and local development:** PGlite.
- **Repository adapters:** written against a minimal "run this SQL with these parameters" interface, with one implementation for PGlite and one for the production driver (`postgres` or `pg`, chosen at step 3).

## Consequences

- No migration is needed when more clients or processes arrive. Backups are the managed provider's job.
- If PGlite turns out to behave differently from production Postgres for something we use, tests switch to option 2 (Postgres in Docker), which is already possible on the development machine and in CI.
- When the provider is chosen, check its free-tier limits. Some providers pause inactive databases, which a personal bot would hit.
- When the Postgres libraries are added, they go on the list of libraries the core may not import (`.dependency-cruiser.cjs`).
