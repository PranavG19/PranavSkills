# Runtime Signals & Operations

Per-axis core principles for what an agent sees and does at runtime: observability, operations, incident response, audit, and cost. Distilled from axes 11–15.

## 11 — Observability & Runtime-Signal Axis
The verdict: "Detect from the edge, diagnose from the inside, govern at the collector."

**Core principles**
- Expected value from outside the emitter (the one law). A runtime signal licenses "page" or "done" only if its expected value comes from a vantage the emitting code cannot write: the edge (LB/gateway/CDN/RUM), a black-box probe asserting an a-priori invariant the probe repo owns, or a downstream contract (callee-authored span/status joined by trace_id, DLQ depth, queue lag). `/health`, the app success counter, `span.status=OK`, an agent-editable threshold, and a metric the agent both emits and grades are all in-vitro and gameable.
- Two oracles, named holes. The edge is a TRANSPORT oracle (catches relabel 5xx→4xx, covers 100% of traffic, nearly free) but is BLIND to the swallow hole (fast empty/degraded 200 reads success=1.0). A semantic black-box journey probe asserting on the response BODY catches the swallow hole but is a tiny cohort prone to special-casing. Neither alone is sufficient; ship both and make their DIVERGENCE the spine detector.
- Detect from outside, diagnose from inside. Detection signals (SLI numerator, page-or-not) must be outside-sourced, unsampled, low-cardinality edge aggregates. Diagnosis signals (traces, wide events, internal counters, self-timed durations) are inside-sourced, error/tail/risk-biased sampled, and trustworthy ONCE an outside oracle has established a fault.
- Sampling is not for the SLI. The SLI is an unsampled edge counter/histogram ratio with a bucket boundary AT the SLO target. Sampling touches only the diagnostic exemplar store. "The slow trace got sampled away" is a diagnosis-fidelity failure, not an SLO failure.
- Trustworthiness is conserved against cost. You cannot buy cheap AND independent for free; every cost optimization (sampling rate, cardinality drop, fingerprint collapse, retention cut) blinds a specific, nameable incident class. Gate per-optimization: name the blinded class and point to a differently-sourced covering signal in `TELEMETRY-CONTRACT.yaml`. The external oracle has its own bill, clock, and gameability.
- Thresholds are derived artifacts, not knobs. SLO targets and burn thresholds live in version-controlled OpenSLO/Sloth/Pyrra YAML with a required `source:` provenance key; CI generates the alerts and fails on any loosening lacking a new approved source.
- Data minimization is a first-class correctness constraint. PII leakage is the only irreversible failure on this axis. Redact by VALUE at the collector, verify with a PII canary probe, keep raw bodies shortest, keep identity-free topology/timing long.
- Order by topology, not wall-clock. Causal reconstruction uses parent_span_id chains + span LINKS (fan-in/batch) + an SDK monotonic per-trace sequence number. Wall-clock ts is display-only. An NTP cross-host skew alarm (>50ms fails) is a prerequisite; if skew is unbounded the divergence detector must suppress itself.

