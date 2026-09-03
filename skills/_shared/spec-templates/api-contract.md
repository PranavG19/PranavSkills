# API-contract spec template

For a REST/RPC/service interface. Every endpoint, payload, status, and rule decided so a client and server team could build against it independently and integrate without surprises.

```markdown
# <Service/Resource> API Contract

## Conventions
Stated once for all endpoints.
- Base path / versioning (`/api/v1/...`).
- Resource routing. List / detail / create / replace / partial / delete verbs and paths; nested-resource pattern.
- Response envelope (`{ data, meta, error }` or whatever the project uses).
- Pagination. Cursor (feeds) vs. offset (stable lists); defaults and max page size.
- Auth. How the caller is authenticated; what identity the server derives.
- Middleware chain order (auth → validate → authorize → entitlement → handler → serialize → errors).

## Errors (MANDATORY)
The full status→error mapping (400 VALIDATION_ERROR, 401 UNAUTHORIZED, 403 FORBIDDEN, 404 NOT_FOUND, 409 CONFLICT, 429 RATE_LIMITED, 500 INTERNAL_ERROR ...). What's logged at each level; what's returned to the client vs. redacted.

## Security (MANDATORY)
- AuthN. Who can call at all.
- AuthZ per endpoint. The exact rule for who may perform it (own-resource, role, entitlement, relationship). Name the predicate; depth matters.
- Input validation. Every field's validation rule; injection/abuse surface.
- Rate limits per endpoint tier (standard / elevated / strict).
- Entitlement/feature gating if applicable.

## Endpoints
For each endpoint:
- **Method + path**, one-line purpose.
- **Request**. Path/query params, body schema (every field: type, required, validation, default).
- **Response**. Success status + body schema; the error statuses it can return and when.
- **AuthZ rule**. The exact predicate.
- **Idempotency**. Is it safe to retry? Idempotency key / ON CONFLICT behavior.
- **Side effects**. Events emitted, downstream writes, notifications.
- **Pagination/filtering/sorting**. The supported params and bounds.

## Concurrency & consistency (MANDATORY)
Concurrent-write handling per mutating endpoint (optimistic version, atomic update, lock). Ordering guarantees. Eventual vs. strong consistency for reads after writes. Offline/duplicate submission handling.

## Scale (MANDATORY)
Hot endpoints and their bounded query shapes. Caching strategy. Expected request volume / payload size limits. Known bottlenecks + revisit triggers.

## Versioning & compatibility
How breaking changes ship; deprecation path; backward compatibility window.

## Testing
Test seams (contract tests, integration). What a good test asserts (status + envelope + side effects), not implementation.
```
