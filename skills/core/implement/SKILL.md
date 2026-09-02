---
name: implement
description: Implement exactly one local ticket through a red-green-refactor loop. Use when a `.agents/tickets/` item is ready, when resuming a claimed ticket, or when `orchestrate` reaches the build stage.
---

`fresh context -> claim one ticket -> red -> green -> refactor -> affected checks -> review`

1. **Select one ticket.** Invoke `to-tickets` to list ready work. Claim exactly one ticket before
   editing; an existing claim by another owner is a stop signal.
2. **Load only its packet.** Read the ticket, its referenced spec sections, named code exemplars,
   and direct dependency outputs. Do not load the entire planning history.
3. **Classify the action.** Invoke `triage`. An irreversible ticket remains human-gated; an `afk`
   label never overrides that classification.
4. **Isolate the write.** Invoke `worktree` for unattended or parallel work. Confirm this ticket
   has one owner for every file, symbol, lockfile, and migration it may touch.
5. **Build through `tdd`.** Take one acceptance criterion at a time through its pre-agreed public
   seam: prove red, reach minimal green, refactor while green, then repeat. Tests are part of this
   ticket, never deferred to another ticket.
6. **Run checks incrementally.** Execute focused tests after each cycle and the affected typecheck
   regularly. Run the ticket's affected lint/integration checks, then the repository's full
   required suite once at the end. Preserve exit codes and record skipped checks honestly.
7. **Prove critical claims.** Invoke `verify` for money, authentication, data, subtle invariants,
   or any claim whose expected value came from the implementation itself. Invoke `browser` for an
   observable UI acceptance criterion. A test you wrote and graded green is not proof of the thing
   it tests; if you judge a claim non-critical and skip `verify`, record that skip and its reason in
   the ticket.
8. **Hand off.** Move the ticket to `review`, summarize the diff and evidence in the ticket, and
    stop. Review runs in a fresh context through `code-review`; do not self-approve.

One ticket is the context budget. Scope discovered outside it becomes a new ticket unless it is
required to make the current acceptance criterion true.
