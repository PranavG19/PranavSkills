# System spec template

For a multi-component or cross-service design. Composes the other templates per component. Adds the cross-cutting concerns that only appear when pieces interact.

```markdown
# <System> Design

## Overview
What the system does and the problem it solves, end to end. One diagram (mermaid) of components and data flow.

## Components
Each component, its responsibility, the interface it exposes, what it owns vs. delegates. Link to a `data-model` block for each datastore and an `api-contract` block for each service boundary.

## Data flow
The end-to-end paths for the key operations, which component does what, in order, including the failure branches. Event flow if event-driven (emit-after-write, handler idempotency, cascade depth limits).

## Boundaries & contracts (MANDATORY)
Every inter-component contract. The payload, the guarantees, the versioning. Trust boundaries between components (which are inside the security perimeter, which aren't).

## Security (MANDATORY)
End-to-end. Where auth happens, how identity propagates across components, secret management, the trust model between services. Per-boundary authorization.

## Scale & performance (MANDATORY)
The bottleneck component; how each scales (horizontal/vertical/partition); capacity targets; backpressure and rate limiting between components.

## Consistency & concurrency (MANDATORY)
Where the system is strongly vs. eventually consistent and why. Distributed concurrency (idempotency, ordering, exactly-once vs. at-least-once). What happens under partial failure / partition.

## Failure & recovery
Failure mode per component and the system's degraded behavior. Retry/circuit-breaker strategy. Rollback/disaster recovery.

## Rollout
How it ships incrementally. Phase order, feature flags, migration sequence, backward compatibility during transition.

## Testing
Integration/contract test strategy across boundaries; what's tested in isolation vs. end-to-end.

## Open questions
Unresolved cross-cutting decisions.
```
