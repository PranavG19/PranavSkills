---
name: agent-arch
description: Architect codebases and harnesses AI agents build and maintain. Use when choosing an architecture style, enforcing a safety boundary (auth, tenancy, secrets, migrations, API contracts), setting up an agent context file, hooks, permissions, or verification gates, or reviewing agent-legibility.
---

`agent-arch → choose codebase or harness → apply the 5 rules → make unsafe states unrepresentable → verify independently → load one matching reference`

A **router and decision core**, not a knowledge base — itself an application of the rule that a project's agent context file is a router. Distilled from a 39-axis research program (map → adversarial review → roundtable → synthesis); the universal model lives here, and per-area detail loads JIT from `knowledge/agent-arch/` when the task touches that area. Load only the file matching the axis in front of you — pulling all of them up front spends the context budget the router exists to protect.

For an agentic-coding setup rather than application architecture, load
`knowledge/agent-arch/harness.md`. Use its baseline to audit or create the project's agent context
file, hooks, permissions, isolation, verification ladder, and CI gates. Adapt commands to the
repository's actual stack; preserve the control objective.

## The model: Oracle Architecture

Agent-operated codebases split into two regimes. The **~30% infrastructure / safety / plumbing** (auth, tenancy, secrets, boundaries, migrations, contracts) gets **proven structural guarantees** — make the wrong thing impossible to express. The **~70% business-logic correctness** gets one principle: **independent verification** — grade every claim with a signal the author did not produce.

## The 5 rules + escalation trigger

Apply these to every architectural decision and every change.

1. **ONE PASS OR DECOMPOSE.** If the change + its tests + its verification can't be held in one context window, split *before* starting. The unit of coupling determines the boundary — not the folder.

2. **MAKE THE UNSAFE THING UNREPRESENTABLE.** For safety properties (auth, tenancy, secrets, boundaries), push enforcement *below the application layer* where the agent has no write path. Prefer in this order: **sovereign structural** (SCPs, DB-engine RLS with FORCE, org rulesets) > **local structural** (tsconfig, project references, lint) > **detection** (tests, CI gates). A control the actor can rewrite is not a control.

3. **VERIFY FROM A VANTAGE YOU CANNOT REACH.** Every behavioral claim is graded by a signal the author didn't produce: mutation kill-rate over test count, edge SLI over unit assertions, screenshot diff over manual inspection, canary over staging approval. If the only verification is one you wrote, the claim is unverified — and a signal the code emits about itself (a handler-logged "succeeded" count, a self-reported health field) is still a mirror; the oracle must be outside-sourced.

4. **THE SAFE PATH MUST BE THE FAST PATH.** Any gate adding >10% to the operation it guards gets bypassed within weeks. Fix the tooling first (parallelize, scope to affected-only, make it structural) *before* shipping the gate. Exception: irreversible operations always gate, regardless of speed cost.

5. **ADD A GATE ONLY BY NAMING WHAT IT REPLACES.** Synchronous (commit-blocking) gates carry a weighted budget: structural = 0, mechanical = 1, advisory = 2, ceiling = 6. Async post-merge gates (nightly mutation, weekly load tests) don't count. Before adding a gate, name what it replaces or prove the budget still holds.

6. **ESCALATION TRIGGER — STOP and request human review** when touching: (a) an **irreversible operation** (data destroy, tenant delete, prod migration — a rollback proven only on an empty fixture is NOT proven reversible on populated data), (b) a **cross-system temporal boundary** (sagas, distributed coordination), or (c) a **visual/perceptual output you cannot observe**. These three domains invert the normal rules and require judgment the agent can't provide.

## Decision checklist (what to check on every action — put this in the project's agent context file)

- **Before every change:** Can I hold change + tests + verification in one pass? If no → decompose first.
- **For a safety property:** Can I make the wrong thing a compile error or infra refusal? If yes → structural. If no → detection *with an independent oracle*.
- **For a correctness claim:** Is my verification produced by something other than me? If only my own test → add an independent oracle (mutation, property-based, edge SLI, screenshot, canary).
- **For a new gate:** Name what it replaces. Confirm synchronous weighted budget ≤ 6.
- **For an irreversible operation:** Stop. Request human confirmation. Never optimize for speed on destructive actions.
- **For a cross-system change:** Check the dependency graph. If downstream impact is possible → flag the specific affected services.
- **For structural enforcement I author:** Ship a CI integrity check proving its coverage. Structural gates without coverage audits silently rot.

