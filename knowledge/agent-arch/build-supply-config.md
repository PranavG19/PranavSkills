# Build, Supply-Chain & Configuration

Per-axis core principles for dependencies, build/CI, secrets, infra-as-code, monorepo tooling, feature flags, and DI. Distilled from axes 16-22.

## Axis 16. Dependency & Supply-Chain
Verdict. "The Customs House, Trust the Border, Not the Cargo Manifest." A green build + clean audit + pinned lockfile is a mirror oracle by default.

**Core principles**
- Mirror-oracle law. A lockfile integrity hash is `base64(sha512(bytes-just-fetched))`, it proves reproducibility ("same bytes I locked"), never authenticity ("right bytes"). The two are orthogonal; a reproducible build of malware is deterministic malware. Authenticity must come from a party the agent's own resolution cannot author. A transparency log (Sigstore/Rekor), independent rebuilder, out-of-band advisory feed, or consumer-written contract test.
- The border is the build environment, not the lockfile. Every outside-in oracle runs UNDER the host config; a poisoned `~/.npmrc` (`force=true`) defeats all of them undetected. Lint the environment FIRST (`force==false`, `ignore-scripts==true`, `GONOSUMDB` empty, no ambient creds), then the lockfile.
- Conservation law. Trust is conserved against cost. Uniform max-rigor per dep makes machine-speed adds impossible, so the agent disables gates wholesale. TIER the budget (~15 Tier-0 names get full treatment; the long tail inherits cheap border guarantees).
- Gate the genesis event, not the steady state. `npm ci` is structurally unavailable when a dep is first added (EUSAGE without a lock); the first resolution can only happen via mutating `npm install`. A NEW name entering the lockfile is a reviewable policy event, not a silent fetch; that seed is where typosquats/slopsquats land.
- Shrink before you scan. The cheapest outside-in oracle is a closure small enough to read. A held fan-out budget removes most advisory noise; reachability scanning is a costly, unsound-under-reflection/eval/postinstall fallback ranked LAST.
- Never sum gates into "safe." Authenticity, known-vuln, reachability, and behavior are four independent questions; emit four distinct pass/fail lines. "Provenance verified" means origin-attested, never safe (backdoored event-stream/xz had perfect provenance).

**Conventions & guardrails**
- Check names against a committed closed-world allowlist BEFORE resolution; absent name = STOP, open a policy PR (resolution-returns-200 is not a trust gate).
- Read `dependency-trust.yaml` (tier, exact version, attestation URL, contract-test path, review_due, UNVERIFIED markers), NOT `node_modules`. CI re-derives every entry (self-verifying).
- Adding a dep is reviewable. Tier assignment, edit-distance vs top-1000, publish-age > cooldown (7-14d), download/repo floor, Tier-0 resolving Rekor entry; PR shows the lockfile-derived fan-out delta.
- NEVER `npm audit fix --force` / `pip install --upgrade-to-clear` / `--extra-index-url` (same never-do list as `git push --force`). Remediate via a one-package exact-re-pin PR with a passing contract test.
- Treat semver labels, SBOM "declared" license, and registry signatures as untrusted self-reports. Gate on ATTESTATION count, not signature count (verified 18/101 gap); SLSA L3 min for Tier-0; strongest is an independent rebuild producing the same hash.
- CI install fail-closed (`npm ci` / `--frozen-lockfile` / `--require-hashes` / `--locked` / `-mod=readonly`); never install/update/audit-fix in CI; a same-version integrity-hash change = republish = hard fail.
- Fan-out/diamond gate. FAIL on >20% closure growth, >5 net-new packages, edge-chain >8 hops, or >1 major of any Tier-0/1 name; pin shared transitives via `overrides`/`[patch]`.
- Install-script gate (uniform). `ignore-scripts=true` default + reviewed pinned native-build allowlist; run script-permitted installs in a network-egress-denied, credential-stripped sandbox.
- TOCTOU gate. Artifact that RUNS must equal artifact VERIFIED; ship the same content-addressed layer; compute a node_modules Merkle tree-hash post-install, fail deploy on mismatch; mount read-only at runtime for high-tier.
- Advisory gate. Diff SBOM purls against FRESH OSV/GHSA at CI time; FAIL only on REACHABLE high/critical with a fix; unreachable → dated, expiring VEX waiver; track reachable-critical (must be 0) separately from total count.
- Prefer outside-in-by-default ecosystems. Go (GOSUMDB + MVS) > pnpm (scripts-off, content-addressed) > npm.

