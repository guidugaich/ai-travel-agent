# ai-travel-agent

A chat-first AI travel agent: plans trips from loose ideas, keeps a structured plan that is never wrong about time, and later books through affiliate links. Telegram comes first; other channels, web and mobile clients come later and reuse the same core.

The brand name is undecided. Write "the agent" or "the app"; never hardcode a product, persona or tone.

Overview: [README.md](README.md). System map: [ARCHITECTURE.md](ARCHITECTURE.md). Decisions: [docs/adr/](docs/adr/). Specs: [docs/specs/](docs/specs/). Concepts: [docs/learning/glossary.md](docs/learning/glossary.md).

## Phase

**Phase 0 (bootstrap).** Tooling only, no product code. Phase order: 0 bootstrap → 1 specs → 2 ADRs → 3 test harness → 4+ feature slices. Stop at every phase gate for the user's review. No application code before the Phase 1 specs are approved.

## Principles

- The LLM never knows the time or does time arithmetic. Deterministic code does, and the model calls it as tools. The same goes for other facts that change: prices, availability, entry rules.
- Every turn gets a context preamble computed by code: UTC now, the user's timezone with confidence and source, local time and weekday, and the active trip/leg.
- Future events are stored as local wall time plus an IANA zone, and UTC is derived when needed. Flights have separate departure and arrival zones. Durations are computed, never stored.
- Ambiguity leads to a clarifying question, never a guess.
- The plan changes only through typed, validated application-service commands that return diffs. Ambiguous or destructive changes need confirmation. Changes go into an append-only change log. Agent, API and any UI share this single mutation path.
- No code reads the system clock; a Clock is injected.
- Provider-agnostic LLM: core depends on our own LLM port, vendor SDKs live only in adapters, and evals decide which model to use.
- Privacy by design: keep location and personal data only as long as needed, and never put secrets or personal data in the repo, logs or fixtures.

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
| The eval command is added in Phase 3.        |

## Boundaries

`apps/*` → `packages/agent` → `packages/core` → `packages/contracts`. Imports never point the other way. `core` and `contracts` import no Node built-ins and no channel, HTTP, LLM-vendor or database libraries. These rules are enforced by [.dependency-cruiser.cjs](.dependency-cruiser.cjs).

## Conventions

- TypeScript strict, no `any`, exhaustive switches, zod at every boundary.
- Process: spec → acceptance criteria → failing test → implementation → refactor → docs. Show each new test failing before implementing.
- Tests sit next to the code as `*.test.ts`.
- Every significant decision gets an ADR in `docs/adr/` (template there).
- Never invent a library API. Read the installed package or its docs, and verify by running code.
- Code comments: rare, one line, only for non-obvious reasoning. Rationale goes in ADRs and commit messages.
- Conventional commit messages, as a habit (not enforced).
- When conventions or boundaries change, update this file and ARCHITECTURE.md. When a new concept is introduced, add it to the glossary.

## Git

The user reviews and makes every commit and push. Claude edits files only, never runs `git add`, `git commit` or `git push`, and suggests a commit message instead. A Claude Code hook blocks `git commit`. From Phase 1 on: one feature per branch.

## Definition of done

- The spec and acceptance criteria exist and are met.
- Tests were written first. `pnpm check` passes locally and CI is green.
- Affected docs are updated: spec, ADR, ARCHITECTURE.md, glossary.

## Never

- Hardcode the brand, persona name or tone. They are configuration.
- Import Node built-ins, or channel, HTTP, LLM-vendor or database libraries, into `core` or `contracts`.
- Read the system clock directly: `Date.now()`, `new Date()`, `Temporal.Now`, `performance.now()`.
- Let the LLM compute times, or let it rewrite the plan as free text.
- Commit secrets or personal data, or edit `.env*` files (`.env.example` is the exception).
- Bypass hooks (`--no-verify`, `LEFTHOOK=0`), or weaken a check just to make it pass.
- Allow third-party install scripts. pnpm `allowBuilds` stays deny-by-default.
