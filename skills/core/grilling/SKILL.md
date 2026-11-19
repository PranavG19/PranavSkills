---
name: grilling
description: Interview the user one question at a time, each with a recommended answer, until every design decision is resolved. Use before building anything non-trivial, when a plan needs stress-testing, or when the user says "grill me".
---

`grill → resolve the design tree one Q at a time (each with a recommended answer) → probe the hard concerns to real depth → hand off to spec`

Turn a fuzzy idea into a *resolved* design through relentless interview, then hand the decisions to `spec` to write up. Goal: shared, precise understanding before any code. "Resolved" means the hard concerns (security, scale, concurrency, edge cases) are decided to real depth, not waved at.

Reference: `_shared/CONTEXT-FORMAT.md`, `_shared/ADR-FORMAT.md`. Output target: `spec` + its templates in `_shared/spec-templates/`.

## The interview
Walk each branch of the design tree, resolving decisions and their dependencies one at a time.
- **One question at a time.** Never dump a list. It overwhelms and gets half-answered. Ask, wait, then ask the next informed by the answer.
- **Always give your recommended answer** and reasoning with the question. The user reacts faster to a proposal than an open prompt. On a genuine fork or close call, also name what would flip your recommendation, the answer, constraint, or evidence that would change it. Word the question so "yes" accepts your recommendation.
- **Locate every question in the experience before asking it.** Name the screen or scenario, what the user just did, what control or state is being discussed, and what happens immediately afterward. Never ask about an orphaned label such as `Change`, `Continue`, or `Retry` without first showing where it appears and what it affects.
- **If the codebase can answer it, read the code** instead of asking.
- **Drive toward precision, not coverage.** Stop when the decision tree is resolved, including the mandatory concerns below.

## During the session
- **Challenge vocabulary.** A fuzzy/overloaded word (Customer vs. User, "sync", "job") → propose one precise canonical term; conflict with a `CONTEXT.md` entry → flag immediately.
- **Use concrete scenarios.** Invent edge cases to force precision about a concept's boundary. Vague agreement collapses under a specific example.
- **Cross-reference reality.** Surface contradictions between what the user says and what the code does (read it).
- **Update `CONTEXT.md` inline** as terms resolve (lazily; glossary only).
- **Push a vague answer once, then bank it.** A fuzzy answer to a real decision gets one re-ask pinned to a concrete scenario that makes vagueness impossible. Still unresolved, record it as an explicit open decision for the user to close (never something `spec` guesses) and move on. Do not accept mush, and do not nag a third time.

## Probe bank, drive the hard concerns to depth
Generic prompts ("did you consider security?") produce generic specs; depth comes from *specific* questions tied to the artifact. Ask only the ones the design touches, one at a time, each with your recommended answer. The point is to make a vague answer impossible.

**Security / access (per resource, not "is it secure?")**
- Who can read this? Own-row only, a public flag, relationship-gated (friend/follower), role-gated, or anyone authenticated? State the exact predicate.
- Who can create / update / delete it, the same actor as reader, or different? Client-allowed or server-only?
- When two users share visibility (a feed, a group), what's the *exact* rule, and is it one-way or mutual opt-in?
- What's the trust boundary? What does the client decide vs. the server enforce? What happens if the client lies?
- *Where* is each rule enforced? Can the wrong thing be made **unrepresentable** (DB-engine RLS, a type, framework deny-by-default, a permission the code simply doesn't hold), or is it only *detected* by a test? Push for structural; settle for detection only when structural is genuinely impossible. To settle *where* the rule lives, call the Skill tool with `agent-arch`.
- What input is attacker-controlled, and where's the injection/abuse surface? What's logged vs. redacted?

**Reversibility & blast radius (for anything touching data, infra, money, credentials, contracts, other systems)**
- Is this operation **reversible** (revert + redeploy undoes it cleanly) or **irreversible** (destroys data, sends/charges, rotates a secret, deletes a tenant, drops a column, breaks a published contract)? Irreversible → it needs a *separate human-gated path*, not the autonomous one (see `triage`).
- What's the real blast radius (rows, downstream consumers, affected services), not the line count? (A 1-line subnet/CIDR or security-group change can recreate or cut off everything behind it.)
- For a schema/contract change, does old code survive the new shape and new code survive the old (N/N-1)? Is it expand → backfill → contract in *separate* ships? Does a field's *meaning/units* change (cents→dollars passes every type check and charges 100×)?
- How will the correctness of this be **verified by a signal the implementer didn't author**, via a spec-literal, a round-trip, a differential reference, or a canary? ("The tests pass" where the author wrote both is self-consistency, not proof. See `verify`.)

**Data & lifecycle**
- For each relationship: when the parent is deleted, what happens to the child (cascade, null it, or block the delete)? Why?
- Soft or hard delete? When something is soft-deleted, what happens to things that reference it (orphan strategy)?
- This field, is its set of values closed and stable (enum) or open and growing (text + check)?
- Type, nullability, default, precision for each field, decided, not "a number."

**Concurrency**
- Two of these happening at the same instant, what breaks? Counter under concurrent increment → atomic update, not read-then-write.
- For double-submit, retry, or offline-sync, how is a duplicate detected and rejected (client ID, idempotency key, ON CONFLICT)?
- What ordering does this assume? Is it eventually or strongly consistent, and does that match the UX?

**Scale**
- What query runs on the hot path, and is it bounded (LIMIT / cursor)? What index serves it?
- This table/log grows forever. Retention, pruning, or partitioning? Rough row count at target scale?
- Where's the first bottleneck, and what's the trigger to revisit it?

**Edge & failure**
- Empty, missing, partial, out-of-order, permission-denied. Name the behavior for each.
- When this external dependency fails, what does the user see? Retry, degrade, or fail loud?

## Hand off to `spec`
When the design tree is resolved, including every mandatory concern the artifact touches:
1. Call the Skill tool with **`spec`**. Pick the template (feature / data-model / api-contract / system), write up the decisions, run its **completeness gate**. `grilling` decides; `spec` documents.
2. `spec`'s gate surfaces an unresolved item → a **gap to bring back here**; keep interviewing, don't let `spec` guess.
3. **Offer an ADR** only for a decision that's hard-to-reverse AND surprising AND a real trade-off (all three, `ADR-FORMAT.md`). Don't manufacture them.

## Constraints
- No code here. This produces resolved decisions plus (via `spec`) a document, not an implementation.
- Don't pre-fill answers and move on. Wait for the user's real response on genuine decisions.
- A concern the artifact genuinely doesn't touch → mark out-of-scope with a reason, explicitly; don't skip silently.
