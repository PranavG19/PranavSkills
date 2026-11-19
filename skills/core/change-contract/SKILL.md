---
name: change-contract
description: Freezes a scoped, unticketed fix's success criterion, non-goals, and diff budget before the first edit, then reuses it as the CR/PR description. Use when starting a single scoped fix that ships on its own without a ticket. Whole features are spec's job.
---

`change-contract → freeze the requirement card → stamp the artifact epoch → build inside the budget → render the submission writeup`

A surgical fix on a shared package drifts when its scope was never frozen. The fix grows a helper, the helper grows a flag, and the one-line change becomes a review nobody can bound. **A change with no written contract has no boundary, so every reviewer and every future agent re-derives the scope from the diff.** This skill freezes that boundary once, before the first edit, and reuses it verbatim as the CR or PR writeup.

Boundary with the neighbors. `change-contract` is a single unticketed CR (the surgical-fix path). `code-task-format` is a board ticket inside a planned pipeline. `spec` is a whole-feature design. Reach for this one when the work is a scoped fix that ships as its own CR without a ticket.

## Freeze the requirement card

Fill [the template](../../_shared/change-contract.md) before editing. The load-bearing fields.

1. **Literal success criterion.** The one observable outcome that means done, stated as a check you can run, not a feeling. If you cannot state it, you are not ready to build.
2. **Non-goals.** The nearby behavior this change explicitly does not touch. Every non-goal you name is a refactor you will not smuggle in.
3. **Diff budget.** The rough production and test line count you expect. Materially exceeding it is the signal to stop and reassess the design, not to keep adding.
4. **Required authorities.** The packages, APIs, credentials, and data the change must reach, and which you actually have. A missing mandatory authority blocks the build. Do not invent an adapter around it.

## Stamp the artifact epoch

Record the exact tree the contract was written against, so a later reviewer knows what the diff sits on.

- **Base identity.** The base commit SHA, plus the dependency lock or pinned versions the build resolves against where the ecosystem has them. Evidence and green checks bind to this epoch (see `verify`).
- **One writer.** Name the single package and branch this contract owns. A change spanning two packages is two contracts.

## Build, then render the writeup

Build inside the budget. Call the Skill tool with `triage` first to classify the change, then call the Skill tool with `verify` to prove the success criterion. When the diff is ready, the frozen card renders directly into the submission writeup.

- **What changed** and why, traceable to the success criterion.
- **What was left alone**, from the non-goals.
- **How it was verified**, naming the independent signal.
- **Base identity** so the reviewer reads the diff against the right epoch.

## Constraints

- The contract is frozen before the first edit. Editing the criterion mid-build to match what you wrote is the failure this skill prevents.
- A change that outgrows its diff budget is a design signal, not a bigger contract. Stop and reassess.
- One contract owns one CR on one package. Cross-package work splits into one contract each.
