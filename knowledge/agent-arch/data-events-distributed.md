# Data, Events & Distributed Systems

Per-axis core principles for schema migration, event/contract evolution, sagas, event sourcing, temporal coordination, and concurrency. Distilled from axes 23–28. NOTE: several of these axes touch irreversible operations and cross-system temporal boundaries — the escalation trigger (STOP, request human review) applies.

## 23 — Data / Schema-Migration / Stateful-Change Axis

The strongest irreversibility class: DROP COLUMN / wrong backfill on 100M rows has no rollback; a migration that locks a table for hours is a self-inflicted outage. Verdict: **OBSERVE-THEN-PROCEED — Computed-Risk Safe-Migration Pipeline.** Classification sets HOW CAUTIOUSLY to proceed (observation intensity), not WHETHER. Risk is COMPUTED deterministically from (SQL AST × production row-count × lock-class × consumer-count × engine-version) — the agent NEVER self-classifies.

**Core principles**
- OBSERVATION OVER PREDICTION: even "SAFE" migrations run under monitoring (lock_timeout, post-assertions); DESTRUCTIVE run under max observation + human approval.
- COMPUTED RISK, NOT DECLARED: agent cannot influence its risk score. Two tiers, hard boundary — ADDITIVE (score 0-20: agent-autonomous, lock_timeout=5s, round-trip tested) vs MODIFYING-OR-DESTRUCTIVE (score 21+: human-gated, escalating ceremony).
- LOCK DURATION IS THE PRIMARY OPERATIONAL RISK: data loss from DROP is catastrophic but rare (linter catches it); lock-duration outages from "safe" ops (ADD NOT NULL DEFAULT on pre-PG11, CREATE INDEX without CONCURRENTLY on 500M rows) are the common catastrophe.
- TEMPORAL SEPARATION IS A PIPELINE PROPERTY: expand/contract (parallel-change) requires time between phases — a merge gate physically prevents contract until expand has been live N deploy cycles. Not prose discipline.
- BACKFILLS ARE NOT MIGRATIONS: DDL (structure) vs DML (data) have different safety properties. Backfills run in a job scheduler (batched, idempotent, resumable, throttled), NEVER in migration files.
- IRREVERSIBILITY IS DECLARED, NOT DISGUISED: a migration is either reversible (round-trip tested with production-representative data) or explicitly irreversible (routes to human + backup-exists). No fake downs (re-add dropped column as nullable-NULL = structurally reversible, semantically destructive).
- THE AGENT WRITES MIGRATIONS; HUMANS APPROVE DESTRUCTION: agent's context window cannot discover ALL consumers of a table. Human DBA approval for the destructive 5%.

