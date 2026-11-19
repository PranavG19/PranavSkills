---
name: supervise
description: Coordinate several project orchestrators through cmux while preserving ticket, worktree, review, and integration boundaries, with optional T3 thread-local browser and device evidence.
disable-model-invocation: true
---

`portfolio -> one workspace/orchestrator each -> ready frontier -> evidence -> review -> serial integration -> human QA`

Use this when one human-facing agent coordinates several active projects. It schedules and
observes; each project orchestrator owns its own `orchestrate` pipeline and local board.

1. **Inventory projects.** For each root, record the objective, cmux workspace/surface ref, active
   spec, `.agents/tickets/` board, branch/worktree state, and next human decision. When T3 owns
   thread-local QA, also record the T3 thread, preview-tab, device-host, and device IDs. Existing
   workspaces and threads win over duplicates.
2. **Assign one project orchestrator.** Launch or resume one durable agent session per project
   through `cmux`. Give it the project root, objective, current artifact, and an instruction to run
   `/orchestrate`. Before sending, read the addressed surface and confirm it is idle at the expected
   agent prompt in the expected project. The portfolio supervisor does not implement tickets.
3. **Schedule the frontier.** Ask each orchestrator for validated ready tickets. Run only tickets
   whose dependencies are done and expected writes do not overlap. Parallelism is bounded by the
   safe frontier, not by an arbitrary agent count.
4. **Require isolation and ownership.** Every writing worker gets one claimed ticket and one
   worktree. Shared symbols, migrations, generated files, configuration, and lockfiles have one
   writer; other workers submit intents to that owner.
5. **Observe transitions.** Prefer cmux events, notifications, workspace status, and progress for
   fleet state. Use T3 preview or Device panel evidence for a thread's browser or native QA when
   available. Inspect the addressed surface when status is stale or ambiguous. A quiet terminal or
   visible device stream is not proof of completion or failure.
6. **Enforce evidence.** A ticket reaches review only with its focused red/green history, affected
   checks, and risk-selected `verify` evidence. UI/device tickets include screenshots or
   recordings, interaction results, and the exact T3 or cmux surface and device identity used.
7. **Review independently.** Start a fresh-context session that calls the Skill tool with `ticket-review`. A worker never approves its
   own ticket. Send requested changes back to the same ticket and owner.
8. **Integrate serially.** Land approved branches through one project integration owner in
   dependency order. After each integration, run the affected guard checks; after the frontier
   merges, run the repository gate and relevant gauntlet again. Move each ticket from `approved`
   to `done` only after that integration remains green. Track several in-flight CRs to submission
   with the `_shared/cr-tracker-format.md` ledger, keyed by CR id plus head SHA so a new push voids
   that row's prior verdicts.
9. **Report by exception.** Surface decisions, conflicts, failed gates, stalled sessions, and
   completed user-visible slices. Keep routine progress in cmux status rather than flooding the
   conversation. A step you skip stays on the board with a one-line reason; "by exception" governs
   what you report, not which steps you run.
10. **Return taste to the human.** Human QA judges the integrated product and creates follow-up
    tickets. Pushing or production mutation remains a human action; treat it as delegated only on an
    explicit, logged instruction.

## Recovery

- Lost session: reconstruct from the ticket, worktree, commits, and evidence, not guessed terminal
  history.
- Stalled agent: read the exact surface, identify the missing context, capability, feedback,
  authority, or evidence, then supply that one thing or mark the ticket blocked.
- Conflicting workers: stop the later claimant, preserve both worktrees, and return ownership to
  one integration agent. Resolve the actual merge conflict by calling the Skill tool with `resolving-merge-conflicts`.
- Failing integration: classify whether the branch, ordering, or shared contract caused it; reopen
  the smallest responsible ticket.

Every additional worker must correspond to one independent ready ticket with a deterministic
completion signal. Nested orchestrators do not create more authority, context, or correctness.
