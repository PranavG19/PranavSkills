---
name: orchestrate
description: Move substantial work through shaping, tickets, implementation, review, and human QA without crossing context boundaries.
disable-model-invocation: true
---

`shape -> spec -> tickets -> fresh implementation -> fresh review -> human QA`

This is a stage router, not a mega-session. One run advances one durable boundary, records what the
next context needs, and stops. A small direct change does not need this pipeline.

## Start

Before task-specific work, open a checklist whose first item is to call the Skill tool with `triage` and read the skill
governing the current stage; copy that stage's steps in verbatim before any task-specific items. A
stage you deliberately skip stays in the list with a one-line reason and is recorded in the
handoff, never dropped silently. In the reply, name each skill you invoked and the decision or
artifact it drove; a stage cited with no artifact behind it means you skipped it.

## Route the current stage

1. **Orient.** Call the Skill tool with `triage`, inspect the workspace, and locate any active spec and
   `.agents/tickets/` board. State which artifact proves the current stage.
2. **Shape an unresolved idea.** Call the Skill tool with `grilling`. It explores the code before asking questions
   and hands settled decisions to `spec`. Stop when the spec is written.
3. **Slice a settled spec.** Call the Skill tool with `to-tickets`. Stop after the dependency DAG validates and the
   human approves the ticket shape.
4. **Build one ready ticket.** Enter with a fresh context and call the Skill tool with `implement`. One ticket is the
   context budget. Stop when it reaches `review`.
5. **Review one implementation.** Use a fresh context and call the Skill tool with `ticket-review`. Stop at `done`,
   `changes-requested`, or a concrete block.
6. **Hand taste back to the human.** Human QA may create more tickets. It does not silently reopen
   or widen completed scope. Merging, pushing, and deploying the approved work stay human actions.

## Parallel work

Parallelize only ready tickets whose expected writes do not overlap. Each gets an atomic board
claim and its own `worktree`; shared config, lockfiles, migrations, and symbols keep one owner.
Worktrees isolate code, not credentials or the host filesystem, so unattended execution still
requires a real sandbox.

## Context handoff

At every stop, report the artifact path, completed stage, next skill, exact ticket or spec section,
and unresolved block. The next session reconstructs from those artifacts rather than a compacted
conversation.

`learn` is not a pipeline stage. Call the Skill tool with `learn` only when a corroborated, non-obvious lesson has no
stronger durable owner in code, tests, types, hooks, skills, or project documentation.
