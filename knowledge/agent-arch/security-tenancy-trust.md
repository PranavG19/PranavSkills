# Security, Tenancy & Trust

Per-axis core principles for runtime authorization, multi-tenant data isolation, and agent permission/trust models. Distilled from axes 34–36. This is the canonical home of Rule 2 — make the unsafe thing unrepresentable, enforced below the application layer.

## 34 — Runtime Authorization & Policy
Who can do what to which resource inside a running app (OPA/Cedar/RBAC/ABAC/ReBAC/RLS). The trap: agents write the policy AND the constrained code AND are graded on "tests pass" — but tests exercise the positive path (user CAN do X) while the security boundary lives in the negative path (user CANNOT do Y). Make the unsafe thing structurally impossible, not merely detectable.

**Core principles**
- **Construction over detection** — make unsafe unrepresentable (type-level, framework-level, DB-level), not just detectable.
- **Two-layer authorization** — Layer 1: tenant isolation via Postgres RLS with FORCE (structurally non-bypassable); Layer 2: fine-grained per-action policy via an externalized engine.
- **Deny-by-default at the framework** — HTTP layer refuses to serialize a response without an authorization token (unprotected endpoints fail 500, not pass silently / fail-open).
- **Boundary-pair testing** — every positive test paired with a negative test differing in exactly ONE attribute.
- **Frozen-core schema** — entity types / base actions require security-tagged review; extensions are free.
- **Coverage enforcement** — unprotected routes are a hard-counted, reviewed artifact (like a CSP allowlist).
- **Separation of grant and verify** — agent can REQUEST permission widening but cannot APPROVE it without a different principal.

**Antipatterns / key risks**
- Test-fixture privilege laundering (agent grants itself admin in test setup, then exercises the privileged path as if normal).
- Call-site omission on new endpoints (an externalized engine cannot enforce what code never calls — a new route with no authz check is allow-all).
- Policy-and-schema co-authorship collapse (agent writes both schema AND policy in one PR — circular separation).
- Framework default is allow (missing middleware = unprotected endpoint = fail-open).

## 35 — Multi-Tenancy & Data Isolation
One tenant cannot see another's data; one tenant's load cannot degrade another's performance. Spectrum: SILO (separate infra per tenant) → BRIDGE (shared infra, logical separation) → POOL (fully shared, tenant_id discriminator). The trap: tests run as a SINGLE tenant and never verify cross-tenant isolation. RLS prevents *omission* (forgotten WHERE) but not *confusion* (wrong tenant_id set) — so the primary boundary must be connection-level tenant binding.

**Core principles**
- **Connection refuses without context** — pool-checkout-level enforcement; refuse to execute queries unless `app.current_tenant_id` is set (fail-hard at checkout, not query time).
- **Type system IS the manifest** — `TenantContext` is a branded opaque type, unconstructable without request middleware or a job-envelope extractor; forgetting is structurally impossible.
- **RLS is backstop not boundary** — defense-in-depth, not the primary boundary.
- **Cross-tenant property testing** — random tenant pairs; assert row-set disjointness on every response (covers combinatorial query-paths, not just endpoints).
- **Noisy-neighbor at the infrastructure layer** — per-tenant connection limits (PgBouncer), rate limits (Envoy/Redis), compute quotas — not application code.
- **Pool-first until proven otherwise** — graduate to bridge/silo only on measured need: >10% DB size, compliance requirement, or unfixable noisy-neighbor.
- **Tenant deletion = irreversible-destroy seam** — human-approved, backup-verified, dwell-time-enforced.

**Antipatterns / key risks**
- RLS bypass via background jobs / migrations / seeds (connections opened without tenant context).
- Cross-tenant test oracle gates on endpoints, not query-paths (combinatorial coverage gap).
- `SET app.current_tenant_id` is forgeable by the application role (prevents omission, not confusion).
- BRIDGE O(N) DDL migration cost breaks under urgency (partially-applied security fixes).
- The single-tenant test trap (tests pass for one tenant, never verify isolation).

## 36 — Agent Permission & Trust Models
How to define, scope, and enforce what an AI agent is allowed to do — file scope, tool/action scoping, environment tier access, approval/escalation, scoped tokens, audit/attribution. Mechanical Bounded Autonomy (MBA): guard EFFECTS not tools; mechanical verification over self-assessment.

**Core principles**
- **Immutable enforcement boundary** — the permission system lives outside the agent's write perimeter. If the agent can modify its own settings/hooks, it's not a permission system.
- **Effect-scoped, not tool-scoped** — guard outcomes (protected file modified, production endpoint contacted), not inputs (a specific tool name used). Tools are interchangeable; effects are the risk.
- **Two tiers only — auto and block** — eliminate warn-only. An action is safe (auto-approve) or dangerous (block + require explicit human override). Warn-only trains approval fatigue.
- **Least privilege via scoped allowlist** — allowlist narrower than safe operations. Every Turing-complete entry (`Bash(*)`) equals no permission system.
- **Mechanical verification over self-assessment** — gates that ask the agent "did you comply?" are not gates. Check filesystem state, git diff, actual outcomes.
- **Approval budget — rare and high-signal** — human prompts must fire <3 times per typical session; above that, each extra prompt degrades attention quality.

**Antipatterns**
- Warn-only hooks (exit 0) — mechanically indistinguishable from not existing; the agent proceeds regardless.
- Wildcard interpreter allowlist — `Bash(python3 *)` or `Bash(curl *)` equals `Bash(*)` with extra steps.
- Self-modifiable permission infrastructure — settings/hooks the agent can Edit/Write are a suggestion, not a permission system.
- Prompt-type stop hooks for verification — asking the agent "did you run verify?" and trusting the answer; the agent evaluates its own compliance.
- Audit logs without consumers — local JSONL nobody reads, no alerting, no retention, agent-writable — forensic theater.
