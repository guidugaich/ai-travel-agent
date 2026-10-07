# ai-travel-agent

A chat-first AI travel agent: plans trips from loose ideas, keeps a structured plan that is never wrong about time, and later books through affiliate links. Telegram comes first; web and mobile clients come later and reuse the same core.

The brand name is undecided. Write "the agent" or "the app"; never hardcode a product, persona or tone.

Product: [docs/product.md](docs/product.md). Order of work: [docs/roadmap.md](docs/roadmap.md). System map: [ARCHITECTURE.md](ARCHITECTURE.md). Decisions: [docs/adr/](docs/adr/). Concepts: [docs/learning/glossary.md](docs/learning/glossary.md).

## How we work

- **Simplicity first.** Build the simplest thing that works. Add packages, abstractions, docs, tools and process only when a second real use appears, not in anticipation. When in doubt, leave it out.
- **Work in slices.** Each slice is a small version of the app the user can actually use. For each one:
  1. Write a short spec in `docs/slices/` (what the user can do, example questions with exact expected answers, decisions with recommendations). The user reviews it.
  2. Build it test-first in small steps: a failing test, then the code. Show each new test failing first.
  3. The user tries it, then the next slice begins.
- **Explain as you go.** The user is learning AI engineering. Explain new concepts in plain web-backend terms, add them to the glossary, and explain every new file in the same message that adds it.
- **Current step:** the product doc and roadmap are in review. Next: the slice 1 spec.

## Principles

- The LLM never knows the time or does time arithmetic. Deterministic code does, and the model calls it as tools. The same goes for other facts that change: prices, availability, entry rules.
- Every turn gets a context preamble computed by code: UTC now, the user's timezone with confidence and source, local time, and the active trip.
- Future events are stored as local wall time plus an IANA zone; UTC is derived when needed. Durations are computed, never stored.
- Ambiguity leads to a clarifying question, never a guess.
- The plan changes only through core services that validate the change and return a diff. Ambiguous or destructive changes need the user's confirmation.
- No code reads the system clock; a Clock is injected.
- The agent depends on our own LLM port, and vendor SDKs live only in adapters. Evals decide which model to use.
- Privacy by design: no secrets or personal data in the repo, logs or test data.

## Architecture rules (hexagonal)

- `packages/core` holds all business logic and depends on nothing. It imports no other package, no app, no Node built-ins, and no Telegram, HTTP, LLM-vendor or database libraries. `.dependency-cruiser.cjs` enforces this.
- Dependencies point inwards: `apps/*` → `packages/agent` → `packages/core`.
- Core services speak domain language (`userId`, `tripId`), never channel concepts such as a Telegram chat id. Adapters map identities.
- Every plan change goes through a core service. Agent tools are thin wrappers over them.
- Ports are defined by the side that needs them. Driven adapters (database, clock, LLM provider) live in the app until a second app needs them.

## Commands

Node comes from `.nvmrc` (`nvm use`), and pnpm is pinned in `package.json`.

| Command                                      | Purpose                            |
| -------------------------------------------- | ---------------------------------- |
| `pnpm check`                                 | Everything CI runs                 |
| `pnpm format` / `format:check`               | Prettier                           |
| `pnpm lint`                                  | ESLint (type-aware)                |
| `pnpm typecheck`                             | TypeScript, all workspaces         |
| `pnpm deps:check` / `deps:graph`             | Package boundaries / Mermaid graph |
| `pnpm test` / `test:watch` / `test:coverage` | Vitest                             |
| `pnpm secrets:check`                         | secretlint                         |

## Conventions

- TypeScript strict, no `any`, exhaustive switches, zod to validate data at boundaries.
- Tests sit next to the code as `*.test.ts`.
- Write an ADR in `docs/adr/` only for decisions that are costly to reverse. Smaller decisions go in the slice spec.
- Never invent a library API. Read the installed package or its docs, and verify by running code.
- Code comments: rare, one line, only for non-obvious reasoning.
- Conventional commit messages, as a habit (not enforced).
- When conventions or boundaries change, update this file and ARCHITECTURE.md.

## Git

The user reviews and makes every commit and push, straight to `main`. Claude edits files only, never runs `git add`, `git commit` or `git push`, and suggests a commit message instead. A Claude Code hook blocks `git commit`.

## Definition of done (per slice)

- Every example in the slice spec gives the expected answer.
- Tests were written first. `pnpm check` passes and CI is green.
- Affected docs are updated: README status, ARCHITECTURE.md, glossary.

## Never

- Hardcode the brand, persona name or tone. They are configuration.
- Break the core's isolation (see Architecture rules).
- Read the system clock directly: `Date.now()`, `new Date()`, `Temporal.Now`, `performance.now()`.
- Let the LLM compute times, or let it rewrite the plan as free text.
- Commit secrets or personal data, or edit `.env*` files (`.env.example` is the exception).
- Bypass hooks (`--no-verify`, `LEFTHOOK=0`), or weaken a check just to make it pass.
- Allow third-party install scripts. pnpm `allowBuilds` stays deny-by-default.
