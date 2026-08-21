# Language, Types & Verification

Per-axis core principles for the language/type choices and verification signals that make agent work trustworthy. Distilled from axes 07–10.

## 07 — Language & Type-System Axis
**Core principles**
- A green typecheck certifies SHAPE within a configured, suppression-riddled subset — never INTENT, never the boundary. Treat exit-0 as a lossy projection; report a typecheck-only pass as "shape verified, behavior UNVERIFIED," never success.
- Two dials, not one: COVERAGE (the prize — what green proves) vs CEREMONY (the cost that triggers the escape spiral). Maximize coverage, cap ceremony; don't "ramp strictness" as one knob.
- The toolchain is the dominant variable. Same type system is agent-safe or agent-hostile depending on lint config, check latency, index freshness. Recommend "use config C," not "use language X" (within-language spread exceeds between-language spread).
- Escape hatches are a FEATURE — they concentrate residual unsoundness into a finite, greppable, gateable set of marked tokens. COUNT them, gate the delta at zero, treat each survivor as an UNVERIFIED region; never sum them into "green."
- Parse, don't cast, at every process boundary. Highest-ROI, most language-independent rule: the type system is structurally blind at I/O edges. A runtime-validated dynamic codebase is safer than a strict-static one that casts `JSON.parse`.
- Push intent INTO types only where the make-it-compile gradient would otherwise optimize the wrong thing — newtypes per role (SourceAccount vs DestAccount), units (Cents vs Dollars), smart-constructor-only domain types. Stop short of typestate/phantom gymnastics.
- Static resolvability of the call graph is a DISCIPLINE choice, not a language property. Reflection/getattr/string-keyed DI break find-references in Go/Rust too. Require explicit dispatch (enum-keyed `Record<Variant,Handler>`, constructor injection); treat find-references as a lower bound.
- The agent's reliability/fluency ceiling, not the type system's expressive ceiling, is the binding constraint. The strictest system the agent can FLUENTLY satisfy beats a richer one it casts its way out of.

**Conventions & guardrails**
- Tiered loop contract: classify the change. PLUMBING (rename/move/signature-preserving) → gate on typecheck + escape-hatch-delta==0, no test required. BEHAVIOR change → typecheck + ONE focused property/example test that went red-then-green.
- Reporting contract — never sum green signals: format/lint = "shape is house-style"; typecheck = "shapes compose"; test = "behavior is correct." Only the last licenses "done."
- Any escape hatch (`as`/`any`/`!`/`@ts-ignore`/`cast()`/`# type: ignore`/`unwrap`/`unsafe`) the agent adds to make a typecheck pass is a self-finding defect to justify in its summary — never a resolved error.
- Before relying on an externally-declared type (`.pyi`/`.d.ts`/stub/generated client), jump to the real implementation/runtime source; run regen as step zero or DECLARE the generated layer unverified.
- Navigation: treat find-references as a LOWER BOUND when the module has a dispatch primitive (getattr/importlib/reflect/register/@app./DI bind/route table/serde tag). Grep symbol as identifier AND string literal AND for registration sites; enumerate implementors for interface/trait/dyn receivers.
- Loop-health precondition: verify LSP index warm and codegen/proc-macros ran before trusting references. A single check >~5–10s is a BUILD-SYSTEM DEFECT to fix (project-references for TS, workspace-split+sccache for Rust, dmypy for Python), never a reason to edit blind.
- Ceremony test: a >15-line type error means simplify the TYPE, not cast past it. Auto-fix (clippy/ruff/eslint --fix) is a code change subject to the test gate.
- **GREEN = TWO NUMBERS**: (a) typecheck/build exit 0 AND (b) escape-hatch-delta == 0 vs a committed counted allowlist. If hatch count trends UP as strictness rises, strictness passed its inversion point for this repo+agent — back it off (resolves the strictness debate empirically, per-repo).
- Per-language gates: TS `tsc --noEmit --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes` + ESLint (`no-explicit-any`, `no-unsafe-*`, `no-non-null-assertion`, `switch-exhaustiveness-check`, `no-floating-promises`, `ban-ts-comment`) as a separate gate (tsc does NOT flag `as`). Rust `cargo check` + `clippy -D unwrap_used -D expect_used -D indexing_slicing -D wildcard_enum_match_arm` + `#![forbid(unsafe_code)]` outside named boundary modules. Go `go build` + `errcheck` + `golangci-lint` (`go vet` is blind to dropped errors) + startup exhaustiveness assertion for enum-keyed registries. Python `mypy --strict`/pyright strict + `warn_return_any`/`disallow_any_explicit`/`warn_unused_ignores` + named `# type: ignore[code]` only + `stubtest` in CI.
- Boundary gate (all languages, non-negotiable): ban casts on deserialization; require a runtime validator whose inferred type IS the static type — zod/valibot, pydantic/TypeAdapter, serde with `deny_unknown_fields` + explicit unknown-variant handling (not blanket `#[serde(other)]`), unmarshal + explicit validation. Cross-service enums: shared versioned schema + contract test that fails CI on producer/consumer divergence.
- Formatter mandatory and pinned; version bumps are a managed migration (one semantics-free reformat commit in `.git-blame-ignore-revs`, never mixed with features). Resolvability gates with zero-count metrics: `madge --circular`/import-linter (no cycles); forbid net-new suppression pragmas (fail on increase + periodic stale-sweep); shrink-only legacy-baseline files.
- DEFAULT STACK: TypeScript-strict + zod at boundaries, OR Go + errcheck/golangci-lint + sqlc/typed-registries. Rust ONLY where memory-safety/FFI/perf-core is load-bearing, behind a human seam, agent confined to owned-types/Arc/clone. AVOID untyped Python/Ruby/JS (no cheap loop) and Rust/Haskell/OCaml/Scala/C++ for general CRUD (lifetimes/HKTs/template errors exceed agent fluency → escape spiral).