**Context strategy.** Three legible artifacts replace the closure. `dependency-trust.yaml` (the dependency edge as docs), the SBOM as a purl index (join key to OSV, fits the window), and the per-PR fan-out delta (makes +1-line/+68-package amplification reviewable).

**Antipatterns.** Committed-lockfile-as-safety; `audit fix --force`; reading green audit/SBOM/provenance as a safety pass; counting signatures as trust; resolution-returns-200 as validation; pinning a mutable ref (branch/tag/`:latest`); uniform max-rigor; re-implementing GOSUMDB+MVS in agent-authored YAML; trusting install while shipping an unverified runtime tree.

## Axis 17. Build / CI-CD-Pipeline-as-Legible-Artifact
Verdict. "The Sealed Factory, Build-Once, Promote-by-Digest, Grade-by-What-You-Didn't-Pick." A green pipeline is the ultimate mirror oracle (agent authors the YAML, sets required checks, is graded green by them in one PR).

**Core principles**
- Expected value before location. The mirror breaks only when the verdict's expected value comes from a vantage the artifact-under-test cannot write. Content identity (reproducible digest), monotonic baseline (yesterday's number), or outside-in edge signal. "Above the repo" is a precondition that protects those three, never a substitute. A predicate the producer can zero out (tests=0 passes "failures>0"; a SARIF secret at `note` passes an error-only gate) is a mirror however org-enforced its location.
- Build once, promote by digest, never rebuild. The sha256 digest is the one identity the agent cannot move; a deploy job with no build tooling makes self-certification structurally impossible. Every rebuild-per-stage and `:latest`/`@vN` deploy ref re-opens the verified≠deployed TOCTOU with zero diff footprint.
- The build environment is the boundary (carried from axis 16). `force=true`, ambient ECR creds, and ENOSPC are the same disease. Ambient host state invisible in every diff/SBOM/signature/ruleset decides whether the build RAN and what bytes it produced. You cannot govern your way out of a non-hermetic build; seal it and make sealing the FIRST required step.
- Reproducibility makes signatures mean something. Keyless cosign signs with the workflow's own OIDC identity the agent edits; the Fulcio cert attests authorship, not correctness. A green verify on an agent-rewritten workflow is MORE dangerous than none. Rank rebuild-and-compare ABOVE signature-verify.
- Gate on positive evidence against a number you didn't pick. Forbid absence-of-negative predicates; require `tests ≥ baseline`, `coverage ≥ baseline`, `skipped_delta ≤ 0`, SARIF gated on finding EXISTENCE per rule-id at ANY level, all vs the merge-base commit. The only mechanism that makes "shrink what the gate measures" impossible.
- Conservation of trust against cost. Blocking-or-delete. Past ~6 gates the cost (flakiness, unreadability, added mirror surface) exceeds the trust and goes negative. Informational checks are pure cost to a green-optimizing agent. Few, fast, fail-closed. Border buys (hermeticity, content-addressing) are cheap because paid once and inherited.
- deployed==healthy and deployed==reversible are not deployed==verified. A perfect digest chain says nothing about a crash-looping rollout or a one-way migration. The deploy verdict comes from the edge SLI, not the deploy job's exit code; the irreversible subclass (DROP / destructive-backfill / charge / rotate) is quarantined behind a human seam the bot identity provably cannot grant.

**Recommended structure.** Four+ blocking gates in one org-owned template the feature PR cannot edit; repo authors only a ~15-line thin caller (`uses: org/ci-templates@<40-hex-sha>` + typed inputs). Gate 0 environment precheck (assert empty home, no ambient creds, resource floor, distinct exit codes); Gate 1 hermetic build-once (`--network=none`, base `@sha256:`, `SOURCE_DATE_EPOCH`, OIDC short-lived role); Gate 1b rebuild-and-compare (byte-identical digest, diffoscope on mismatch); Gate 2 monotonic-baseline + independent re-execution; Gate 3 aggregator (sole required check, `result=='success'` not `success()`, structured artifact must exist); Gate 4 deploy-by-digest-or-die (separate deployer principal, cluster-side admission controller in a different account); Gate 5 progressive promote (Argo Rollouts/Flagger edge SLI, auto-rollback); irreversibility quarantine routed to human-approved production environment.

