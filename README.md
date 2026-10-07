# ai-travel-agent

[![CI](https://github.com/guidugaich/ai-travel-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/guidugaich/ai-travel-agent/actions/workflows/ci.yml)

An AI travel agent you talk to in chat. It helps turn a loose idea ("Asia this summer", "a hiking trip") into a concrete plan, keeps that plan up to date, and later helps book it. Telegram comes first. Other chat channels, a website and a mobile app follow on the same core.

The product name is deliberately undecided. Everything here says "the agent" or "the app", and the brand will be configuration.

## What makes it different

Chat-based planners are unreliable about time: what time it is now, which timezone you're in, when you need to leave, and what "tomorrow" means at 00:30 halfway around the world. This project is designed around two rules:

1. **The model never owns time.** Deterministic, tested code resolves timezones, does time arithmetic and spots ambiguity. The language model calls that code as tools. If something is ambiguous, the agent asks instead of guessing.
2. **The trip plan is structured data, not prose.** Trips and events live in a database and change only through typed, validated commands. Each command produces a diff that can be previewed, confirmed and undone. Every itinerary shown is rendered from that data.

The same principle covers other facts that change, such as prices, availability and entry rules. They come from tools with sources, never from the model's memory.

## Current state

**Phase 0 (bootstrap) is in progress.** The repository has its tooling and guardrails, but no product code yet.

| Phase              | Scope                                                                                                                             | Status      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 0. Bootstrap       | Monorepo, strict TypeScript, lint, format, boundary rules, tests, git hooks, CI                                                   | In progress |
| 1. Specs           | Product brief, domain model, time semantics, tool contracts, conversation flows, eval plan, privacy, client architecture, roadmap | Next        |
| 2. Architecture    | Architecture Decision Records (stack, time library, database, API, identity, LLM orchestration…)                                  | Planned     |
| 3. Test harness    | Injectable clock, time edge-case fixtures, scripted fake LLM, database test setup, architecture tests, eval runner                | Planned     |
| 4+. Feature slices | Thin end-to-end features, starting with time questions over a trip                                                                | Planned     |

Planned feature slices, in order:

1. Answer time questions about a trip.
2. Change the plan, with preview, confirm and undo.
3. Turn a loose idea into a draft trip.
4. Personalization.
5. Affiliate booking links.

## Repository layout

```
packages/
  contracts/      shared schemas and API types; depends on nothing internal
  core/           domain, time logic, application services, ports; no I/O, no Node APIs
  agent/          LLM loop, tools, prompts; provider-agnostic
apps/
  telegram-bot/   Telegram channel adapter (entry point)
  api/            versioned HTTP API for future clients (entry point)
  web/, mobile/   reserved for future clients
```

Dependencies only point downwards (apps → agent → core → contracts). `pnpm deps:check` enforces this.

## Prerequisites

| Tool    | Version    | Notes                                                                                          |
| ------- | ---------- | ---------------------------------------------------------------------------------------------- |
| Node.js | 24 LTS     | Pinned in `.nvmrc`. With nvm, run `nvm use` in the repo                                        |
| pnpm    | 11.28.2    | Pinned in `package.json` (`packageManager`). An installed pnpm 11 switches to it automatically |
| Git     | any recent | Required for the git hooks                                                                     |

## Getting started

```sh
git clone git@github.com:guidugaich/ai-travel-agent.git
cd ai-travel-agent
nvm use
pnpm install   # also installs the git hooks
pnpm check     # runs every check CI runs
```

## Commands

| Command                                                | What it does                                       |
| ------------------------------------------------------ | -------------------------------------------------- |
| `pnpm check`                                           | Everything below, in the same order as CI          |
| `pnpm format` / `pnpm format:check`                    | Format with Prettier / verify formatting           |
| `pnpm lint`                                            | ESLint with type-aware rules                       |
| `pnpm typecheck`                                       | TypeScript in every workspace                      |
| `pnpm deps:check`                                      | Enforce package boundaries with dependency-cruiser |
| `pnpm deps:graph`                                      | Print the package dependency graph as Mermaid      |
| `pnpm test` / `pnpm test:watch` / `pnpm test:coverage` | Vitest                                             |
| `pnpm secrets:check`                                   | Scan the repo for committed secrets                |

## Tooling and guardrails

| Tool                       | Guards against                                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript 6 (strict)      | Type errors. Packages get no Node types, so core stays portable to browsers and React Native                                                            |
| ESLint + typescript-eslint | `any`, non-exhaustive `switch`, and reading the system clock directly (`Date.now()`, `new Date()`): time must come from an injected clock               |
| Prettier                   | Formatting differences                                                                                                                                  |
| dependency-cruiser         | Forbidden imports: packages importing apps, core importing Telegram/HTTP/LLM-vendor/database libraries or Node built-ins, import cycles                 |
| Vitest                     | Regressions (the test suite grows from Phase 3)                                                                                                         |
| secretlint                 | API keys, tokens and private keys in committed files                                                                                                    |
| lefthook                   | Runs the checks as git hooks. Pre-commit: format, lint and secrets on staged files, plus typecheck and tests. Pre-push: full lint, boundaries and tests |
| GitHub Actions             | The same `pnpm check` on a clean machine for every push to `main` and every pull request                                                                |

pnpm is configured not to run third-party install scripts.

## How it's built

Spec-driven and test-first. Every feature goes spec → acceptance criteria → failing test → implementation → refactor → docs. Significant decisions are recorded as Architecture Decision Records. The language model layer is provider-agnostic: the core talks to an LLM interface, and the choice of model is driven by evals.

Documentation:

- [ARCHITECTURE.md](ARCHITECTURE.md): the system map, with diagrams.
- [docs/specs/](docs/specs/): what the system must do (written in Phase 1).
- [docs/adr/](docs/adr/): Architecture Decision Records, the reasons behind each significant choice.
- [docs/learning/glossary.md](docs/learning/glossary.md): the AI-engineering and architecture concepts used here.
- [CLAUDE.md](CLAUDE.md): working rules for AI coding sessions in this repo.

## License

All rights reserved. A license has not been chosen yet.
