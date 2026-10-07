# Specs

Specs are the source of truth for what the system must do. Code follows them. Every feature goes spec → acceptance criteria → failing tests → implementation → refactor → docs.

These are written in **Phase 1**, after the product interview, and reviewed before any architecture or code work.

| #   | Spec                | Covers                                                                                                                          | Status      |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 00  | Product brief       | Target users, problems, scope, what's in and out                                                                                | Not started |
| 01  | Domain model        | User, Identity, Trip, Leg, Event, Place, Reminder, Conversation, ChangeLogEntry; invariants, state machines, revisions          | Not started |
| 02  | Time semantics      | Time representation rules, the Clock, timezone resolution, DST / date-line / overnight rules, ambiguity policy, worked examples | Not started |
| 03  | Tool contracts      | Every agent tool: typed inputs and outputs, validation, error codes, mapping to services and the API                            | Not started |
| 04  | Conversation flows  | Scripted dialogues: planning, "when do I leave?", rescheduling, landing in a new timezone, undo                                 | Not started |
| 05  | Eval plan           | How correctness is measured: test layers, LLM evals, release gates                                                              | Not started |
| 06  | Privacy and data    | What is stored and why, retention, export and deletion, secrets                                                                 | Not started |
| 07  | Client architecture | Channel adapters, content blocks, capabilities, notifications, identity linking, API surface                                    | Not started |
| —   | ROADMAP             | Vertical slices in order, each with acceptance criteria                                                                         | Not started |
