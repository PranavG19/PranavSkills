---
name: spec
description: Produce a decision-complete design document that leaves nothing for the implementer to decide. Use when writing up a design already settled, documenting an existing system as a spec, or writing a schema/API/system design doc.
---

`spec → pick template (feature | data-model | api-contract | system) → fill every section → run completeness gate → no decision left to the implementer`

A spec is decision-complete when an implementer (human or agent) can build it **without making a single design choice** — they only translate. Any question that would come up during implementation belongs answered in the spec. The bar: parallelize this across several agents and they produce consistent, correct, integrated code.

Most specs are *under*-decided — they state intent and leave the hard parts ("how do deletes cascade?", "what under concurrent writes?", "who can read this row?") to be improvised mid-build. That improvisation is where bugs, security holes, and rework come from. This skill closes every one of those gaps **before** code.

## Where the decisions come from

`spec` captures decisions already made. Three sources, same handling:

- **The current conversation** — design already hashed out, with the user or in your own reasoning. Write up what's settled rather than re-interviewing it.
- **Existing code** — reverse-engineering a spec from a system that exists. Read it and capture the decisions it encodes.
- **A `grilling` session** — the design is *not* resolved yet; `grilling` interviews it to resolution, then hands off here.

A section that can't be filled from the source is an **open question** — surface it as one. Never fill a gap with a guess; a spec built on guesses is worse than an honest open-questions list.

## How to use it

1. **Establish the decision source** (above). Unresolved and needing interactive teasing-out → run `grilling` first; otherwise proceed.
2. **Pick the template** from `skills/_shared/spec-templates/`:
   - `feature.md` — a product feature / capability.
   - `data-model.md` — a database schema or data layer.
   - `api-contract.md` — a REST/RPC/service interface.
   - `system.md` — a multi-component / cross-service design.
   - Mix blocks when work spans domains (a feature with a schema plus endpoints pulls all three).
3. **Fill every section.** "TBD" marks an open question, not a finished spec.
4. **Run the completeness gate** below; anything unchecked is unfinished.
5. **Add an implementation map.** Name the existing modules likely to change, the responsibility
   each owns, and the interfaces between them. This is a map for ticket slicing, not a frozen file
   list; verify it against the live repository before implementation.
6. **Use `CONTEXT.md` vocabulary throughout.** Prose over code snippets, which rot — the exception
   is a small fragment encoding a decision more precisely than prose can (a state machine, a schema
   row, a type shape); inline only that, and note it came from design.

## Completeness gate — MANDATORY before a spec is "done"

Each item is either resolved in the doc or explicitly marked out-of-scope **with a reason**:

**Correctness & data**

- [ ] Every entity/field: type, constraints, nullability, default.
- [ ] Every relationship: cascade behavior on delete/update (CASCADE / SET NULL / RESTRICT) and *why*.
- [ ] Every state machine: the legal states and transitions; what's immutable.
- [ ] Edge cases: empty, missing, duplicate, out-of-order, partial — named with the decided behavior.

**Security** (mandatory — resolved, never "TBD")

- [ ] Trust boundary: who/what is authenticated vs. anonymous; client vs. server authority.
- [ ] Authorization *per resource*: who can read / create / update / delete each one, and the exact rule (own-row, public-flag, relationship-gated, role-gated). Depth matters — "secured" is not an answer; "SELECT allowed if own-row OR public OR accepted-friend OR shared-workspace" is.
- [ ] **Enforcement placement**: for each safety property, *where* it is enforced — made structurally **unrepresentable** (DB-engine RLS, a type, framework deny-by-default, a permission the code doesn't hold) or merely **detected** (a test, a check). Structural beats detection for anything that matters; detection-only needs a stated reason structural wasn't possible. (See `agent-arch` for the structural > detection ladder.)
- [ ] Input validation & injection surface; secret/PII handling; what's logged vs. redacted.

**Reversibility & blast radius** (mandatory when the work touches data, infra, money, credentials, contracts, or other systems)

- [ ] Each operation classified **reversible vs irreversible** (see `triage`). Irreversible ones — destructive DDL/DML, backfills, charges/sends, secret rotation, tenant delete, foundational infra, breaking or semantic contract changes — are named, and their path is a *separate human-gated* one rather than folded into the autonomous path.
- [ ] Blast radius named in real terms (rows, downstream consumers, affected services), not line count. A 1-line change can recreate every resource in a subnet or lock a 500M-row table.
- [ ] For schema/contract evolution: the expand → backfill → contract sequence, with expand and contract in *separate* ships; N/N-1 compatibility stated (old code survives the new schema, new code survives the old).
- [ ] Validated against **production-representative scale** rather than an empty/tiny dev set (the empty-DB trap).

**Scale & performance** (mandatory)

- [ ] Index strategy: what's indexed and which queries it serves.
- [ ] Hot-path queries: the actual query shapes, and that they're bounded (LIMIT/pagination/cursor).
- [ ] Growth: retention/pruning/partitioning for append-only or unbounded data; expected row counts at target scale.
- [ ] Known bottlenecks named, with the trigger to revisit ("profile above 20 tenants").

**Concurrency & consistency** (mandatory)

- [ ] Concurrent writes to the same state: the pattern (atomic increment vs. read-then-write, locking, idempotency keys).
- [ ] Ordering/timing assumptions; what's eventually vs. strongly consistent.
- [ ] Offline/duplicate-submit handling where relevant (client IDs, ON CONFLICT).

**Lifecycle & integration**

- [ ] Delete semantics: soft vs. hard, and the orphan strategy for references.
- [ ] Migration/rollout: backward compatibility, idempotency, how it ships incrementally.
- [ ] Failure modes: what happens when a dependency or external call fails.

**Testing**

- [ ] Test seams (highest level reaching the behavior; prefer existing ones); what a good test asserts (external behavior).
- [ ] **Verification oracle** for each correctness-critical claim: where the expected value comes from, and whether the implementation can reach it. Name an *independent* oracle — spec-literal, round-trip/inverse, differential reference, mutation on the critical path, edge SLI / canary / screenshot — rather than a test that re-derives the code's own formula. A claim whose only check is a test the implementer also wrote is **self-consistent, not verified** (see `verify`).

**Naming & conventions**

- [ ] Names follow the project's existing conventions, checked rather than assumed. Discriminators: enum (closed/rare) vs. text (open/grows) decided per field, with reasoning.

Any mandatory box that can't be checked **blocks** the spec on that decision — resolve it from the conversation, from code, or via `grilling` when it needs interactive teasing-out.

## After the spec is done

A finished spec is ready for `to-tickets`; each vertical slice inherits its decisions, acceptance
criteria, implementation map, and verification requirements. This skill's job ends when the
completeness gate passes.

## Constraints

- Decision-complete or it's not done. "The implementer will figure it out" is the failure this skill prevents.
- Match project conventions over generic best practice; read them first (`CONTEXT.md`, the existing schema/API, the project's agent context file).
- Scale rigor to the work: a small internal helper doesn't need the full data-model gate. The mandatory security/scale/concurrency items apply when the work *touches* those concerns — a pure-function utility legitimately marks them out-of-scope, stated explicitly rather than skipped silently.