**Conventions & guardrails**
- Author ONE thin caller; NEVER author deployable gate logic, masking flags, aggregators, or canary thresholds. Adding `continue-on-error`/`|| true`/`if:` to a gate job = widening the mirror; stop.
- Pin every external identity by content address (`@<40-char-sha>`, base `@sha256:`, deploy `image@sha256:`); never `@v4` (mutable, the tj-actions/changed-files incident moved a tag).
- Read the STAGE/GATE MAP and REQUIRED-CHECK MANIFEST (generated from the live org ruleset API), not the YAML. A green checkmark is not evidence; the aggregator's per-job `result=='success'` is.
- Treat "CI is green" as "I agreed with myself" until four author-independent signals confirm. Reproducible digest, baseline not regressed, independent re-execution agrees, edge SLI healthy.
- When a step exits 0, ask whether it RAN or was SKIPPED/MASKED/infra-blocked; absent JUnit/SARIF artifact = the step FAILED.
- NEVER autonomously trip a one-way door; route DROP/DELETE/charge/rotate to the human-approved production environment and ship the reversible part behind a flag defaulted OFF.
- Never interpolate `${{ github.event.* }}` into a `run:` (script injection); pass via `env:` and quote. Never `pull_request_target` with PR-head checkout; fork code runs on `pull_request` only (read-only token, no secrets).
- DISJOINTNESS PROOF over ownership-assertion. Prove the CI identity has ZERO write paths to the gate (direct, App-permission, via-IaC-apply) by a scheduled job asserting 403; an out-of-band auditor diffs live ruleset state against a signed expected-state file.

**Context strategy.** Pipeline-as-docs read top-down. The REQUIRED-CHECK MANIFEST (cannot drift from the live ruleset), the STAGE/GATE MAP, and structured JUnit/SARIF + a single signed verdict artifact replace a 10,000-line log. The agent holds only the ~15-line caller + manifest + verdict (it cannot edit the template).

**Antipatterns.** Gate accretion (30 gates = 30 mirrors); mistaking location for mechanism; absence-of-negative predicates; rebuild-per-stage / `:latest` deploy refs; treating cosign/SLSA/Rekor as the oracle; `continue-on-error`/`|| true`/skipped-as-passing; persistent/self-hosted runners with carried state; treating all deploys as reversible; deploy exit code as health signal; canary thresholds as ordinary repo config; ownership-assertion instead of disjointness-proof.

## Axis 18. Secrets / Credentials / Config
Verdict. "Handle, Not Hostage, The Zero-Standing-Secret Trust Plane (ABLATE > BOUND > VERIFY)." The agent both PROVISIONS (writes IAM/Vault/SealedSecret policy) and CONSUMES the secret, so "least-privilege / leak-proof / reversible" is self-certified.

**Core principles**
- ABLATE > BOUND > VERIFY per credential class. ABLATE. Replace long-lived secrets with short-lived federated identity (OIDC→STS 15m, Vault dynamic lease, IRSA/Pod Identity, ECR get-login 12h). BOUND. Cap what can't be ablated with an org permission-boundary + SCP the provisioner has explicit Deny on editing. VERIFY only the residue. You cannot leak what does not persist; deleting the secret removes both the oracle's burden and its false-negative floor.
- The mirror breaks ONLY when the WRITE path and VERIFY path are different identities with an explicit Deny between them. "Access Analyzer in CI" is theater if the agent's CI credential can edit the analyzer/boundary/SCP/trust-policy/scanner-config. The agent's job ends at "request widening," never "grant it."
- The headline number is `leak_window = TTL + time_to_detect + time_to_revoke`; TTL is the only term enforced without a correct post-leak human action. A static key has TTL=∞. Leading fleet metric. `count(credentials with no issuer-enforced TTL)` driven to 0, measured on the HOST/runner, not the repo.
- The real secret boundary is the build/runtime environment, not the repo diff. A secret beside the artifact (`~/.aws/credentials` static key, `~/.docker/config.json` inline auth, `~/.npmrc` `_authToken`/`force=true`) is as leaked as one inside it and invisible to repo-scoped gates.
- Irreversibility is first-class. A leaked long-lived credential cannot be un-leaked. `git rm` is not remediation (the value survives in `git log -p --all`). Only valid response. ROTATE (prove the old credential returns AccessDenied), THEN history-rewrite as hygiene. Short TTLs make this self-healing.
- The agent's context window/transcript is a first-class, UNTOOLED leak surface (ships to the model provider + every observability hop, no scanner, no rotation trigger). The act of "checking" (`echo $X`, `env`, `cat ~/.aws/credentials`) IS the leak. Operate ONLY on handles (ARN, vault path, secret name), enforced by substrate, not etiquette.
- Detection's only genuinely outside-the-mirror signal is USE-TRIGGERED. A honeytoken/canary whose use fires a third-party alarm makes the ATTACKER the oracle. Scanners predict; canaries prove. (Measured gitleaks sensitivity ~17%, a noise filter, not an oracle; the real AKIA's entropy 3.68 sits below a benign URL's 4.09.)

