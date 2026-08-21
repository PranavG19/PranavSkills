---
name: to-tickets
description: Turn a settled spec into a dependency-aware local board of vertical-slice tickets. Use when work needs splitting across fresh sessions or parallel agents, or when managing `.agents/tickets/`.
---

`spec -> vertical slices -> dependency DAG -> validate board -> human checks the shape -> fresh session per ticket`

The board lives at `<workspace>/.agents/tickets/` whether or not the workspace uses Git. Each ticket
is one Markdown file following `_shared/code-task-format.md`; no generated index is stored. The
bundled `scripts/tickets.mjs` derives board state and serializes claims.

## Create a board

1. **Find the workspace root.** Use the repository root unless the project context defines a
   higher-level workspace root. An existing `$AGENT_TICKET_DIR` wins.
2. **Initialize.** Run `node <this-skill>/scripts/tickets.mjs --dir <root>/.agents/tickets init`.
3. **Read the settled spec and live code map.** Name the user-visible outcomes, acceptance
   criteria, likely modules, existing exemplars, and hard ordering constraints.
4. **Slice vertically.** Each ticket crosses the layers needed to produce one observable behavior.
   A schema-only, API-only, UI-only, or "add tests later" ticket is incomplete unless that artifact
   is independently usable.
5. **Build the DAG.** Keep tickets within one fresh context. Set `depends-on` only for real
   prerequisites, `mode: afk` only when the ticket is reversible and has a deterministic check,
   and `status: ready` only when every dependency is already done; otherwise use `backlog`.
6. **Validate.** Run `.../tickets.mjs --dir <board> validate`, then `... ready`. Fix duplicate IDs,
   missing dependencies, cycles, and malformed metadata before presenting the board.
7. **Stop for shape review.** Show the ordered tickets, dependency edges, AFK decisions, and the
   first ready slice. Implementation starts in a fresh context with `implement`.

## Manage the board

```bash
node <this-skill>/scripts/tickets.mjs --dir <board> list
node <this-skill>/scripts/tickets.mjs --dir <board> ready
node <this-skill>/scripts/tickets.mjs --dir <board> show T-001
node <this-skill>/scripts/tickets.mjs --dir <board> claim T-001 --by <agent>
node <this-skill>/scripts/tickets.mjs --dir <board> move T-001 review
node <this-skill>/scripts/tickets.mjs --dir <board> move T-001 approved
node <this-skill>/scripts/tickets.mjs --dir <board> move T-001 done
```

Use `--json` on `list` or `ready` for machine-readable output. A claim is atomic on one filesystem;
worktrees isolate code, while the shared board coordinates ownership.

## Board lifecycle

- `backlog`: dependencies or scope prevent a claim.
- `ready`: explicitly approved and claimable.
- `in-progress`: atomically claimed by one owner.
- `review`: implementation complete; fresh-context review pending.
- `approved`: independently reviewed; waiting for integration into the project baseline.
- `blocked`: names a concrete missing dependency or decision in the ticket body.
- `done`: approved and integrated with the project gate green. Human QA may create new tickets
  rather than reopen the old scope.

Completed boards are working records, not permanent project documentation. Keep them in a local
ignored directory or a visibly closed issue store; promote only durable decisions to code, tests,
ADRs, or stable project docs.
