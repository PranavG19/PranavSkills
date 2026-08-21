# Data-model spec template

For a database schema / data layer. Modeled on decision-complete schema docs — every table, column, constraint, cascade, index, and access rule decided before code. Nothing left to the migration author.

```markdown
# <Domain> — Data Model

## Design principles
The conventions every table follows, stated once so individual tables don't repeat them:
- Base columns on every table (id/created_at/updated_at conventions, types, defaults).
- User-ownership pattern (FK to user; do child tables denormalize user_id for access checks? why?).
- Flexibility column (JSONB metadata?) — what goes in a real column vs. metadata.
- Append-only vs. mutable tables — which are immutable (no updated_at) and why.
- Enum vs. text discriminator rule — closed/rare → enum; open/grows-with-features → text. State the rule.
- Soft vs. hard delete — which tables, which flag.
- Numeric precision conventions (per kind of value).
- Default cascade rules (parent→child, optional refs, safety-critical refs).
- Indexing baseline (every FK, every user_id, every column in WHERE/ORDER BY).

## Security — access control (MANDATORY)
For EVERY table, the exact read/write rule. Not "secured" — the actual predicate.
- Define the reusable access patterns (e.g. Pattern A: own-row private; Pattern B: authenticated-read/service-write; Pattern C: relationship-gated).
- For each table: which pattern, and for cross-user cases the precise rule (own-row OR public-flag OR accepted-friend OR shared-group...).
- Helper predicates for complex checks (is_friend, shares_group) — defined once, with their performance characteristics and the indexes that cover them.
- Trust boundary: which writes are client-allowed vs. service-role only.

## Enums & discriminators
Every closed enum with its values. Every text discriminator with example values + why it's text (and a CHECK constraint to catch typos, with the one-line migration to extend it).

## Triggers / derived data
Auto-update triggers (updated_at), auto-creation on signup, denormalization keepers. The concurrency-safe update pattern for any counter (atomic `SET x = x + n`, never read-then-write).

## Tables
For each table — a column table (Column | Type | Constraints | Notes), then:
- **Indexes**: each one and the query it serves.
- **Access rule**: which pattern + exact predicate.
- **Cascade**: per FK, the on-delete behavior and why.
- **CHECK constraints**: any (e.g. exactly-one-of nullable FKs).
- **Lifecycle**: soft/hard delete, orphan strategy for polymorphic refs.
- **Scale note**: retention/pruning/partitioning if unbounded; expected row count at target scale; known bottleneck + when to revisit.

## Migration strategy
One migration per phase; idempotent; enums created when first needed; never edit old migrations; how it ships incrementally.

## Notes for implementers
Query patterns per table group (the actual shapes, bounded). Offline/dedup strategy (client IDs, ON CONFLICT). Seed data spec (counts, distribution, source file).
```