**Conventions & guardrails**
- Wire a HANDLE, never the value. Verify wiring via a resolve-and-ACCEPT probe (`{handle, resolved, source, length_class, fingerprint8:sha256[:8]}`, plaintext provably absent); verify revocation via resolve-and-REJECT (assert AccessDenied).
- Read the analyzer-principal-generated effective-permissions manifest, NOT the role JSON you wrote.
- Classify ambient credentials by STRUCTURE. `aws_access_key_id` with no `aws_session_token`/`credential_process` = long-lived static; inline `auths[*].auth` with no credHelper = baked token. Count them; drive to 0.
- Default every secret-typed config field to NO fallback and crash at boot (exit 78); default every security boolean to the SAFE value or make it required.
- The agent's own principal carries explicit Deny on `iam:CreateAccessKey`/`CreateLoginProfile`/`UpdateAssumeRolePolicy` and on writing the boundary/SCP/scanner-config/trust-policy (else it's one `iam:Create*` from minting a backdoor, the meta-mirror).
- Effective-permission gate (separate analyzer principal). `over_grant = |(role_allow_glob_expanded ∩ boundary − SCP_deny) − code_observed_actions| == 0` via glob-aware `simulate-principal-policy` + Access Analyzer (naive string-set returns EMPTY and under-reports).
- OIDC trust-policy gate. Require `StringEquals` (never `StringLike`) on BOTH `:aud=sts.amazonaws.com` AND fully-qualified `:sub`; reject any `*` or `refs/pull/*`; backstop with a negative out-of-band probe (synthetic staging/fork sub must get AccessDenied).
- Injection path narrowest-first. SDK fetch at startup or tmpfs/CSI mount > BuildKit `--mount=type=secret`. AVOID env (children inherit, `/proc/<pid>/environ`, crash dumps). NEVER `ENV`/`ARG`/`COPY` a secret in a Dockerfile.
- No-new-plaintext baseline is a necessary-not-sufficient pre-filter (config in a security-owned repo, allowlist monotonic-decreasing, server-side push protection underneath, named ~17% miss rate). Long-lived secret exception is quarantined (irreducible third-party keys only. Manager-stored + dual-active grace window + ≤90d max-age + named owner + dated exception).

**Context strategy.** Read HANDLES + a generated effective-permissions MANIFEST + a per-credential `leak_window` note, never values. The `fingerprint8` proves identical-secret across environments without revealing it. Never-read-plaintext-into-context is enforced by substrate (lint-ban raw env access, AST ban on `echo`/`env` near secret-named vars, transcript redaction).

**Antipatterns.** `os.environ.get('KEY','sk-live-...')` fallbacks; `git rm` as remediation; long-lived ambient creds beside the artifact; self-asserted least-privilege from the role JSON; treating the scanner/baseline as the oracle; `StringLike :sub` / missing `:aud`; env injection / Dockerfile-baked secrets; reading a value to "check it resolved"; flag-day rotation (no AWSCURRENT+AWSPREVIOUS overlap → 403-storms); having-it-both-ways "out-of-band" gates the agent itself invokes.

## Axis 19. Infrastructure-as-Code / Environment-Topology
Verdict. "The Bedrock-and-Leaf Architecture." The agent both AUTHORS the Terraform/CDK AND APPLIES it; IaC carries the strongest irreversibility in the program (`terraform destroy` on prod RDS/KMS/VPC). Resolution. Partition into BEDROCK (agent cannot write. VPCs, databases, IAM, KMS, DNS; consumed via data sources) and LEAF (agent authors freely. Stateless, service-scoped, auto-recoverable).

