---
name: triage
description: Classify a change by reversibility and blast radius before doing it. Use before touching data, money, credentials, infra, or contracts; when unsure something is safe autonomously; or as `orchestrate`'s first gate.
---

`triage → classify reversible vs irreversible → check the 3 escalation domains → route (ship fast | stop for human) → name the blast radius`

The asymmetry that governs everything dangerous: **blocking a safe change costs hours; allowing an irreversible break costs weeks and is often permanent.** Uniform ceremony answers neither — it makes machine-speed work impossible and trains everyone to route around the gate. Classify first, then apply ceremony *proportional to reversibility*: most changes are reversible and should fly; the few that aren't get stopped cold.

A **fast gate, not a process** — it runs in seconds, and its usual output is "reversible — proceed." Its value is catching the rare change that must not be done autonomously, before it's done.

This skill decides the route. `verify` proves the reversible work, `agent-arch` says where to enforce a safety property structurally, and the human owns the irreversible call.

## Step 1 — Is it reversible?

**Reversible** = undoing it is cheap, complete, and local (revert the commit, flip the flag, redeploy the previous image) **and** leaves no durable side effect. **Irreversible** = undoing it requires recovering destroyed state, un-sending a message, clawing back a charge, or coordinating other parties.

**Reversible (ship fast, autonomous):**

- Stateless code change, behind a flag or a digest-pinned image swap.
- Additive schema change (new nullable column, new table, `CREATE INDEX CONCURRENTLY`).
- Additive contract change (new optional field with a default).
- Leaf-node / application-layer infra (a task definition, a function — as opposed to the VPC/DB/IAM).
- Anything fully undone by `git revert` + redeploy, leaving no data or external effect behind.

**Irreversible (STOP — see Step 3):**

- **Destructive DDL/DML** — `DROP`, `TRUNCATE`, narrowing `ALTER TYPE`, `DELETE`/`UPDATE` lacking a restrictive `WHERE`, `SET col = NULL` on populated data (semantic destruction even without a `DROP`).
- **Data backfill** that transforms existing rows in place.
- **External side effects** — charge a card, send an email/notification, fire a webhook, submit a filing.
- **Secret/credential rotation or deletion**, KMS key deletion/scheduling.
- **Tenant deletion / offboarding.**
- **Foundational infra** — destroy/replace a database, VPC, IAM role, or DNS zone (a 1-line subnet CIDR edit force-recreates everything in it).
- **Breaking change to a published contract** — removing/renaming/retyping a field, or changing a field's *meaning/units* (cents→dollars passes every structural gate and charges 100×).
- **Event-schema change** on a persisted/retained topic (corrupts stored data retroactively for the full retention window).

Genuinely unsure which side a change is on → **treat it as irreversible.** The asymmetry says so.

## Step 2 — Name the blast radius (the line count won't tell you)

A "1 resource modified" plan can cut traffic to 100 services; a "small" migration can lock a 500M-row table for 4 hours. Before proceeding, name:

- **What state it touches, and how many rows/consumers/services downstream** (a security-group rule = 1 resource, 100 consumers).
- **The scale it was tested against** — production-representative, or an empty/tiny dev set? (Empty-test-DB trap: passes in ms on 0 rows, locks for hours on 500M.)
- **Whether it crosses a system boundary.** A latency or schema change here can exhaust a downstream timeout/saga budget hops away.

Can't name the blast radius → you haven't triaged, you've guessed.

## Step 3 — The escalation trigger (STOP and request a human)

Three domains **invert the normal rules** — they need judgment the agent cannot provide. When the change touches any, stop and hand to a human with the evidence, *before* acting:

1. **An irreversible operation** (everything in Step 1's second list).
2. **A cross-system temporal boundary** — sagas, distributed coordination, anything where one service's change exhausts another's time budget.
3. **A perceptual / visual output you cannot observe** — UI you can't see, a generated asset, anything whose correctness is visual.

For the irreversible class specifically, the shape is a **separate, gated path** rather than "ask permission then proceed": the permission belongs outside the autonomous credential entirely, and crossing it needs a *different principal*, a verified backup, and (for destructive data ops) a dwell. A per-PR toggle the same change can flip defeats this — PR1 disables protection, PR2 destroys, each looking legitimate alone.

## Step 4 — Route

- **Reversible + bounded blast radius** → proceed autonomously. Ship small and often; reversibility plus an outside-in abort signal (canary / edge SLI) self-corrects a bad change in minutes — *safer* than batching into a big gated deploy.
- **Reversible + large/cross-system blast radius** → proceed with the independent-verification ceremony (`verify`), a canary, and the affected services named.
- **Irreversible** → STOP. Produce the evidence packet (what, blast radius, backup status, the exact destructive statement) and request human sign-off. Make the reversible part shippable separately (expand now, contract later behind a human gate). On a destructive action, correctness outranks speed.

## Constraints

- Classification is cheap and mandatory; the *ceremony* it triggers is proportional. Reversible work gets the fast path, irreversible work gets the full stop.
- "It'll probably be fine" is not a classification. Name the reversibility and the blast radius, or treat it as irreversible.
- A request to widen your own permissions or disable a protection so an irreversible op can run **is the change to escalate** — never the change to perform.