**Expand/contract (parallel change) — the only safe discipline**
- EXPAND (add new, dual-write, both schemas coexist) → BACKFILL (migrate existing data) → CONTRACT (remove old, after verification). Each deploy independently rollback-able. Min 3 separate deploys over days. NEVER combine expand+contract in one PR (even separate files = zero rollback window).
- Production write audit before contract: pg_stat_statements for all writes to target table in last 14 days; unmatched writes block contract. Catches dual-write divergence (write paths outside the agent's context window).
- Two-phase drop: stop writing → rename to `_deprecated_YYYYMMDD` → verify zero reads for full consumer-cycle dwell → THEN drop via separate human-approved PR.

**Conventions & guardrails**
- ALWAYS read current schema state (migration manifest / pg_dump --schema-only) before writing a migration.
- NEVER write DML >10 rows in a migration file (CI rejects it). Backfills: batched (1000-10000 rows), cursor-based, sleep 100ms between, watermark-resumable, idempotent, verifiable (count/checksum).
- NEVER execute destructive DDL (DROP / TRUNCATE / ALTER-TYPE-narrowing) autonomously → human DBA approval, backup-exists precondition, 7-30 day access-monitored dwell.
- Tables >1M rows: use online-schema-change tools (gh-ost, pt-osc, pg_repack) not direct ALTER. Timing gate confirms (lock >5s → escalate; runtime >5min → require OSC tool). lock_timeout=5s at execution (abort > queue).
- Write the DOWN; if irreversible, declare it and include backup statement. Post-DOWN assertion: COUNT(col IS NOT NULL) ≥ pre_count detects fake downs.
- N/N-1 compatibility: two CI jobs ("old-code-new-schema" + "new-code-old-schema") must both pass (rolling-deploy safety). Make new columns nullable with DEFAULT.
- Production statistics feed (reltuples, table size, engine version) exported every 6h, committed; staleness >48h blocks all non-additive migrations.
- Semantic destruction detection: entropy-reducing DML (SET col=NULL/0/'' on populated, DELETE without restrictive WHERE) classified DESTRUCTIVE regardless of DDL absence.
- Trust the computed risk score over your own assessment — it uses production row counts and engine-specific lock behavior you can't hold in context.

**Antipatterns**: collapsed expand/contract; empty-test-DB validation (0 rows in CI, 500M in prod); self-classification; single-statement / in-transaction backfill; calendar-based dwell without access monitoring (monthly/quarterly/DR consumers stay invisible); fake down migration; semantic destruction via DML; agent executing destructive DDL; treating all ADD COLUMN as safe (engine-version-aware classification needed).

## 24 — Event Schema & API Contract Evolution Axis

The distributed sibling of migration: persisted messages/events/API payloads across Kafka, SQS, event stores, caches, client-side storage, consumed by N independent services. A breaking change RETROACTIVELY corrupts stored data for the full retention window. Consumer discovery is STRUCTURALLY UNSOLVABLE (can't prove absence of unknown consumers). Verdict: **Immutable Contract Evolution Architecture (ICEA)** — safety by CONSTRUCTION, not enumeration.

**Core principles**
- SCHEMAS ARE FOREVER: once published+consumed, a field's name, type, semantics, units, value domain are frozen. To change meaning OR type → add a new field. Fields are never removed from the active schema — only deprecated with a sunset timeline.
- SAFETY BY CONSTRUCTION, NOT ENUMERATION: FULL_TRANSITIVE compatibility mode is the non-negotiable default for any topic/queue with retention >24h. Guarantees ANY consumer holding ANY historical reader schema can deserialize ANY future message — protects unknown consumers.
- REGISTRY-ON-THE-WIRE AS INFRASTRUCTURE: the registry physically prevents unregistered events (broker-level rejection of messages without valid schema-registry reference). NOT a CI check (bypassable), not a recommendation — infrastructure the agent cannot route around.
- SEMANTIC IMMUTABILITY IS MECHANICAL: static taint analysis in CI traces each published field's computation path; if the expression tree changes but the semantic-version annotation doesn't bump, the build fails. Prevents silent meaning changes (e.g. "amount" cents→dollars, charges 100×) that pass structural checks.
- ASYMMETRIC COST FRAMING: false-negative (blocking a safe change) costs hours; false-positive (allowing a breaking change to stored data) costs weeks of remediation across N services + permanent corruption. Be PESSIMISTIC — block by default.
- AUTONOMY IS EVIDENCE-BASED: agent proceeds IFF it can produce a proof-of-safety: registry acceptance under FULL_TRANSITIVE + no semantic taint + payload within budget + consumer lag clean post-deploy. Missing any element = STOP.

**Breaking-change ceremony**: when the registry REJECTS under FULL_TRANSITIVE (definitive proof it's breaking) → STOP, no workarounds. Create a NEW event type on a NEW topic (e.g. order-events-v2), deploy a routing transformer on the old topic (v1→v2 forward, itself schema-registered), old consumers unchanged, new consumers opt-in on their own timeline. Old topic lives as long as anyone reads it.

**Conventions & guardrails**
- NEVER produce events without a registry-aware serializer (no raw JSON, no hand-rolled serialization — the first unregistered message is the first crack).
- NEVER remove a field from an active schema (deprecate with sunset date) or change a field's semantics without adding a new field.
- Treat enum additions as POTENTIALLY BREAKING (exhaustive-match consumers without a default clause fail) — require proof of default-handling.
- APIs with external consumers: version in URL path, never break /v1, min 12-month deprecation, Sunset header, monitor lingering clients. An event schema is a PUBLIC API even if all current consumers are internal.
- Schema archaeology gate (CI): for retention >7d / compacted topics, fetch ALL historical schema versions, generate a test message for each, verify the new reader deserializes ALL.
- Payload budget gate: p99 size increase >10% = operationally-breaking (OOMs memory-constrained consumers).
- Contract testing (Pact/can-i-deploy) complements the registry, never replaces it; contracts >90d unupdated = stale = confidence DOWNGRADE (stale contract is worse than none — converts UNKNOWN into false GREEN).
- Post-deploy: monitor consumer lag for 15-30min (spike → auto-rollback the schema version); DLQ depth spike = schema incompatibility signal (the DLQ count IS the regression detector). Mandatory DLQ policy (route after 3 failed deserialization attempts) prevents poison-pill blocking the whole consumer group.

**Antipatterns**: self-certifying from own tests (tests ONE consumer of N); "additive = definitionally safe" (breaks FAIL_ON_UNKNOWN_PROPERTIES deserializers, OOMs, crashes exhaustive-match); semantic reuse (silent 100× corruption); registry bypass via JSON; consumer discovery as a safety mechanism; stale contracts as green; dual-publish via app code (Promise.all without transactional guarantee); in-place breaking change; reusing deleted Protobuf field numbers; removing the DLQ to silence the poison-pill alert.

## 25 — Multi-Service Orchestration & Saga Evolution Axis

Long-running distributed workflows (sagas, choreographies, process managers) coordinating via event sequences with COMPENSATION semantics. A 5-step saga has 32 failure patterns; 7-step has 128. Wrong compensation = saga stuck permanently (money taken, goods never shipped, no refund). Verdict: **Saga Evolution Safety Architecture (SESA) — Containment-First, Complexity-Bounded.** Safety from structural simplicity + runtime containment, NOT elaborate static verification that drifts.

**Core principles (selected)**
- ELIMINATION BEFORE TOOLING: before any saga machinery, prove each step CANNOT be an independent eventually-consistent operation (TTL-based soft reservation, idempotent convergence, fire-and-forget with reconciliation). The safest saga is the one that doesn't exist.
- HARD 3-STEP DEFAULT, 7-STEP ABSOLUTE MAX: 3 steps = 8 exhaustive failure paths (testable); 7 = 128. The step-count cap is a VERIFICATION BOUNDARY, not a context boundary. >3 requires explicit justification + sub-saga decomposition at step 4.
- COMPENSATION IS A PROTOCOL, NOT A FUNCTION: declares forward action's observable states, valid compensation per state (authorized vs captured vs settled each differ), temporal validity window (refund after 30d may be impossible), a confirmation query (check CURRENT state before firing — defeats the phantom-completion problem), and a fallback when the window expires.
- CONTAINMENT-FIRST, PREVENTION-SECOND: assume the worst bug WILL ship. Primary safety = runtime compensation quarantine breaker (compensation failure rate >1% in 5min → HALT new saga instances + quarantine failing ones to DLQ + alert; do NOT retry into a deeper hole). Bounds worst case from "all orders this week" to "orders in the last 5 minutes."
- ORCHESTRATION-ONLY FOR COMPENSABLE FLOWS: any process needing compensation MUST use orchestration (central state machine = ONE file shows the whole flow). Choreography legitimate only for fire-and-forget. Agent MUST refuse to modify a choreography that requires compensation.
- VERSION-PINNED COMPENSATION: compensation dispatches to the worker version current at saga-instance CREATION, not deploy time (Temporal Build-ID routing). Platform enforcement, not convention — else every compensation deploy is a backwards-incompatible change to in-flight instances.
- SINGLE-RESPONSIBILITY PER STEP: one external mutation, one compensation. Static analysis rejects count >1. Guarantees 1:1 step-to-compensation (no multi-mutation gaps where a second charge has no refund).
- SAGA-SCOPED STATE ISOLATION: steps operate on state keyed by saga instance ID, never global state (eliminates version-coexistence deadlocks).
- DERIVED ARTIFACTS, NEVER AUTHORED: the saga map is GENERATED from workflow code (static analysis) — drift structurally impossible.
- PLATFORM ENFORCEMENT OVER YAML LINTING: invariants enforced at runtime by the orchestration platform; linting is fast feedback, platform is the gate.

**In-flight compatibility**: instances started on the old version must COMPLETE after the new version deploys (drain can take days). STOP and escalate if in-flight instances have compensation incompatible with the new version — wait for drain OR confirm version-pinned routing active before deploying.

**Conventions & guardrails**
- NEVER modify a saga without reading the generated saga map; NEVER add a step without its compensation protocol.
- Irreversible steps (send email, charge with no refund, regulatory filing) MUST be TERMINAL (last) or behind a confirmation gate; non-terminal irreversible = hard CI fail.
- NEVER hardcode timeouts → derive from production p99 × 3; CI rejects timeout < 2× p99; new steps with no prod data require a load-test gate.
- Failure testing: ≤3 steps → test ALL 2^N combinations in CI; 4-7 → property-based 1000 random sequences + all singles + all doubles.
- Per-path compensation tracking: any compensation action with 0 executions in 30 days = untested in production = likely wrong (the zero-execution metric is the canary). Mandatory quarterly chaos injection exercises each path.

**Antipatterns**: choreography with compensation; compensation as static inverse (ignoring state/temporal validity); hardcoded timeouts; multi-mutation steps; YAML-as-safety; version-unaware compensation deploy; TLA+ as a gate (model drifts within a sprint); aggregate compensation metrics (hide rare-path failures); irreversible step in the middle; global mutable state from saga steps.

## 26 — Event Sourcing & Projection Evolution Axis

Immutable append-only event log; projections (read models) materialize it. Modifying a projection re-interprets ALL historical events on next replay — re-processing millions to billions of events, potentially corrupting every query. Verdict: **Epoch-Gated Projection Evolution (EGPE)** — partition so full replay is never the default, make correctness continuous, bound rebuild scope.

**Core principles**
- READ MODEL = f(EVENT LOG) IS A RUNTIME INVARIANT: enforced via database grants (projection service owns writes; all others SELECT-only), continuous divergence detection, and structural impossibility of direct read-model mutation. When read model and event log disagree, the LOG IS ALWAYS RIGHT.
- UPCASTERS ARE PROJECTION LOGIC, NOT INFRASTRUCTURE: co-located with the projection (one source tree, one content hash, one test suite, one deploy unit). Transform old event shapes → current (chained v1→v2→v3). Shared "generic" upcaster libraries produce silent defaults that projections misinterpret.
- CLASSIFY BEFORE REBUILDING (AST-diff, never default to full): (A) FORWARD-ONLY — new handler, no existing logic touched → deploy immediately, no rebuild (~80% of changes); (B) TARGETED-REPLAY — handler body changed → replay only affected event types; (C) FULL-REBUILD — output schema restructured → epoch-bounded replay from a pre-validated checkpoint, NOT from event 0.
- CORRECTNESS IS CONTINUOUS, NOT DEPLOYMENT-TIME: an hourly divergence detector (stratified sample replay vs live read model) runs FOREVER — catches runtime bugs, slow upcaster drift, infrastructure failures (missed events). Separate service, separate credentials, separate monitoring (a projection checking its own correctness is a mirror oracle).
- SNAPSHOTS HAVE PROVENANCE: each snapshot stores a content-hash of projection+upcaster code at build time. On logic change, ALL prior-version snapshots are INVALIDATED. A POISONED SNAPSHOT (built under buggy logic) perpetuates the bug through rebuilds; only guaranteed-correct recovery is replay-from-zero (or from a known-good checkpoint).
- TEMPORAL GAPS ENCODED IN TYPES: `ProjectedState<T, Confirmed(position)>` vs `ProjectedState<T, Eventual(lastKnown, lag)>` — the agent cannot access Confirmed state without checking position (compiler forces temporal awareness; read-after-write is NOT default).
- EPOCH PARTITIONING BOUNDS REBUILD SCOPE: log partitioned into time-based epochs (quarterly) with a pre-validated checkpoint at each boundary (weekly offline reconciliation). Full-rebuild processes only the current epoch (~250M events / ~45min vs 1B / ~24h). Epochs >1yr frozen.

**Corrective events**: events are immutable FACTS — to fix, append a corrective event (e.g. AmountCorrected) with declared semantics (ABSOLUTE or RELATIVE+idempotency-key). Projections must handle corrections; test with synthetic injection (the divergence window statistically never sees real corrections at 0.001% of traffic).

**Conventions & guardrails**
- NEVER directly UPDATE/INSERT the read-model table (grants give SELECT only). Fix the PROJECTION CODE and let the rebuild fix the data — direct mutation is overwritten by the next event.
- ALWAYS read the event catalog (all types × schema versions, sample payloads, knownAnomalies) before writing a projection; trust the classification gate verdict.
- Upcaster tests require SEMANTIC assertions (specific field values vs known-good references), not just deserialization success; flag any DEFAULTED field used in business aggregation (sums/counts) for human sign-off.
- On "stale data" complaints: check projection lag FIRST; if lag is normal and data is still wrong, the projection has a bug — fix code not data.
- Blue-green rebuild for Tier B/C: green builds into a separate read model while blue serves; dual-write window compares outputs on live + synthetic correction events; swap threshold <0.01% divergence; rollback = revert to blue (zero data loss).
- Tombstone handlers for deleted event types (frozen last-known-good behavior); CI fails if any registered event type has no handler. Verify snapshot provenance hash before use.

**Antipatterns**: direct read-model mutation; upcasters as shared infrastructure; defaulting to full replay for every change (trains teams to batch into risky PRs); testing only recent events (misses historical shapes / deprecated types); manual snapshot version tagging (use content-hash); deployment-time-only divergence detection; treating read models as authoritative; rebuilding from poisoned snapshots; ignoring eventual consistency in feature code; removing event-type handlers without tombstones.

## 27 — Cross-System Temporal Coordination Axis

A change in service A cascades through B→C→D with temporal effects (rebuild lag, consistency gaps, timeout exhaustion) no single service's tests can predict — a 50ms p99 increase can exhaust a downstream saga's timeout budget 4 hops away. Verdict: **Temporal Absorption Architecture (TAA).** The cascade simulator as a deploy-blocking gate is architecturally WRONG (predicts emergent behavior from stale models). Correct answer: STRUCTURAL IMMUNITY through absorption.

**Core principles**
- ABSORPTION OVER PREDICTION: safety from each service's MEASURED capacity to absorb perturbation unilaterally (3× timeout headroom, warm-standby projections, fallback read paths), not from a simulator predicting whether perturbation occurs.
- UNILATERAL DEPLOYABILITY AS INVARIANT: no change may require cross-team deploy ordering. Any design producing a multi-team coordination DAG is architecturally wrong → redesign (expand-contract, dual-write, feature flag), not coordinate. "Deploy B before A" is organizationally toxic and leads to force-deploys/shadow-deploys.
- LOCAL INVARIANTS COMPOSE TO GLOBAL SAFETY: if every service independently keeps 3× headroom + tolerates full rebuild of any single upstream + serves degraded with explicit staleness headers, the system is temporally safe without any service knowing another's deploy schedule.
- MEASUREMENT OVER DECLARATION: temporal properties extracted from production (OpenTelemetry traces, micro-perturbation injection), not YAML that rots within weeks. Only staleness TOLERANCES are human-declared (business decisions).
- CONSOLIDATE BEFORE COORDINATING: if A→B→C→D need temporal coordination, they share a consistency domain → make them one deployable unit. Litmus test: if changing A requires simulating impact on B, the boundary is wrong.
- RUNTIME ABSORPTION OVER DEPLOY-TIME PREVENTION: platform-owned temporal buffers (mesh-layer staleness absorption, event-store-direct fallback, stale-while-revalidate caching) absorb gaps at runtime; deploys are never blocked by upstream.
- BOUNDED 2-HOP MAXIMUM: no service participates in a temporal dependency chain deeper than 2 hops (deeper = cumulative uncertainty makes budget propagation meaningless). Deeper → introduce a hard async boundary (queue with explicit SLA).

**Strong-read for irreversible paths (structural immunity)**: classify every read path — transactional (charge, ship, file): event-store-direct STRONG-READ always, never the projection (which may be stale during rebuild); display: projection + serve-stale-with-header (≤4h OK); analytical: tolerate 24h. No prediction needed for irreversible paths — reading the source of truth makes them immune by construction. Absorption is for display paths only.

**The agent's local check (replaces cascade simulation)**: "Does my change reduce my service's absorption budget below 3×?" NO → deploy freely, no coordination. YES → redesign the change (not "wait for Team B").

**Conventions & guardrails**
- Read your service's ABSORPTION MANIFEST (auto-generated from prod micro-perturbation data: timeout_headroom_ratio, rebuild_absorption_window, fallback_mode per operation class) before changing latency-sensitive paths.
- If a change raises p99 >10%, verify timeout_headroom_ratio stays ≥ 3.0 (else optimize, or raise your own timeout budget — local, no coordination).
- New upstream dependency must not create a 3+ hop chain; if it does, add a hard async boundary.
- Test degraded behavior — a fallback mode (serve-stale / reject-503 / queue-and-retry) that has never run is hope, not a fallback.
- Bilateral temporal contracts live in the CONSUMER repo (consumer declares what it needs); a design input, NOT a deploy gate — violation = consumer redesigns.
- On a cascade failure: root cause is likely 2+ hops away; check the trace-derived dependency graph for recent upstream deploys. Guardrails: continuous micro-perturbation injection (5s delays rotating daily) measuring real capacity, headroom <3.0 → TEMPORAL-DEBT alert (team accountability, never upstream-blocking); strong-read enforced for transactional paths via mesh routing; weekly topology reconciliation (trace-derived vs declared).

**Antipatterns**: cascade simulator as deploy gate; cross-team deploy ordering; declared temporal properties in YAML; deep (3+ hop) chains; single staleness tolerance per edge (classify per operation); prediction-based safety for irreversible paths; centralized consistency registry (bottleneck/choke point); blocking on unverified dormant consumers.

## 28 — Concurrency & Parallelism Patterns

How an agent writes concurrent/parallel code safely — bugs invisible in single-threaded tests but catastrophic under load. Verdict: **Partition-First Concurrency — Eliminate Sharing Before Managing It.** Before adding any lock, version column, or CAS loop, prove the shared state cannot be scoped to a single owner; use the stateful system you already have (Postgres atomic ops, Redis Lua scripts) rather than layering distributed locks; encode concurrency strategies in conventions.json (generating lint rules), not markdown.

**Core principles**
- Partition before locking: prove shared state can't be scoped to a single owner (one stream = one worker, one creator = one session) before adding any concurrency mechanism.
- Single-statement atomicity is the gold standard: if a mutation can be one SQL statement (`INSERT ON CONFLICT`, `UPDATE SET x = x + 1 WHERE ...`), there is no race. Prefer atomic ops over read-modify-write.
- Use the stateful system you already have: Postgres atomic operations server-side, Redis Lua scripts for hot-path counters. Don't add Redis for problems Postgres solves.
- Structural impossibility over advisory docs: safety enforced by conventions.json → lint rules, not a CONCURRENCY.md the agent might not read.
- Constraint-as-signal for dedup: database UNIQUE constraints reject duplicates structurally — no app-level dedup logic.
- Explicit parameter passing over ambient context: typed TenantContext params beat AsyncLocalStorage in typed codebases (compile-time safety over runtime magic).
- Scaling triggers over premature mechanisms: document WHEN a mechanism becomes necessary, don't add it before the topology demands it.

**Conventions & guardrails**
- Before any read-then-write, ask "can this be a single SQL statement?" If yes → use it.
- Before adding a lock/version column, ask "how many concurrent writers for this row?" If ONE → no mechanism needed.
- Never use separate GET then DECR in Redis for budget/counters — only atomic Lua scripts.
- Never write fire-and-forget async without `.catch()` (no-floating-promises lint enforces this).
- Two sequential DB calls read-then-writing the same entity → wrap in `$tx`.
- Materializing from an event stream → always include `source_event_id` + UNIQUE constraint.

**Antipatterns**: separate GET-then-DECR on Redis (two readers both see tokens=1, both decrement, budget violated); read-modify-write across separate auto-transactions (stale snapshot at write); module-scope mutable containers (`const cache = new Map()` races under async interleaving); version columns on single-writer tables (dead conflict-handling paths); advisory documentation as enforcement; N=2 Promise.allSettled as concurrency proof (two ops in one process often serialize accidentally).
