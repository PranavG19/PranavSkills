---
name: postmortem
description: Draft an incident postmortem from a confirmed root cause. Impact, timeline, five-whys, and corrective actions placed on the structural-over-detection ladder. Use when writing a postmortem, RCA, or incident retro, or after an incident is understood.
---

`postmortem → confirm the root cause first → quantify impact by scope → timeline → five-whys → corrective actions on the structural ladder`

A postmortem written before the root cause is confirmed launders a guess into an org record. **An action item that treats a symptom teaches the next on-call to watch harder, not the system to fail less.** This skill drafts the org-facing artifact (postmortem, RCA, incident retro) from a confirmed cause, and forces every corrective action down the structural-over-detection ladder before it counts as a fix.

This is distinct from `investigate` Phase 6, which is a personal "what would have prevented this" note. This produces the shared artifact with impact, timeline, and owned actions. Distinct from `learn`, which records a durable lesson for future agents, not an incident record.

## Step 1. Require a confirmed root cause

Do not draft from a hypothesis. If the cause is not yet proven, run `investigate` first and come back with the reproduction and the mechanism. A postmortem is only as honest as the cause it names, and "we think it was X" in an org record is worse than no record.

## Step 2. Quantify impact by scope, not line count

State impact in customer and system terms. Which customers, how many, for how long, and what they could not do. Requests failed, data affected, revenue or trust at risk. The size of the diff that caused it is irrelevant to the impact and must not stand in for it.

## Step 3. Timeline

A factual sequence with timestamps. When it started, when it was detected, when it was mitigated, when it was resolved. Detection latency (start to detected) and mitigation latency (detected to mitigated) are themselves findings, often larger than the bug.

## Step 4. Five-whys to the mechanism

Ask why to the root, not to the first plausible stop. The trigger is not the cause. "The deploy failed" leads to "why was the failure allowed to reach production", which leads to the missing guard. Stop at a cause you can encode against, not at "human error".

## Step 5. Corrective actions on the structural-over-detection ladder

Rank every corrective action by how hard it makes the failure to recur, strongest first. Prefer the highest rung the failure allows (see `agent-arch` for the full ladder).

1. **Make the failure state unrepresentable** (types, schema, an invariant the system cannot violate).
2. **Block it at a boundary** (a lint, a required check, a CI gate, a permission).
3. **Route through a canonical helper** so the safe path is the only path.
4. **Detect it at runtime** (an alarm, a monitor).
5. **Prose and vigilance** (a runbook note, "be careful"). The weakest rung, and never the only action.

An action that lands only on rung 4 or 5 leaves the failure fully able to recur. Name at least one action at rung 1 through 3 or say why none is possible.

## Constraints

- No draft without a confirmed root cause. Invoke `investigate` first when the cause is unproven.
- Impact is measured in customer and system terms, never in lines of code.
- A postmortem whose only corrective actions are "add an alarm" and "be careful" has not corrected anything. Push at least one action up the ladder.