## Health metrics (the dashboard that proves the model works — all falsifiable)

| Metric | Target | What it proves |
|---|---|---|
| **Structural coverage ratio** — security-critical paths behind sovereign structural gates | >80% | Rule 2 is real (e.g. RLS-covered tables / tenant tables, auth-covered endpoints / total) |
| **Mutation kill rate** — injected mutations caught on critical path (money, auth, data) | >70% | Tests verify *correctness*, not just coverage — THE quality metric |
| **Context overflow rate** — agent sessions needing >1 pass from context exhaustion | <15% | Rule 1 (decomposition) is working |
| **Synchronous gate latency** — p95 wall-clock of all commit-blocking gates combined | <90s | Rule 4 (safe = fast) holds mechanically |
| **Escape-hatch trend** — bypass annotations (`UnsafeBypass`, `any`-cast, force-push) per week | non-increasing QoQ | Guardrails aren't being routed around |
| **Gate fire-drill pass rate** — gates that caught a synthetically injected failure in last 90 days | >90% | Gates are alive, not theater |

## Meta-antipatterns (reject these everywhere)

- Adding a gate without naming what it replaces (gate accretion).
- Advisory prose as a safety mechanism (rules without enforcement).
- Self-grading without independent verification (the universal mirror oracle).
- Safety-through-friction (guardrails slower than the bypass → teams route around).
- Detection for what could be structural (testing for an impossible state instead of making it impossible).
- Universal principles with no per-domain escape hatches (genesis, temporal-coordination blindness, and irreversibility are genuinely different).
- Metrics without fire drills (a gate never tested is a gate that doesn't work).
- A complexity ceiling that ignores the async/sync distinction (nightly audits don't compete with the inner loop).

## What to do Monday (each step independently valuable — partial adoption helps)

1. Wire the default test command to **affected-only with JSON output** (Rule 4 — immediate velocity gain).
2. Enable **RLS on all tenant-scoped tables** (Rule 2 — structural tenancy).
3. Add **framework-level deny-by-default auth middleware** (Rule 2 — structural authz).
4. Add **one mutation-test run on the critical path** to CI (Rule 3 — independent verification).
5. Measure the 6 metrics; post a weekly dashboard.

## Knowledge routing — load JIT, only for the axis you're touching

Each file condenses the *core principles* of its axes (the adversarial reviews, roundtables, and open questions from the source guide are deliberately dropped). Read the one matching the decision in front of you.

| Load this | When the decision is about |
|---|---|
| `knowledge/agent-arch/harness.md` | Setting up an agentic coding environment: project context files, skills/docs routing, hooks, permissions, worktrees, CI/branch protection, stop behavior, and verification tiers |
| `knowledge/agent-arch/architecture-styles.md` | Choosing/shaping the base structure: modular monolith, monorepo vs polyrepo topology, vertical-slice, hexagonal/ports-and-adapters, event-driven, serverless/FaaS |
| `knowledge/agent-arch/verification.md` | Language & type-system choice, test & verification signal, test infrastructure at scale, observability-driven development |
| `knowledge/agent-arch/runtime-operations.md` | Observability & runtime signals, agent utilization & operations, post-deploy incident participation, logging/audit/compliance, cost optimization for agent usage |
| `knowledge/agent-arch/build-supply-config.md` | Dependencies & supply chain, build/CI-CD as legible artifact, secrets/credentials/config, infra-as-code & environment topology, monorepo tooling, feature flags, dependency injection |
| `knowledge/agent-arch/data-events-distributed.md` | Data/schema migration, event schema & API contract evolution, multi-service orchestration & sagas, event sourcing & projections, cross-system temporal coordination, concurrency & parallelism |
| `knowledge/agent-arch/apis-frontend-resilience.md` | Frontend/UI architecture, error handling & resilience, API design & versioning, performance/caching/rate-limiting, backward compatibility |
| `knowledge/agent-arch/security-tenancy-trust.md` | Runtime authorization & policy, multi-tenancy & data isolation, agent permission & trust models |
| `knowledge/agent-arch/knowledge-migration.md` | Documentation & knowledge management, multi-agent coordination, legacy migration & strangler fig |

## Four lenses (apply throughout)

① **Simplicity** — minimal cognitive load & blast radius. ② **Scalability** — boundaries that grow cleanly. ③ **Safety** — types, tests, permissions, reversibility. ④ **Agent-legibility** — docs, discoverability, context structure.
