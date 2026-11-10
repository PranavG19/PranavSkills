# Hooks

Two kinds of hook live here: **harness hooks** that run as PreToolUse guards in Claude/Codex/Kiro,
and **git hooks** that run inside `git commit` / `git push`.

## Harness hooks

Rendered into each profile's `<target>/hooks/` as symlinks by `scripts/render.mjs`. Claude profiles
wire them into `settings.json` under `PreToolUse`. Codex profiles wire them into `hooks.json` under
`PreToolUse` with the `codex` client argument so the guard emits JSON decisions.

- **bash-guard.sh** -- matcher `Bash|Write|Edit`. Allows only one plain push (never forced,
  deleting or hook-skipping, never to a host in `BASH_GUARD_NO_PUSH_HOSTS`). Blocks recursive
  forced deletion, hard resets, discarding working-tree changes, forced branch deletion, and
  staging a `.env`; warns on writes to secret-shaped files. Each denial names a safe next action.

## Git hooks

Installed per-repo by symlinking into `.git/hooks/`. Not managed by `render.mjs` (git hooks are
per-repository, not per-harness).

- **commit-msg-ascii** -- a `commit-msg` hook. Rejects commit messages containing non-ASCII
  characters (em/en dashes, smart quotes, ellipses, non-breaking spaces, arrows). Some review
  tools rewrite non-ASCII to literal `???` in both the review and the amended commit, so the
  damage reaches permanent history. Install with:
  ```
  ln -sf /path/to/PranavSkills/hooks/commit-msg-ascii .git/hooks/commit-msg
  ```

## Testing

Run after changing any hook:

```
hooks/test-bash-guard.sh
hooks/test-commit-msg-ascii.sh
```

## Two things that have bitten

**Hooks must stay executable** (`chmod +x`). Otherwise the harness gets exit 126
`permission denied`, which reads as a broken hook, not as a block, so every dangerous command
sails through.

**bash-guard.sh matches on substrings, so it false-positives on quoted text.** Writing a file whose
*contents* mention a blocked command (a heredoc, a doc, this README) trips the guard, because it
greps the whole command string rather than the command being executed. Workaround: write such files
with the editor tool rather than a shell heredoc. A real fix would parse the command instead of
pattern-matching it.
