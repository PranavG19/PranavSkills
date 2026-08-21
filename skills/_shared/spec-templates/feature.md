# Feature spec template

For a product feature / capability. The general decision-complete spec. If the feature includes a schema or endpoints, pull in the `data-model` / `api-contract` blocks for those parts.

```markdown
# <Feature> — Spec

## Problem
The problem from the user's perspective. Why it matters now.

## Solution
The solution from the user's perspective — the experience, not the mechanism.

## User stories
A long, numbered list covering the whole surface: "As a <actor>, I want <capability>, so that <benefit>." Include happy path, edge cases, error states, empty states, permissions. If a story implies a decision, that decision goes in Decisions below.

## Decisions
The design decisions, locked. Modules built/modified and their interfaces; data shapes; key interactions; state machines (legal states + transitions). Decisions, not file paths. Inline a small fragment (schema row, state machine, type) only where prose is less precise.

## Acceptance criteria
Numbered, observable outcomes that later become vertical tickets. Include the happy path and the
specific edge, permission, failure, and concurrency behavior that matters.

## Implementation map
The existing modules likely to change, what each owns, their interfaces, and the repository files
that demonstrate the pattern. Treat this as an orientation map, not a frozen implementation plan.

## Edge cases & states
Each named with the decided behavior: empty, loading, error, partial, duplicate, offline, permission-denied, concurrent. The cases that usually get improvised mid-build — decide them here.

## Security (MANDATORY)
Trust boundary; authorization per action (the exact rule, not "secured"); input validation; PII/secret handling; what's logged vs. redacted. If the feature has no security surface, say so and why.

## Scale & performance (MANDATORY)
Hot paths and that they're bounded; data growth and retention; expected volume. If trivially small, say so and why.

## Concurrency (MANDATORY)
Concurrent-use handling (shared state, double-submit, race conditions); ordering/consistency assumptions. If single-user/stateless, say so and why.

## Lifecycle
Create/update/delete semantics; soft vs. hard delete; orphan handling; migration/rollout and backward compatibility; how it ships incrementally.

## Failure modes
What happens when each dependency/external call fails; degraded behavior; retries.

## Out of scope
What this explicitly does not cover, so the boundary is unambiguous.

## Testing
Test seams (highest level reaching the behavior; prefer existing seams; prior art in the codebase). What a good test asserts — external behavior, not implementation.

## Open questions
Anything unresolved, with who/what is needed to resolve it. A finished spec has none in its mandatory sections.
```
