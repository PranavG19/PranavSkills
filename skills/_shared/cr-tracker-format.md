# CR tracker format

A local, on-disk record for tracking several code reviews (CRs or PRs) to submission at once. It
holds status so a crash or a fresh context can resume. It does not drive the work. `supervise` and
the review skills drive; this file is the ledger they read and update.

Store it where the work lives, for example `<workspace>/.agents/cr-tracker.md`, so it survives a
laptop crash or a new session.

## One row per CR

Key each row by CR id plus the current head SHA. A new head SHA voids that row's prior green
verdicts, because the reviewed tree changed. Record, per row:

- **id** and **head-SHA**, the composite key.
- **scope**, a one-line statement of what the CR changes.
- **gates passed**, drawn from the ordered set (build, review, approval, dependency-ordered deploy).
- **gates remaining**, the same set minus the gates passed.
- **depends-on**, other CR ids that must land first.
- **owner** and **next action**.

## Rules

- A new head SHA on a CR clears that row's build, review, and approval verdicts. Re-run the gates
  against the new tree before marking any of them green again.
- Deploy order follows the depends-on edges. A CR does not deploy before the CRs it depends on.
- The tracker is the status of record. When a live gate result and the tracker disagree, trust the
  gate and update the row.

This is a tracking artifact, not an orchestrator. Ownership, claims, and integration order live with
`supervise`. The frozen scope and base identity of each CR live with its `change-contract`.