**Context strategy**
- A precise signature is the densest machine-readable doc: it lets the agent CALL a symbol without reading the body (the core token economy). But a signature is NEVER sufficient to certify a CHANGE to that body — the token savings and the correctness blind spot are the same mechanism.
- Types-as-docs LIE; read/run instead when: (1) error type erased (anyhow/Box<dyn>); (2) type from a stub/generated client; (3) hover shows `any` from an upstream cast; (4) receiver is interface/trait/dyn; (5) two params share a type; (6) value crossed a process boundary (it does NOT have its declared type until a runtime parse establishes it). In a fast-REPL language a 40ms run is itself a cheap correctness loop catching the intent class no type system catches — don't let a slow compile suppress it.

**Antipatterns**
- Conflating "compiles" with "correct" (swapped same-typed args, off-by-one, inverted boolean, wrong-order calls all compile).
- Summing orthogonal greens (format + lint + typecheck) into "it works" — confidence-by-association on what they all DON'T cover (runtime behavior).
- Maximizing strictness everywhere at once — manufactures the escape-hatch density it then lints away. Prohibition scatters hatches; quarantine bounds them.
- Discharging a forced obligation with a no-op: `.unwrap_or_default()`, `if err != nil { return nil }`, empty `catch {}`, `?? wrongDefault`, `_ => unreachable!()`, `case _: pass`.
- Bare `_ =>`/`default:` wildcard on a domain enum — silently defeats exhaustiveness, decays monotonically while builds stay green.
- Casting at the boundary (`JSON.parse(x) as T`, `cast(T, raw)`, `#[serde(other)]` silent-absorb) — fake confidence on least-visible data.
- Trusting find-references/go-to-def as complete under reflection/getattr/DI/monkeypatch/dyn dispatch — a clean-looking set missing dynamic edges is a false all-clear.
- Recommending a language by type-system power while ignoring toolchain config; treating slow `cargo check`/`tsc` as inherent (it's a fixable build-system defect); copying suppression pragmas into new code with the surrounding idiom.

## 08 — Test & Verification-Signal Axis
**Core principles**
- Oracle provenance is the spine. Every gated assertion's expected value must come from a source the implementation cannot reach: the input itself (round-trip `f_inv(f(x))==x`), a metamorphic relation naming no formula, a differential reference from a DIFFERENT module/library/release, or a hand-written spec literal (`toBe(80)`, never `toBe(price*rate)`). A mirrored oracle in a property test (or a 100%-mutation suite) is strictly WORSE than an independent oracle in a plain example test — its aura of rigor suppresses review.
- Red-first is the gate the optimizer cannot self-satisfy. A test green on both the parent commit AND the new source asserts nothing about the change. A recorded red→green transition kills mirror oracles, assertion-free tests, and guarded dead-branch assertions in ONE cheap mechanical step.
- Self-consistency is not correctness. Typecheck, coverage, mutation, snapshot all certify the code is pinned to its own behavior; none reads the spec. Never present any — least of all mutation score — as a correctness/done-signal.
- Two orthogonal holes, two gates. Assertion-density (executes but asserts nothing/weakly) is caught ONLY by mutation-on-diff. Oracle-provenance (asserts a precise value minted from the buggy impl) is caught ONLY by the spec-mutant drill + independent oracle. No single gate closes both.
- Tier by verified cost, gate on a number, degrade visibly. "Always write a test" bankrupts the inner loop (a property is 10–1000× a typecheck; mutation is O(#mutants × suite-time)). Classify each change to the cheapest SUFFICIENT signal; a pure-shape refactor may ride a typecheck IF the report honestly emits `unverified=behavior-not-checked`. A skipped test plus a silent green is worse than an honest unverified flag.
- Fail-closed on empty/unsound selection. `vitest related <untested>` exits 0 (fail-open); `pytest` empty-collection exits 5 (fail-closed). Assert selected-count>0 and force a full run on DI/config/codegen/dynamic-import edits.
- Every gate is a falsifiable number, composed as a conjunction, never summed. Correlated-poisoned greens don't become trustworthy by stacking. Emit per-signal provenance + explicit unverified block; any non-empty field blocks merge.

**Agent conventions**
- Resolve every change to an explicit node-id (`file::test`) or leaf dir via `.verify/source-test-map.json` before running. NEVER bare `pytest -k`/`vitest` name-filters in the inner loop (verified 29–38× collection blowup at scale).
- Derive the oracle from a source the impl cannot reach: ≥1 hand-coded spec literal per public function; for properties pick round-trip/metamorphic/differential/algebraic-law — never re-encode the SUT's formula.
- Prove each new test can fail (run against parent commit, confirm RED) before trusting GREEN on HEAD.
- Promote counterexamples to explicit `@example`/`fc.example` (permanent named regression); keep generators unpinned — never commit a seed-pinned property as the only coverage.
- Assert effect transcripts (recorded ordered calls), not return values, for effect-bearing functions; verify by swapping two adjacent effects and confirming red.
- NEVER pass `-u`/`--updateSnapshot` (snapshots are CODEOWNERS-locked; prefer inline literals). NEVER add retry/`reruns=`/`@flaky` (flaky = fix or quarantine). NEVER add `.only` (`--allowOnly=false`) and never increase skip/todo count.
- Coverage-exclusion pragma requires a human-approved justification token; CI runs a second pass with exclusions stripped.
- Run the cheap loop asserting `numTotalTests>0` from the JSON reporter (not exit code); record per-iteration selected-file count + wall time, fail loudly if >1.0s rather than degrading to typecheck-only.

**Guardrail layer** (each gate a falsifiable number, conjoined, never summed)
- SELECTION-NONEMPTY: `numTotalTests>0` on the changed-file selection (JSON reporter).
- RED-FIRST: every new/changed test FAILs against parent, PASSes on HEAD.
- ASSERTION-RAN: `expect.assertions(N)`/`expect.hasAssertions()` present and met.
- ORACLE-PROVENANCE / SPEC-MUTANT DRILL: mutate the spec constant, confirm a test goes red; AST-reject `expect(f(args)).toBe(<expr containing f or its literals>)`.
- MUTATION-SURVIVORS-ON-DIFF == 0 (NEVER a percentage — equivalent mutants make 100% unreachable): Stryker `--incremental` on diff ranges, `coverageAnalysis: perTest`; survivors KILLED or in human-approved `known_equivalent.json`.
- SNAPSHOT-DIFF-LOCK: CI fails if diff touches `__snapshots__/**`/`*.snap`/inline-snapshot literals without non-author CODEOWNERS approval (spelling-independent — catches `-u`, hand-edit, delete-recreate).
- DETERMINISM-PROBE: run changed tests N≥5× with shuffled seeds; any pass/fail flip is a hard red AND refuses to run mutation.
- NO-RETRY / NO-FOCUS / MONOTONE-SKIP: AST-reject retry directives outside quarantine; `--allowOnly=false`; skip/todo count monotone-non-increasing vs base.
- COVERAGE-DELTA FLOOR (necessary-not-sufficient, never a done-signal): ≥80% changed lines/branches + a second pass with exclusions stripped.
- COMPOSED REPORT: conjunction + explicit unverified block `{selection, retry_assisted_greens, snapshots_changed, mutation_survivors_on_diff, redgreen_unproven, behavior-not-checked}`. Any non-empty field blocks merge; NEVER summed into a scalar.
- Change-class ladder: Tier 0 pure-shape refactor → typecheck only (<2s, must emit `unverified: behavior-not-checked`). Tier 1 return-value logic → focused test, independent oracle, red-first (<1s). Tier 2 algebraic/invariant → property from the oracle-independence taxonomy + ≥1 spec literal, pinned seed, committed `.hypothesis/examples`, generator-reachability proof. Tier 3 effect-bearing → effect-transcript assertion. Tier 4 risk-tier/boundary → Tier 1-3 PLUS mutation-on-diff + contract verification (Pact against broker, `can-i-deploy` blocking, `oasdiff --fail-on breaking`); a timeout is a RED gate, never a skip.

**Context strategy**
- The test suite is the densest executable spec ONLY when the oracle is independent — a mirrored property is a documentation LIABILITY. Tag each property oracle `round-trip|metamorphic|differential|spec-literal` so the report/next agent sees whether green covers an independent claim.
- Committed `.verify/source-test-map.json` maps each source file to explicit node-ids (deterministic selection, no `-k` blowup). Co-locate tests by tier so the filename declares what is pinned (`.spec.ts` return-value, `.prop.ts` invariants, `.effects.spec.ts` ordered transcript).
- Report states `selection: impact(6/2000)` vs `selection: full(forced: dynamic-wiring)` so a windowed agent knows whether green covers the blast radius; nightly full run records `selection_soundness: misses_found`. Test names must claim only what the body verifies (enforced by the assertion-ran gate).

**Antipatterns**
- Mirror oracle: deriving expected from the just-written buggy code (co-authored `ref`, or property re-encoding the SUT's formula) — passes 300–1000 runs and scores 100% mutation on buggy code.
- Mutation-score-as-correctness-capstone: gating on a percentage (equivalent mutants make 100% unreachable; mutation certifies assertion density, never correctness).
- Snapshot re-blessing (`-u`/hand-edit) — `CI=true` does NOT stop explicit `-u`; the env-var defense is theater.
- Flaky-retry laundering (`{retry:N}`/`@flaky`) — converts a real race into a clean green; hides the bugs most expensive in prod.
- Assertion-free or guarded-assertion 100% coverage — reads green and covered, verifies nothing.
- Empty/unsound selection treated as a pass (`vitest related <untested>` exits 0; bare `-k` costs 29–38×).
- "Has an algebraic law" treated as sufficient (idempotence holds of a `normalize()` that forgot `.lower()`); must pair with a planted-mutant red-first drill + generator-reachability proof.
- Trusting fictional flags (StrykerJS has no `--since`; `vitest --ci` doesn't exist) — verify against `--help` for the pinned version.
- Summing orthogonal-but-correlated greens into "it works"; `.only`/`.skip` laundering (pair with `--allowOnly=false` + monotone-non-increasing skip count).

## 09 — Testing Infrastructure at Scale Axis
**Core principles**
- DEFAULT COMMAND = FAST: the test script runs affected unit tests only; full suite is `test:ci`. If `npm test` runs the full suite, the agent is slow by construction.
- SIGNAL INTEGRITY OVER SPEED: never lie — stale cache, flaky retry, missed dependency = worse than being slower. A 3s loop that sometimes lies is worse than a 6s loop that always tells the truth.
- ONE COMMAND, ONE FILE, THREE EXIT CODES: `test:smart` → `.test-signal.json` → PASS (exit 0) / FAIL (exit 1, with `{name, file, line, expected, actual}`) / INFRA (exit 2, flake or setup failure — not the agent's fault).
- TIER SEPARATION at the vitest workspace level (unit project vs integration project — `--related` filters to unit-only for the inner loop). Tiers: Tier 0 typecheck <1s → Tier 1 affected units 1-5s → Tier 2 integration 5-30s → Tier 3 full suite 1-10min → Tier 4 E2E/visual post-merge.
- STRUCTURED OUTPUT: JSON reporter — agent reads `{passed, failed, failedTests: [{name, file, line, expected, actual}]}`, not a terminal wall.
- FLAKY = QUARANTINE, NEVER RETRY: a test that passes-then-fails without a code change is auto-removed from the main signal.
- TEST INFRA IS THE AGENT'S VELOCITY MULTIPLIER: 2× faster tests = 2× faster agent, directly proportional.

**Conventions & guardrails**
- Architecture: "Signal-First Test Loop (SFTL)" — default-command-is-fast + one-command-one-file-three-exit-codes + tier-separated workspaces + structured JSON output.
- The agent calls `test:smart` and reads `.test-signal.json`; it never specifies `--related` manually (affected-test selection via import graph is wired as the default).
- Integration tests with real Postgres (3-8s DB bootstrap per file) cannot participate in the <5s inner loop — exclude them via tier separation (`--related` alone doesn't exclude them).
- Watch out for: cold-start overhead (1.5-3s before any test runs — watch mode absent from agent workflow); barrel files + path aliases causing silent over-selection (a shared-utility change fans out to 50 tests via the import graph).

## 10 — Observability-Driven Development
**Core principles** (Passive Oracle Architecture — platform-derived observability with a single-verdict agent interface)
- Platform instruments, agent consumes: auto-instrumentation (auto-OTel) provides baseline visibility; the agent adds custom spans only for business logic the platform cannot see.
- Single verdict, not raw signals: the agent calls a validation API returning pass/fail — never interprets percentiles or writes PromQL/dashboard queries.
- Tiered risk, not uniform ceremony: 80% of changes (config, copy, feature-flagged) deploy immediately; only Tier 2/3 changes get progressive delivery.
- Every signal has one consumer and one action: no metric/alert exists without a declared consumer who acts on it; unclaimed signals are deleted.
- Separation of instrument and judge: the deploying entity cannot define its own success criteria. SLO thresholds live in a separate owner's domain.

**Agent conventions**
- Before deploying: classify change into tiers (1 = immediate, 2 = canary 10min, 3 = progressive 30min with manual gate).
- Never add custom spans/metrics without registering in the observability manifest (budget-enforced, rationale required).
- Pre-register a diagnostic trace query in every PR (what you'll look at IF the canary fails).
- Post-deploy: call the validation oracle API once per interval; do not interpret raw metrics directly.

**Antipatterns**
- Agent as instrumenter: adding custom spans/metrics as routine feature work — unbounded cost/noise growth.
- Mirror oracle: agent defines both instrumentation and the threshold that determines success.
- Uniform ceremony: every change gets full progressive delivery regardless of risk tier.
- Metric-first diagnosis: interpreting aggregate numbers without tracing the specific failing request.
