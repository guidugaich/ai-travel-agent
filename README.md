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

The tooling and guardrails are in place. There's no product code yet.

The app is built in **slices**: small, complete versions you can actually use, each adding one capability. See the [roadmap](docs/roadmap.md).

| Step                                                                                     | Status    |
| ---------------------------------------------------------------------------------------- | --------- |
| Tooling: monorepo, strict TypeScript, lint, format, boundary rules, tests, git hooks, CI | Done      |
| [Product](docs/product.md) and [roadmap](docs/roadmap.md)                                | In review |
| Slice 1: answer time questions about a trip                                              | Next      |
| Slice 2: change the plan, with preview, confirm and undo                                 | Planned   |
| Slice 3: turn a loose idea into a draft trip                                             | Planned   |
| Slice 4: personalization                                                                 | Planned   |
| Slice 5: affiliate booking links                                                         | Planned   |

## Repository layout

```
packages/
  core/           business logic: domain, time rules, services, ports; no I/O, depends on nothing
  agent/          LLM loop, tools, prompts; provider-agnostic
apps/
  telegram-bot/   Telegram adapter and the program's entry point
  web/, mobile/   reserved for future clients
```

The structure is hexagonal (ports and adapters): the core holds all business logic and knows nothing about Telegram, HTTP, databases or LLM vendors. Dependencies point inwards (apps → agent → core), and `pnpm deps:check` enforces it. [ARCHITECTURE.md](ARCHITECTURE.md) explains how a web or mobile client gets added later without changing the core.

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
| Vitest                     | Regressions (tests arrive with slice 1)                                                                                                                 |
| secretlint                 | API keys, tokens and private keys in committed files                                                                                                    |
| lefthook                   | Runs the checks as git hooks. Pre-commit: format, lint and secrets on staged files, plus typecheck and tests. Pre-push: full lint, boundaries and tests |
| GitHub Actions             | The same `pnpm check` on a clean machine for every push to `main` and every pull request                                                                |

pnpm is configured not to run third-party install scripts.

## How it's built

Simplicity first: the simplest thing that works, with structure added only when a second real use appears. Each slice starts with a short spec listing example questions and their expected answers, then gets built test-first: a failing test, then the code that makes it pass. Decisions that are costly to reverse are recorded as Architecture Decision Records. The language-model layer is provider-agnostic: the agent talks to an LLM interface, and evals decide the model, including locally hosted ones.

Documentation:

- [ARCHITECTURE.md](ARCHITECTURE.md): the system map, with diagrams.
- [docs/product.md](docs/product.md) and [docs/roadmap.md](docs/roadmap.md): what we're building, and in what order.
- [docs/adr/](docs/adr/): Architecture Decision Records, the reasons behind each significant choice.
- [docs/learning/glossary.md](docs/learning/glossary.md): the AI-engineering and architecture concepts used here.
- [CLAUDE.md](CLAUDE.md): working rules for AI coding sessions in this repo.

## License

All rights reserved. A license has not been chosen yet.