**Core principles**
- ABLATE > BOUND > VERIFY applied to IaC surface area. Prefer managed services the agent CONSUMES over raw IaC it WRITES. Bedrock is REMOVED from the agent's write path (not bounded, not verified, removed).
- THREE-PRINCIPAL SEPARATION with cryptographic enforcement. (1) Plan Principal, agent's role, reads state + runs plan, cannot apply; (2) Evaluate Principal, Lambda in a separate audit account, runs OPA/conftest on plan JSON, KMS-signs the verdict; (3) Apply Principal, applies ONLY a plan artifact bearing a valid KMS signature. The agent touches only Principal 1.
- The irreversible-destroy seam is a STATE MACHINE, not a gate. PROTECTED → PROTECTION_REMOVAL_REQUESTED → PROTECTION_REMOVED → (72h dwell) → DESTROY_ELIGIBLE → DESTROY_APPROVED → DESTROYED. Server-side dwell (DynamoDB TTL in audit account); no single PR can collapse the timeline; crossing requires a provably-different principal (human SSO + MFA).
- Permission boundary as PRIMARY defense, policy-as-code as defense-in-depth. The apply role's boundary explicitly DENIES `rds:DeleteDBInstance`, `dynamodb:DeleteTable`, `s3:DeleteBucket`, `kms:ScheduleKeyDeletion`, `ec2:DeleteVpc/Subnet`, `route53:DeleteHostedZone`, and `iam:*PermissionsBoundary*` on its own ARN. OPA is the VERIFY layer (it operates on attacker-controlled plan JSON).
- Module size hard-capped at 30 managed resources per state file, so the full plan JSON fits in context alongside `.tf` source and policy output. The single highest-leverage intervention for both blast-radius and legibility.
- Drift detection as a BLOCKING pre-condition, not a background cron. Every plan is preceded by `plan -refresh-only` (read-only audit-account principal); stateful drift BLOCKS apply until a human reconciles. The agent must NEVER auto-codify drift.
- CONNECTIVITY-IMPACT model supplements resource-count blast radius (a nightly cross-state dependency graph; gate on affected-services count, not resource count. 1 SG change = 1 resource but 100 services).
- Conservation of trust against cost. Three hard boundaries (account isolation + SCP + permission boundary) beat fourteen soft policy layers because they cannot be eroded incrementally.

**Conventions & guardrails** (layered hardest→softest. ablation → bounding → verification → drift → blast-radius → destroy-state-machine → state-integrity → pipeline-serialization)
- NEVER author bedrock (VPCs, subnets, databases, IAM roles, KMS keys, DNS, security groups); reference via data sources; ticket the platform team for new bedrock.
- ALWAYS read the topology manifest before planning; re-scan if stale (>1h).
- NEVER `apply` without a saved plan; never `-auto-approve`, `-refresh=false`, `force-unlock`, or `state rm/mv/import` (denied at the CLI-wrapper level).
- STOP and route to human approval on ANY stateful destroy, any network mod with >5 downstream consumers, or total `resource_changes > 20`.
- ONE module = ONE service = ONE state file = max 30 resources; propose a module split as a prerequisite PR if exceeded.
- NEVER remove `prevent_destroy` or set `deletion_protection=false` (route through the decommission pipeline); on drift do NOT auto-reconcile, report and STOP.
- State-integrity gate. An append-only audit-account Lambda rejects a state write that DECREASES the stateful-resource count without a destroy-approval token (defeats `state rm`).
- 4-account hierarchy with one-way trust. Management (SCPs), identity (role factory + permission boundaries + OIDC), audit (drift, policy eval, dependency graph, destroy state machine, manifest gen), workload. Agent creds exist only in workload, bounded by identity-account boundary + management-account SCP.

**Context strategy.** Read a KMS-signed TOPOLOGY MANIFEST (resource inventory stateful/stateless, dependency edges, blast-radius annotations, protection status, cross-state deps, last-drift-scan), never raw `.tfstate` (enormous, contains secrets). The PLAN SUMMARY is a structured table (actions × count × stateful × network × auto-recoverable) with the policy verdict + connectivity-impact. At ≤30 resources, full plan JSON + `.tf` + policy output fit simultaneously; bedrock is referenced via stable typed data-source outputs.

**Antipatterns.** Monolithic root module (>30 resources); agent self-certifying (writes `.tf` AND runs plan AND decides apply); `prevent_destroy` as sole protection; OPA as PRIMARY boundary; unstructured human approval at scale; blast-radius-by-resource-count alone; environment conditional logic in modules (`count = var.env=="prod" ? 0 : 1`); auto-codifying drift; single apply role with AdministratorAccess; plan/apply as separate steps with a gap; the two-PR attack (disable protection, then destroy); `state rm` as a drift fix; shared state backend across environments; agent modifying drift-detection infrastructure.

