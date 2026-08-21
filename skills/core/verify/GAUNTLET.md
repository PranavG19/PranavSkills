# Risk-Based Test Gauntlet

Start from the feature's claims and boundaries. For every triggered row, name the command,
environment, expected oracle, result, and evidence location. Mark untriggered rows `not applicable`
with one concrete reason.

| Test family | Trigger |
|---|---|
| Type, lint, unit | Changed executable code |
| Integration | Changed module boundary, persistence, framework wiring, queue, cache, or SDK adapter |
| Contract/compatibility | Changed API, schema, event, file format, dependency, or N/N-1 behavior |
| End-to-end | Changed user-visible workflow or cross-component path |
| Visual/accessibility | Changed rendered UI, interaction state, copy structure, or motion |
| Device/platform | Changed mobile/desktop native behavior or platform-specific integration |
| Concurrency/idempotency | Shared mutation, retry, ordering, deduplication, lock, or race risk |
| Property/fuzz | Parser, codec, validation, normalization, protocol, or broad input space |
| Load/soak | Throughput, latency, memory, resource-pool, growth, or sustained-operation claim |
| Jitter/fault | Timeout, retry, partial failure, network variance, dependency degradation |
| Security/privacy | Authentication, authorization, tenancy, secrets, PII, injection, abuse boundary |
| Migration/recovery | Data migration, deploy ordering, rollback, backup, restore, resumability |
| Observability/canary | Production behavior whose correctness depends on runtime signals |

## Execution order

1. Hold a parent or historical baseline for the metrics that matter.
2. Run cheap deterministic checks first.
3. Run boundary and workflow checks next.
4. Run destructive, sustained, or production-adjacent checks only in an authorized environment.
5. Inject realistic latency and failures at owned boundaries; do not destabilize shared systems.
6. Re-run focused checks after corrections, then the complete selected gate once.

## Pass bar

- Every acceptance claim has at least one observable signal.
- Critical claims use an independent oracle, not only author-written tests.
- No selected check is skipped or retried into green without a recorded cause.
- Performance reports distributions and resource use against a baseline, not one average.
- A flaky result is fixed, quarantined with an owner, or remains a failed gate.
- UI/device evidence follows the `browser` visual-QA reference.
- Production mutation remains human-gated through `triage`.
