# ADR format

Architecture Decision Records live in `docs/adr/`, numbered (`0001-short-title.md`).

Write an ADR **only when all three hold**:
1. **Hard to reverse.** Undoing it later is expensive.
2. **Surprising without context.** A new reader would wonder "why on earth did they do this?"
3. **The result of a real trade-off.** You chose one option over genuine alternatives.

If any one is missing, do not write an ADR. Most decisions don't need one.

## Template

```markdown
# <NNNN>. <Short title in the form of a decision>

Status: Accepted | Superseded by <NNNN> | Proposed
Date: <YYYY-MM-DD>

## Context
The forces at play: what's true about the system and the problem that made this
decision necessary. State it neutrally. Someone who disagrees with the outcome
should still agree with the context.

## Decision
What we decided, in active voice. "We will ..."

## Consequences
What becomes easier and what becomes harder as a result. Include the costs you're
knowingly accepting, not just the benefits.

## Alternatives considered
Each real option, and the specific reason it lost.
```