## Axis 20. Monorepo Tooling & Workspace Management
Architecture. "Bounded Monorepo with Hard Boundaries and Pre-Computed Scoping." At 50+ packages, a monorepo without tooling is worse than polyrepo; with affected-detection + caching + boundary enforcement it is better.

**Core principles**
- HARD BOUNDARIES. TypeScript `exports` field + project references make undeclared imports a COMPILATION FAILURE, not a lint warning.
- PRE-COMPUTED SCOPE. The orchestration layer computes the affected set once (fresh graph, correct merge-base) and hands it to the agent as a parameter; the agent NEVER runs `nx affected` itself.
- CORRECT GRAPH BY CONSTRUCTION. Every cross-package dependency goes through declared `package.json` + project references; declared deps are the only legal imports.
- ONE PACKAGE = ONE CONTEXT WINDOW. The agent works in one package at a time; cross-package context loaded JIT.
- AFFECTED SET CEILING. If affected >10 packages, triage by coupling-strength ranking (direct > transitive); run Tier 1 first, expand on failure.

**Key findings (failure modes).** Base-ref ambiguity (computing affected against `HEAD~1` or stale `origin/main` → silent under-detection); graph staleness (adding a dep then running `affected` without rebuilding the graph); over-connected shared-utils causing affected-set explosion (`shared-types` change → 35/45 packages); opaque affected lists with no coupling-strength ranking or import-path tracing.

## Axis 21. Configuration Management & Feature Flags
Architecture. "Zero-Manifest Flag Architecture, Flags as Typed Code, State as Telemetry." Flags are technical debt, not safety.

**Core principles**
- Flags are debt, not safety. Every flag doubles state space, requires testing both paths, accrues cleanup debt. Default to NO FLAG.
- Two legitimate types only. Progressive rollout (temporary, removed after 100%) and kill switches (operational break-glass). Everything else is code, not config.
- Type system is the registry. Flag existence is a compile-time enum; adding = enum entry; removing = delete from enum (compile errors locate all consumers).
- State lives in telemetry. Determine which path executed by reading structured logs (`flag.evaluated: {name, value, context}`), not by querying a service or a stale manifest.
- Cross-layer dependencies are executable. If flag X requires env var Y, the startup validator crashes when X=ON and Y missing, enforced, not documented.

**Agent conventions.** Binary settled-check (flag 100% for >TTL days → remove the flag and dead branch); read the typed config module (Zod schema/`env.ts`) for what CAN vary, not a manifest; read structured logs for runtime flag state during incidents; flag-creation decision tree (user-visible? → could it break? → is rollback sufficient or gradual needed? → only then add a flag).

**Antipatterns.** Hand-maintained manifest YAML (a lie within hours); flagging irreversible operations (migrations, event emissions, external API calls, rollback doesn't undo side effects); progressive rollout as default (most changes are all-or-nothing); flag-budget exceptions (no "operational"/"permanent" categories bypassing the cap). Enforcement. Flag-TTL lint rule (error after expiry + 7 days), cap active flags at 12.

## Axis 22. Dependency Injection & Service Composition
Architecture. "Layered Typed Composition with Derived Lifecycle." Static visibility over runtime magic; the agent determines dependencies by reading source, not runtime resolution.

**Core principles**
- Static visibility over runtime magic. No decorators, no reflection, no string tokens. The agent reads factory signatures and sees all dependencies, zero runtime indirection.
- One graph, one truth. The composition root IS the lifecycle graph IS the shutdown order. Never maintain a parallel `dependsOn` declaration.
- Typed completeness enforcement. The composition root's return type is asserted against a union of all expected services; a missing service is a compile error.
- Boundary-only polymorphism. Interfaces only for substitutable boundaries (DB adapters, external API clients); internal modules stay concrete.
- Composition exclusivity via tooling. Factory invocations (`create*Service`) banned outside `*.compose.ts` files (one lint rule makes all wiring visible).
- Integration tests as primary strategy. A composition-root smoke test with real infra (testcontainers) catches wiring bugs that mock-based unit tests cannot.

**Antipatterns.** DI containers with decorator/reflection (NestJS, Inversify, graph invisible to static analysis); module-global test overrides (`__setForTest`, service locators in disguise, cross-test leakage); dependency groups (`type InfraDeps = {db, logger, cache...}`, miniature service locators); string-based injection tokens (untyped parallel namespace invisible to refactoring); optional dependencies with behavioral defaults (hide config dimensions, test-vs-production divergence).
