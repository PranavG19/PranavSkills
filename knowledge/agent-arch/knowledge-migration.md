# Knowledge, Migration & Coordination

Per-axis core principles for documentation/knowledge management, multi-agent coordination, and legacy migration. Distilled from axes 37–39.

## 37 — Documentation & Knowledge Management

Code shows WHAT and HOW but never WHY. Without the WHY, agents "simplify" deliberate workarounds, reintroduce known bugs, and undo architectural decisions. Goal: the minimum effective documentation that gives correct context without drowning the agent in noise (too much docs IS noise; zero docs leaves the agent error-prone).

**Core principles**
- **Guardrails are mechanical, not advisory** — every hard constraint has a defending test / CI-check / type (e.g. `conventions.json` → generated `invariants.ts` that CI enforces).
- **Single source of truth with generated views** — one authored file generates all derived artifacts; the spec cannot drift because enforcement IS the spec.
- **Separation of guardrails from orientation** — guardrails = always-loaded ≤500 tokens + enforcement reference; orientation = JIT-loaded when entering an area.
- **Inline pointers at the decision site** — the code that manifests a decision carries `// ADR-003: reason`, so the agent discovers the constraint when it touches the code, not by speculative search.
- **CI-checked doc references** — every file path in a comment/doc is verified to exist; broken links caught at build time, not after agents follow them.
- **Individual ADR files** — one per decision in `docs/decisions/NNN-title.md`; enables supersession, CODEOWNERS, independent blame/review (single-file ADR formats block supersession).
- **Docs earn their existence** — each doc must prevent a specific agent-error class that code/tests/types cannot prevent; else delete.

**Antipatterns / findings**
- Phantom doc references (code points to nonexistent files) train agents to distrust ALL doc pointers.
- Missing inline ADR pointers — decisions discoverable only from tests, so agents modifying the constrained code never encounter them.
- Rulings/precedents not linked back from the application source they constrain.

Architecture: Mechanical Context Architecture (MCA) — guardrails-as-tests + single-source-of-truth with generated views + inline WHY-pointers + CI-checked references.

## 38 — Multi-Agent Coordination Patterns

How multiple agents work the same codebase simultaneously without conflicts, duplicate work, or merge disasters. Approach: Merge-Queue-First Coordination with Architectural Elimination.

**Core principles**
- **Eliminate before coordinating** — restructure to remove sharing; split shared files into domain-owned pieces. If nothing is shared, nothing conflicts.
- **Merge queue is the coordinator** — no separate coordination service; the queue catches conflicts, serializes integration, and guarantees main never breaks.
- **Single writer for shared files** — `package.json`, `tsconfig`, migrations owned by one designated agent/human; others submit structured intents (not edits) the owner applies.
- **Small tasks, small PRs, fast CI** — 30–60 min tasks, 200-line PR limit; small PRs validate fast → shorter queue time → less drift → fewer conflicts.
- **Speculative continuation** — after submitting a PR, immediately start the next task on a branch from your own commit (optimistic merge); cheap to abandon if rejected.

**Conventions**
- Worktree-first: every task starts with `git worktree add` (isolated filesystem, no dev interference).
- 200-line hard limit; split larger work into stacked PRs (interface-first phase 1 + implementation phase 2).
- One module per PR; cross-module changes are multi-PR sequences.
- Never directly edit shared root config — submit structured intents for the config owner.

**Antipatterns**
- Coordination theatre: advisory manifests, file locks, heartbeats agents can ignore.
- Predicted write sets: upfront file declarations are wrong 40%+ of the time for non-trivial tasks.
- Distributed locking for files (e.g. Redis SETNX): complexity without matching need.
- Coordinator-as-semantic-reasoner: a coordinator that must understand task semantics to detect overlap — too expensive, too fragile.

## 39 — Legacy Code Migration & Strangler Fig

Safely migrate legacy codebases incrementally — no big-bang rewrites. Approach: Strangler Ratchet — Entity-Routed Incremental Migration with Completion Forcing.

**Core principles**
- **Entity-level routing** — route by entity partition (e.g. user ID range), not endpoint or traffic percentage; entity N is always handled by exactly one system, eliminating dual-write corruption.
- **Deletion before migration** — first action for any module is a liveness check (90-day traffic, last commit, active callers); dead code gets deleted, not migrated.
- **One authoritative writer per entity** — a queryable Authority Registry declares which system owns each partition; dual-write is never acceptable.
- **Completion ratchet** — a non-negotiable old-system shutdown date enforced by scheduled infrastructure teardown; deadline-less migrations stall at ~80%.
- **Continuous parity as CI** — parity verification runs nightly against all migrated modules (replay last 24h of production traffic); ongoing regression detection, not a one-time gate.
- **Small units, cheap failure** — size each agent task to complete quickly so a failed migration is cheap to discard.

**Antipatterns**
- Big-bang shadow mode: weeks of full shadow comparison before any cutover — procrastination for stateless endpoints.
- Dual-write as strategy: both systems writing the same entity with reconciliation as safety net — guarantees corruption under concurrent access.
- Migrating dead code: re-implementing zero-traffic modules; delete instead.
- Verification infrastructure exceeding migration complexity: CDC streams / semantic diff engines for a 5-endpoint migration.
- Percentage-based splitting for stateful endpoints: 10%/90% for writes guarantees entity-level inconsistency.
