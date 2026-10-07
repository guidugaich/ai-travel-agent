# 0001. Record architecture decisions as ADRs

- Status: Accepted
- Date: 2026-10-06

## Context

This is a solo, AI-assisted project that is meant to grow from a portfolio piece into a product. Decisions get made in conversations and then forgotten. Future readers lose the reasoning behind them: the author months later, a new AI coding session with no memory of the discussion, a reviewer or a collaborator. A decision without its context tends to get re-argued, or reversed by accident.

## Options considered

1. **Nothing written down.** No overhead, but the reasoning is lost.
2. **One long design document.** Easy to start. It goes stale, and it's hard to tell when a decision was made or what it replaced.
3. **Architecture Decision Records** (Michael Nygard's format): one short file per decision, numbered, never rewritten after acceptance.

## Decision

Use ADRs in `docs/adr/`, numbered `NNNN-title.md`, following [template.md](template.md).

- **One ADR per significant decision.** That means anything costly to reverse or likely to be questioned: stack, libraries, boundaries, data model, protocols, hosting.
- **Accepted ADRs are not edited** beyond typo fixes. To change a decision, write a new ADR and mark the old one "Superseded by NNNN".
- **External facts carry a source and a date**, such as a library version or a pricing page, because they go stale.
- **The order of authority:** the product doc, roadmap and slice specs describe _what_ the system must do, ADRs record _why_ it's built this way, and `ARCHITECTURE.md` is the map that links them.

## Consequences

- A small writing cost per decision, paid once.
- Questions like "why TypeScript 6 and not 7?" have a findable answer.
- ADRs get written when a slice makes a decision that is costly to reverse, such as the database or the time library. Smaller decisions live in the slice spec.
