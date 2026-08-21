# Local ticket format

A ticket is one vertical, observable slice that fits in a fresh context. Boards live at
`.agents/tickets/`; one Markdown file is the source of truth for each ticket.

## Filename and metadata

Use `T-NNN-short-slug.md` and this exact frontmatter:

```yaml
---
id: T-001
title: Add resumable upload
status: backlog
priority: 2
mode: human
depends-on:
claimed-by:
spec: path/to/spec.md#section
---
```

- `status`: `backlog | ready | in-progress | review | approved | blocked | done`
- `priority`: `1` highest through `5` lowest
- `mode`: `afk` only for reversible work with a deterministic check; otherwise `human`
- `depends-on`: comma-separated ticket IDs, or empty
- `claimed-by`: empty until atomically claimed through the board CLI

## Required body

```markdown
## Outcome

The user-visible behavior or system property this slice leaves working.

## Acceptance criteria

1. Given <specific state>, when <action>, then <observable result>.
2. Include the relevant empty, error, permission, boundary, and concurrent cases.

## Context

- Settled decisions and exact spec sections
- Existing files/modules that demonstrate the pattern and must be read
- Likely modules this slice will modify, and why
- Reversibility and safety constraints

## Scope

- Required behavior
- Explicitly untouched behavior and interfaces
- Dependency outputs this ticket consumes

## Test and verification plan

- First behavioral test and why it must fail on the parent state
- Project typecheck/lint/test commands
- Independent oracle for critical claims, or an honest self-consistent-only label
- Observable demo when the ticket is complete

## Evidence

Filled during implementation and review: red/green commands, final checks, review verdict, and
blocks. Keep transcripts out; record the proving lines and artifact paths.
```

## Decomposition rules

1. **Slice by behavior.** Cross every required layer to leave one result a user or caller can
   observe. Schema-only, API-only, UI-only, and tests-later tickets are horizontal fragments.
2. **Fit one fresh context.** The ticket, referenced spec sections, code exemplars, change, tests,
   and review evidence must stay bounded. Split when that packet is not comfortably inspectable.
3. **Build a DAG.** Add only real prerequisites. A ticket becomes ready when every dependency is
   done; parallelism comes from independent ready nodes, not optimistic overlap.
4. **Keep tests inside the slice.** Acceptance criteria drive red-green-refactor during the same
   ticket.
5. **Keep one writer.** Tickets that touch the same file, symbol, migration sequence, or lockfile
   are dependent or merged.
6. **Earn AFK.** The work is reversible, fully specified, sandboxed, and has a deterministic
   completion signal. Missing any one means `mode: human`.
7. **Close visibly.** Review moves a ticket to done. Human QA creates follow-up tickets rather than
   expanding completed scope.
