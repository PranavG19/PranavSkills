# Knowledge, Migration & Coordination

Per-axis core principles for documentation/knowledge management, multi-agent coordination, and legacy migration. Distilled from axes 37-39.

## Axis 37. Documentation & Knowledge Management

Code shows WHAT and HOW but never WHY. Without the WHY, agents "simplify" deliberate workarounds, reintroduce known bugs, and undo architectural decisions. Goal is the minimum effective documentation that gives correct context without drowning the agent in noise (too much docs IS noise; zero docs leaves the agent error-prone).

**Core principles**
- **Guardrails are mechanical, not advisory.** Every hard constraint has a defending test / CI-check / type (e.g. `conventions.json` → generated `invariants.ts` that CI enforces).
- **Single source of truth with generated views.** One authored file generates all derived artifacts; the spec cannot drift because enforcement IS the spec.
- **Separation of guardrails from orientation.** Guardrails are always-loaded ≤500 tokens + enforcement reference; orientation is JIT-loaded when entering an area.
- **Inline pointers at the decision site.** The code that manifests a decision carries `// ADR-003: reason`, so the agent discovers the constraint when it touches the code, not by speculative search.
- **CI-checked doc references.** Every file path in a comment/doc is verified to exist; broken links caught at build time, not after agents follow them.
- **Individual ADR files.** One per decision in `docs/decisions/NNN-title.md`; enables supersession, CODEOWNERS, independent blame/review (single-file ADR formats block supersession).
- **Docs earn their existence.** Each doc must prevent a specific agent-error class that code/tests/types cannot prevent; else delete.

**Antipatterns / findings**
- Phantom doc references (code points to nonexistent files) train agents to distrust ALL doc pointers.
- Missing inline ADR pointers, so decisions are discoverable only from tests, and agents modifying the constrained code never encounter them.
- Rulings/precedents not linked back from the application source they constrain.

Architecture is Mechanical Context Architecture (MCA). Guardrails-as-tests + single-source-of-truth with generated views + inline WHY-pointers + CI-checked references.

## Axis 38. Multi-Agent Coordination Patterns

How multiple agents work the same codebase simultaneously without conflicts, duplicate work, or merge disasters. Approach is Merge-Queue-First Coordination with Architectural Elimination.

**Core principles**
- **Eliminate before coordinating.** Restructure to remove sharing; split shared files into domain-owned pieces. If nothing is shared, nothing conflicts.
- **Merge queue is the coordinator.** No separate coordination service; the queue catches conflicts, serializes integration, and guarantees main never breaks.
- **Single writer for shared files.** `package.json`, `tsconfig`, migrations owned by one designated agent/human; others submit structured intents (not edits) the owner applies.
- **Small tasks, small PRs, fast CI.** 30-60 min tasks, 200-line PR limit; small PRs validate fast → shorter queue time → less drift → fewer conflicts.
- **Speculative continuation.** After submitting a PR, immediately start the next task on a branch from your own commit (optimistic merge); cheap to abandon if rejected.

**Conventions**
- Worktree-first. Every task starts with `git worktree add` (isolated filesystem, no dev interference).
- 200-line hard limit; split larger work into stacked PRs (interface-first phase 1 + implementation phase 2).
- One module per PR; cross-module changes are multi-PR sequences.
- Never directly edit shared root config. Submit structured intents for the config owner.

**Antipatterns**
- Coordination theatre. Advisory manifests, file locks, heartbeats agents can ignore.
- Predicted write sets. Upfront file declarations are wrong 40%+ of the time for non-trivial tasks.
- Distributed locking for files (e.g. Redis SETNX), complexity without matching need.
- Coordinator-as-semantic-reasoner. A coordinator that must understand task semantics to detect overlap is too expensive and too fragile.

## Axis 39. Legacy Code Migration & Strangler Fig

Safely migrate legacy codebases incrementally, no big-bang rewrites. Approach is Strangler Ratchet, Entity-Routed Incremental Migration with Completion Forcing.

**Core principles**
- **Entity-level routing.** Route by entity partition (e.g. user ID range), not endpoint or traffic percentage; entity N is always handled by exactly one system, eliminating dual-write corruption.
- **Deletion before migration.** First action for any module is a liveness check (90-day traffic, last commit, active callers); dead code gets deleted, not migrated.
- **One authoritative writer per entity.** A queryable Authority Registry declares which system owns each partition; dual-write is never acceptable.
- **Completion ratchet.** A non-negotiable old-system shutdown date enforced by scheduled infrastructure teardown; deadline-less migrations stall at ~80%.
- **Continuous parity as CI.** Parity verification runs nightly against all migrated modules (replay last 24h of production traffic); ongoing regression detection, not a one-time gate.
- **Small units, cheap failure.** Size each agent task to complete quickly so a failed migration is cheap to discard.

**Antipatterns**
- Big-bang shadow mode. Weeks of full shadow comparison before any cutover, procrastination for stateless endpoints.
- Dual-write as strategy. Both systems writing the same entity with reconciliation as safety net guarantees corruption under concurrent access.
- Migrating dead code. Re-implementing zero-traffic modules; delete instead.
- Verification infrastructure exceeding migration complexity. CDC streams / semantic diff engines for a 5-endpoint migration.
- Percentage-based splitting for stateful endpoints. 10%/90% for writes guarantees entity-level inconsistency.