**Conventions & guardrails**
- Wire the OUTSIDE oracle (edge SLI + semantic probe) in the same PR that instruments the path; a metric/SLI with no outside-sourced numerator fails review.
- Never derive an SLI, burn alert, or canary gate from a signal your code can write. If you catch an exception and return 2xx, increment a distinct `degraded_responses_total{reason}` counter wired into the error SLI, plus a test forcing the downstream to fail that asserts the SLI moved.
- Declare every metric in `TELEMETRY-CONTRACT.yaml` (`{labels+max_cardinality, sampling_rule, retention, data_class, blinded_incident_class, covering_signal}`); no undeclared label; no restricted-PII data_class as an index label or in any >30d store unless redacted.
- Treat every "no data" as suspect — distinguish "series exists and flat" from "series never existed" via `absent()`/metadata before concluding healthy.
- Never edit an alert threshold to silence a page; thresholds are generated from SLO YAML, fix flapping with a min-traffic guard.
- Falsifiable gates: DIVERGENCE gate (edge−app error rate > volume-derived confidence band, min-sample ≥100/window, suppressed if NTP skew >50ms); SLI-PROVENANCE lint (reject `*_sli:ratio` reading the app's own counter); CARDINALITY VALUE-DOMAIN gate (max_cardinality per label, nightly prod count, ban route/path values matching `/\d{3,}|[0-9a-f]{8}-|@/`); TAIL-SAMPLING completeness gate (every latency SLO has a >SLO_target keep clause; inject N synthetic slow/error requests, assert retained==N, tail-drop==0); PERCENTILE-CORRECTNESS gate (bucket-fraction not `histogram_quantile`); FINGERPRINT property gate (1000 of one cause → 1 group; 50 distinct → 50 groups); READINESS/LIVENESS gate (liveness dependency-free, readiness on local degraded-mode capability); CANARY POWER gate (two-proportion z-test/SPRT, never bare ratio); PII-CANARY gate (inject known canaries, scan stores after redaction, zero hits = blocker; per-subject crypto-shred keys); THRESHOLD-PROVENANCE gate; ASYNC-PROPAGATION coverage gate (synthetic message yields one trace_id spanning produce+consume).

**Context strategy**
- `TELEMETRY-CONTRACT.yaml` + SLO YAML are the two legible artifacts an agent reads instead of instrumentation source — what exists, what it costs, what it's blind to.
- Symptom→cause is a bounded 4-hop loop, each hop guaranteed-populated and outside-anchored: outside-oracle page → exemplar to the incident trace (skeleton floor guarantees a stub) → order by topology+sequence to the culprit span (downstream-contract attribute confirms "B actually succeeded") → trace_id pivots to wide events/logs + error fingerprint group.
- Runbook-as-machine-procedure: each step is a parameterized query that runs on a schedule against staging; a step returning an empty vector for a metric that should exist FAILS the runbook test (rename-rot caught in CI). First step is always "confirm the outside oracle, not /health."

**Antipatterns**
- Mirror oracle: deriving SLI/alert/canary gate from a signal the emitting code can write (app counter, `span.status=OK`, `/health` 200).
- Edge-SLO-as-sufficient: trusting the transport SLI alone — reads success=1.0 on a fast empty 200.
- Sampling the SLI; alert-detune ratchet (raising threshold/window until quiet); name-allowlist cardinality gate (checks names not value domains); `histogram_quantile` for the SLO + percentile-of-averages; message-text fingerprinting; wall-clock causal ordering; deep dependency check on the orchestrator/readiness probe (turns a blip into fleet eviction); instrument-richly-then-govern (privacy mirror oracle); key-name PII redaction at the SDK (leaks 4/4 canaries); global-key crypto-shred (over-deletes every subject).

## 12 — Agent Utilization & Operations Axis
The verdict: "SCOPE-AUTOMATE-GATE (SAG) — the Agent Operations Triangle." Scope tasks tightly, automate the fast safety checks, gate only what must be human-judged.

**Core principles**
- SAFE PATH IS FAST PATH. Every safety mechanism must be invisible on the happy path (<200ms, no routine prompts). A guardrail the team routes around is worse than none — it converts "unknown" into a confident "safe." Design safety as a side-effect of the fast path (branch isolation, test-before-commit, server-side branch protection).
- MECHANICAL OVER ADVISORY. Invest in descending order: server-side enforcement (physics) > client-side hooks (walls) > prose rules (suggestions). Never rely on prose for anything enforceable mechanically.
- SCOPE TIGHTLY, THEN LET RUN. Effectiveness is ~80% task quality, not rule quantity. A well-scoped task (names files, testable acceptance criterion, declares what NOT to touch) needs almost no guardrails. Invest in task decomposition over rule proliferation.
- TWO TIERS, NOT THREE. Operations are AUTONOMOUS (exit 0) or BLOCKED (exit 2). Eliminate the warning tier (exit 1) — a warning the agent reads and proceeds past is ceremony without value.
- RULES EARN THEIR BYTES. Every always-loaded token must prevent a specific error class with no mechanical enforcement. Delete rules that restate a test, reference nonexistent tools, or are never violated. Spine budget ~3000 tokens; everything else JIT-discoverable.
- VERIFY OUTCOMES, NOT JUST INTENT. Pre-execution guards catch only literal patterns; post-execution verification (inspect what changed) catches the entire class. One PostToolUse `git diff --stat` hook beats 10 more grep patterns.
- COMMIT IS THE HANDOFF. Git commits are the only reliable cross-session persistence; the commit log IS session state, the branch IS the sandbox.
- SINGLE AGENT UNTIL PROVEN OTHERWISE. Parallelize only when tasks are genuinely independent AND wall-clock savings >2h AND handoff is schema-validated.

**Conventions & guardrails**
- Read the 5-property task template (TASK + WHERE + WHY + WHAT-NOT + VERIFY) before starting; a missing VERIFY means no definition of done — ask, don't infer.
- Commit at every stable checkpoint with a handoff-quality message; run the exact VERIFY command before reporting done.
- Stop and escalate on ambiguity, security-sensitivity, unfamiliar code (>3 unread files), or cross-team coordination.
- Match existing patterns (read 2-3 similar examples first); one PR = one reviewable unit; never disable your own guardrails or modify settings/hooks/branch-protection to ease a task — report the block as a finding.
- Read files JIT, not preemptively.
- Guardrail layers: PHYSICS (server-side branch protection: PR + CI green + ≥1 reviewer; CODEOWNERS on infra/.github/.claude; required status checks; staging-before-prod deploy gate) > WALLS (exit-2 hooks: git-guard blocks force-push/push-to-main/reset-hard/clean-f; secrets-guard blocks .env staging and credential writes) > OBSERVATION (PostToolUse `git diff --stat`, alert on >10 files or credentials/env paths) > PERMISSION SCOPE (~25 specific patterns, `skipDangerousModePermissionPrompt=false`, no wildcard overlapping a hook matcher) > BRANCH ISOLATION (branch is the sandbox; never merge to main without PR) > REVIEW TIERING (sized to team review capacity) > TASK SCOPING (highest-leverage; task boundary = blast-radius boundary).

**Context strategy**
- Three tiers loaded by frequency. Tier 1 SPINE (auto-loaded, ≤3000 tokens): global CLAUDE.md (~800 tok behavioral rules), production-safety (~200 tok), project CLAUDE.md/AGENTS.md (~600 tok identity + 5-15 specific rules + commands). Past 3000 tokens attention decays.
- Tier 2 TASK-PRIMED (in the prompt): file paths to read first, acceptance criteria with an exact verify command, constraints/what-not — the 20% that saves 80% of exploration.
- Tier 3 JIT-DISCOVERED (read on demand): ARCHITECTURE.md, per-directory rules, test files, git log.
- Session state: commits = handoff, branch = sandbox identifier, memory = only non-obvious discoveries (not file contents, test results, or facts derivable from code).

**Antipatterns**
- Phantom tool mandates (rules referencing tools/MCP servers that don't exist — teach the agent rules are unreliable); permission-hook contradiction (a wildcard overlapping a hook's block pattern — one is theater); bypass-fatigue allowlist accretion; the warning tier (exit 1); rules-as-documentation (a 783-line AGENTS.md is docs in a rules costume — split them); the mirror-oracle test (code+test from the same prompt — require red-first or independent authorship); safety-through-prose-alone (RFC-2119 MUST with no enforcement while `Bash(python3 *)` runs ungated); over-orchestrating under-specified work.

## 13 — Post-Deploy Agent-Response & Incident Participation Axis
The verdict: "OBSERVE > ATTRIBUTE > ACT." The agent that caused the incident is the worst entity to diagnose it (bias toward "my code is correct" / "retry and hope" / "fix forward"). Safety = capability absence, not policy.

**Core principles**
- OBSERVE BEFORE ACT: every incident begins with a mandatory read-only phase, zero production-write credentials during investigation, no action until observation is complete (90s P1, 3min P2/P3).
- ATTRIBUTION BY EXPERIMENT, NOT SCORING: during canary the differential experiment is deterministic attribution; post-promotion the platform-owned delayed-attribution detector (1h/4h/24h passes) gives provisional verdicts the agent cannot influence. INNOCENT verdicts carry expiry timestamps (slow-burn regressions defeat the 10-min canary).
- CAPABILITY ABSENCE OVER POLICY ADVICE: safety from what the agent CANNOT DO (credential absence), not what it SHOULD NOT DO. Every production action requires a single-use, time-bounded, action-scoped capability ticket from an independent substrate.
- ROLLBACK IS CHEAP, FIX-FORWARD IS EXPENSIVE: rollback = one command via the pipeline, no approval for clear signals on stateless artifacts. Fix-forward is architecturally impossible during active incidents (deploy credentials suspended).
- ONE AUTONOMOUS ACTION PER INCIDENT, THEN ESCALATE: one bounded action (rollback, flag-disable, or scale-up); if unresolved in 5 minutes the agent is DONE — escalates with full context, no further actions.
- LEARNING IS A FAILING TEST, NOT A MEMORY ENTRY: every resolved incident produces a regression test failing on the bad commit and passing on the fix, verified by CI. Tests > alerts > CI gates > rules > memory.
- THE FLEET CIRCUIT BREAKER: >3 auto-rollbacks across different services in 5 minutes → freeze ALL auto-rollbacks fleet-wide, open one systemic incident (individual agents can't see fleet patterns).

**Conventions & guardrails**
- Never self-certify innocence — if your deploy is suspected you are excluded from investigation (responder ≠ deployer, structural disjointness). Attribution comes from the platform detector.
- Read-only first, always; one action then done; escalate with raw evidence (error samples, metric graphs, deploy timeline) before any hypothesis, labeled "unverified, confidence X%."
- Rollback through the pipeline (same attestation chain as a forward deploy), never direct kubectl/ECS/docker; never fix-forward during an active incident (creds suspended) — document the proposed fix with a red-first test for post-incident.
- Reversibility is PIPELINE-CLASSIFIED (inspect for migration files, schema/message-queue changes), never self-declared; stateful = no auto-rollback regardless of agent assertion.
- Log every observation/hypothesis/decision/action to an immutable audit trail the agent cannot modify.
- Other guardrails: canary auto-abort (pure infra, zero cognition); credential absence (ReadOnly during investigation, single-use rollback ticket <5min); deploy suspension during incident state; dead-man's switch (no ACK in 90s → bypass agent, page human with raw context); one-action limit (action credential consumed after use); delayed attribution (push-notifies; provisional INNOCENT expires).

**Context strategy**
- The responding agent receives a STRUCTURED INCIDENT PACKAGE, not raw alerts: (1) alert metadata; (2) attribution summary from the platform detector (ranked deploy candidates + confidence interval, not raw probabilities); (3) deploy timeline (last 6h with commit hashes, diff summaries, reversibility class); (4) pre-computed metric snapshots (so it doesn't thundering-herd a degraded monitor); (5) machine-readable runbook decision tree with verification commands; (6) escalation checklist (conditions = "page human NOW").
- Hard time budget: 90s P1, 3min P2/P3. Within it the agent curates evidence, forms a hypothesis, emits a decision record. It does NOT re-derive attribution, re-query live metrics, or explore tangential hypotheses (the runbook constrains the search space).

**Antipatterns**
- Self-certified innocence; fix-forward under pressure; narrative-laden escalation (anchoring the human with a pre-digested diagnosis); rollback-as-free (rollbacks have their own failure modes — cold-cache herds, drain dips); confidence theater (uncalibrated score as calibrated probability); self-declared reversibility; unlimited autonomous retries; escalation-as-failure (fast escalation with good context IS the value); treating all rollbacks as equal (flag-disable vs image rollback vs destructive migration); agent investigating its own deploy; pull-based feedback (use push); learning via memory instead of tests.

## 14 — Logging, Audit Trail & Compliance
The verdict: "Zero-Trust Emitter with Immutable Audit Separation." Infrastructure enriches; the caller only describes WHAT happened. Audit is a database invariant, not a code convention.

**Core principles**
- Infrastructure enriches, caller describes: the agent states WHAT happened (action + details); correlation (requestId, traceId), timing (duration_ms), and redaction are automatic, never the caller's job.
- Audit is a database invariant: append-only enforced by PostgreSQL policies (no DELETE/UPDATE on `audit_logs`); FK constraints use `onDelete: Restrict` so cascade destruction is impossible.
- Audit commits atomically with the domain mutation: same transaction — both commit or neither. Best-effort-outside-transaction only for non-compliance paths.
- Structured logger is the only emission path: ESLint `no-console` makes `console.*` a compile error; all output flows through the typed logger with automatic redaction.
- Log state changes and failures, not routine success: every log line must be actionable.
- Redaction is defense-in-depth at the emitter: both KEY names and string VALUES (email patterns, card numbers, JWT prefixes, AWS key prefixes) scanned before serialization.

**Conventions & guardrails**
- When logging an error: import the event constant from `events.ts`, call `logError`; never pass requestId manually (auto-injected via AsyncLocalStorage).
- Add a new observable event to `events.ts` first — TypeScript rejects unlisted event strings (closed `AppEvent` enum).
- A state-changing operation requiring audit calls `recordAuditTx(tx, ...)` INSIDE the transaction as the last statement.
- When catching errors pass through `logError` — never `console.error`, never stringify manually, never pass domain objects directly.
- Add context as scalar values only (IDs, counts, enum states) — never full request bodies or user-provided text.
- Guardrails: ESLint `no-console` (compile-time); PostgreSQL RLS on `audit_logs` (INSERT/SELECT only — DB physically refuses mutation); `onDelete: Restrict` on the audit FK (tenant deletion blocked while audit rows exist); value-pattern scanning (email regex, Luhn-valid cards, JWT `eyJ` prefix, AWS `AKIA` prefix); closed event enum; AsyncLocalStorage requestId auto-injection.

## 15 — Cost Optimization for AI Agent Usage
The verdict: "First-Try Economics." Cost per CORRECT OUTCOME is the only metric — not cost per invocation, cache hit rate, or deflection rate. The cheapest invocation is the one that succeeds first. Architecture IS the optimization.

**Core principles**
- Cost per correct outcome: measure cost/success including retries, debugging, and rollback — not cost/invocation. A $2 first-try success beats five $0.50 retried failures.
- First-try success is the #1 optimization: retries cost 10-50x the original; invest in complete context upfront (extra input tokens are cheaper than a full retry).
- Architecture is the optimization: 200-400 line modules with typed interfaces cut agent cost 3-5x vs god-files; structure permanently reduces cost per task.
- Generated beats maintained: navigation artifacts (module indexes, dependency graphs, type signatures) must be generated from code, never hand-maintained (stale caches = retry-inducing lies).
- Zero-maintenance threshold: no optimization whose ongoing maintenance exceeds 2 engineering hours/month is justified below $5K/month in agent spend.

**Conventions & guardrails**
- Orientation before action: every task begins with a generated module-index read (2 calls max to identify the right files).
- Full file on first touch, targeted on return (subsequent reads use line ranges or signatures only).
- Emit per-item rationale in batched tasks (structured output forces reasoning about each item, not skipping).
- Two-call maximum for orientation; if the agent needs more, the codebase has a legibility problem — fix the code, not the prompt.

**Antipatterns**
- Infrastructure death spiral (optimization infra that costs more to maintain than it saves); optimizing invocation cost while ignoring retry cost (a $0.003 invocation failing 15% costs more than $0.01 succeeding 99%); stale-cache confidence (trusting cached summaries without freshness validation); deflection rate as success metric (routing to deterministic tools regardless of correctness).
