---
name: commit
description: Stage and commit the current work cleanly, scoped, conventionally messaged, not pushed.
disable-model-invocation: true
---

## Steps

1. **Look first.** `git status` plus `git diff` (staged and unstaged). Know what changed before writing a message about it.
2. **Decide scope.** One logical unit → one commit. Clearly separable changes (a fix plus an unrelated refactor) → propose splitting them rather than bundling.
3. **Stage the intended files** by path, rather than a reflexive `git add -A`. `.env`, secrets, and build artifacts stay out (a hook guards `.env`).
4. **Write the message in this shape.** It is the format of Pranav's own commit history.
   ```
   <type>: <lowercase imperative summary>
   ```
   - Type is one of `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, with no scope.
   - The summary starts with a verb (`add`, `wire`, `honor`, `remove`) and names the behavior. The whole subject fits in 72 characters, with no trailing period.
   - The subject is the whole message. The reason goes in the PR description.
   - In a repo whose history uses another convention (`git log -10 --format=%B`), match that history instead. Tool attribution and co-author trailers appear only where that history uses them.
   - Pure ASCII. `git log -1 --format=%B | LC_ALL=C grep -n '[^[:blank:] -~]'` prints nothing.

   Real examples:
   ```
   feat: add a pi render target
   fix: refuse a command the shell guard cannot parse
   docs: point the worktree skill at the pushing rule
   ```
5. **Commit,** then show the result with `git log -1 --stat`.

## Constraints

- **Committing never pushes.** A push follows the pushing rule in `memory/preference/github-review.md` (two independent reviews, never review-only remotes, never forced).
- Landing on the default branch gets flagged first. Offer to branch instead.
- A pre-commit hook that modifies files → re-stage and re-run it. `--no-verify` needs the user to ask for it. A gate you route around wasn't there, so surface a hook you believe is wrong instead of bypassing it silently.
- **Stop before committing an irreversible action.** A commit carrying a destructive migration (`DROP`/`TRUNCATE`/narrowing alter), a backfill, a secret rotation, a tenant delete, or a breaking contract/schema change is not routine. Flag it and confirm the human owns the call (see `triage`). The diff is reversible; running it in prod is not.
