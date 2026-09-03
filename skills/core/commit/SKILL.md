---
name: commit
description: Stage and commit the current work cleanly, scoped, conventionally messaged, never pushed.
disable-model-invocation: true
---

## Steps

1. **Look first.** `git status` plus `git diff` (staged and unstaged). Know what changed before writing a message about it.
2. **Decide scope.** One logical unit → one commit. Clearly separable changes (a fix plus an unrelated refactor) → propose splitting them rather than bundling.
3. **Stage the intended files** by path, rather than a reflexive `git add -A`. `.env`, secrets, and build artifacts stay out (a hook guards `.env`).
4. **Write the message.**
   - Subject line: imperative, ≤72 chars, no trailing period. `Add X`, `Fix Y`, not `Added`/`Fixes`.
   - Match the repo's convention; check `git log --oneline -10` first for Conventional Commits (`feat:`, `fix:`) and ticket refs.
   - Body only when the change isn't self-evident. Give the *why*, since the diff already shows the what.
   - Tool attribution and co-author trailers only where the repo's own history uses them.
5. **Commit,** then show the result with `git log -1 --stat`.

## Constraints

- **Never `git push`, force-push, or otherwise write to a remote.** Pushing is the human's step.
- Landing on the default branch gets flagged first. Offer to branch instead.
- A pre-commit hook that modifies files → re-stage and re-run it. `--no-verify` needs the user to ask for it. A gate you route around wasn't there, so surface a hook you believe is wrong instead of bypassing it silently.
- **Stop before committing an irreversible action.** A commit carrying a destructive migration (`DROP`/`TRUNCATE`/narrowing alter), a backfill, a secret rotation, a tenant delete, or a breaking contract/schema change is not routine. Flag it and confirm the human owns the call (see `triage`). The diff is reversible; running it in prod is not.
