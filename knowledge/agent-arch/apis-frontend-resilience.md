# APIs, Frontend & Resilience

Per-axis core principles for UI architecture, error handling/resilience, API design & versioning, performance/caching/rate-limiting, and backward compatibility. Distilled from axes 29–33.

## 29 — Frontend / UI Architecture for Agents
Central problem: agents can't see visual output; correctness is fundamentally visual (layout, responsiveness, contrast, z-index). Architecture: Constructive Visual Correctness (CVC) — make invalid visual states unrepresentable; visual regression (Chromatic/Percy) is a flaky sampling oracle (5–15% false positives), not the primary gate.

**Core principles**
- (1) Constructive correctness over verificative detection — make invalid visual states unrepresentable (typed slots, required responsive declarations, semantic tokens only, managed z-index).
- (2) Composition is the product — export composition components (PageLayout, FormLayout, ContentGrid with typed slots), not just primitives.
- (3) Sub-second feedback loop — every edit verifiable in <200ms via component tests (Testing Library + happy-dom); the e2e-only path (60–120s) is too slow for iteration.
- (4) Semantic tokens only — feature code references meaning (bg-surface-warning) never palette (bg-amber-50); theme maps semantics to palette; dark mode is free.
- (5) Screenshot-last, types-first — Playwright screenshot is the verification step, not the iteration step; types + component tests catch 80%, screenshots catch the residual 20%.
- (6) Accessibility by construction — primitives handle ARIA/focus/keyboard; the agent can't produce `<div onClick>` because Button is the only clickable export.
- (7) Co-locate everything — component + styles + tests + stories in one directory = one context window = one feature.

**Conventions**: always use design-system components (never raw HTML for standard patterns); screenshot after every significant visual change; TanStack Query for ALL async state (kills stale-closure + race-condition classes); test responsive breakpoints (mobile story per feature); alt text >10 chars; co-locate tests.

## 30 — Error Handling & Resilience Patterns
Central problem: under "make it work" the cheapest path is to swallow errors (`catch(() => null)`, empty catch, `|| defaultValue`); tests mock away failures so silent failures pass. Architecture: Structural Resilience by Default (SRD) — the unsafe path must be harder than the safe path, enforced by the build.

**Core principles**
- (1) Unsafe path harder than safe path — build failure for empty catch; lint for naked dependency call without a resilience wrapper.
- (2) Resource exhaustion before classification — statement_timeout + connection-pool limits prevent unrecoverable cascade regardless of error-handling quality.
- (3) Classification must produce action — never classify a property without code that reads it (a retryable flag nobody reads is false confidence).
- (4) Every external call through a resilience wrapper — circuit breaker + timeout + retry-with-budget; calling raw is the bug.
- (5) Typed errors with exhaustive handling — discriminated union + never-default, or Result type; compiler catches unhandled classes.
- (6) Structured responses — error code + message + correlation_id; never stack traces or internal details in production.

## 31 — API Design & Versioning
Central problem: the agent both produces and consumes APIs, so it can make a breaking change and "fix" its own client while other consumers break silently. Semantic breaks (field meaning changes without type change, e.g. amountCents now means dollars) pass every structural gate (oasdiff, buf breaking, graphql-inspector). Architecture: Compiled-Contract API (CC-API) — schema as compiled contract, not documented contract.

**Core principles**
- (1) Compiled contract — schema enforceable by compiler/runtime (Protobuf IDL with generated interfaces, or tRPC/FastAPI where the type annotation IS the contract), not merely parseable by a linter.
- (2) Runtime validation — generated client + Zod/Valibot on every response; TypeScript types are erased at runtime and give zero protection against malformed responses.
- (3) Schema-implementation agreement — provably agree at deploy time, regardless of which was written first (matters more than schema-first dogma).
- (4) Breaking-change detection covers semantics — golden-file value tests, description-diff flags, enum-removal + constraint-narrowing in oasdiff config.
- (5) Generated error types — discriminated union per status code; exhaustive handling required by lint.
- (6) Route-schema coverage gate — unschema'd endpoints fail CI; the absence of a schema IS the vulnerability.

## 32 — Performance / Caching / Rate-Limiting
Central problem: agents optimize for "tests pass" not "fast enough" — the N+1 that returns in 5ms at 10 rows takes 50s at 100K rows; cache invalidation gaps serve stale data silently; aggressive retry without rate awareness is self-inflicted DDoS. Architecture: Reactive Performance Enforcement (RPE) — CI rejects naive code with complete remediation plans in failure messages; don't expect agents to read performance budgets proactively.

**Core principles**
- (1) CI rejects, not agent reads — performance enforcement lives in failure messages with remediation plans, not YAML the agent must remember to consult.
- (2) Unbounded is banned at the ORM layer — Prisma middleware rejects findMany without `take`.
- (3) Aggregation in SQL, not memory — any endpoint returning fewer rows than it reads MUST use GROUP BY.
- (4) Query-count assertions per endpoint — the single highest-ROI performance gate; prevents N+1 structurally.
- (5) Rate-limit every loop — any loop calling an external service needs a rate-limit/sleep; `for await` without throttle is a DDoS.
- (6) Cache invalidation is event-driven — write → publish → invalidate, not manual per-path.
- (7) Performance budget as CI gate — bundle <200KB, p95 response <500ms, query count per endpoint ≤N.

## 33 — API Versioning & Backward Compatibility
How to evolve APIs without breaking existing consumers. Architecture: Bounded Evolution with Mechanical Gates (BEMG) — stable dominates clean; the compiler catches structural breaks (TypeScript + Zod), behavioral safety needs explicit invariants, every consumer must be registered and contracted, enum addition is breaking until proven otherwise.

**Core principles**
- Stable dominates clean — never remove a field any consumer reads; accumulated deprecated fields are acceptable cost, wrongful removal causes outages.
- Structural safety via the compiler — in a TS monorepo with shared Zod schemas, the compiler catches field removals, type narrowing, and signature changes automatically.
- Behavioral safety requires explicit invariants — the compiler is blind to semantic drift; cross-module integration tests pin behavioral contracts.
- Every consumer registered and contracted — anything reading another module's data (import, WebSocket, DB query, external API) must be in the consumer registry with a test.
- Enum addition is breaking until proven otherwise — adding a value breaks exhaustive pattern-matching consumers; treat as breaking unless consumers have default branches.
- Deprecation has a deadline or it is not deprecation — every deprecated field has an enforced sunset date; past sunset + grace period triggers CI failure.

**Antipatterns**
- Enterprise contract infrastructure overkill (Pact broker + oasdiff + OpenAPI + traffic telemetry for a monorepo that already has TypeScript + Zod).
- Treating "CI passes" as proof of safety (catches structural breaks, not behavioral drift or phantom consumers).
- Trusting "no grep results" as proof unused (misses WebSocket consumers, frontend, external readers, DB-as-API surfaces).
- Annotation-based CI bypass (a `# api-break: reason` comment is permission to break, not a gate).
- Deprecating without a sunset date (an annotation without enforcement just accumulates forever).
