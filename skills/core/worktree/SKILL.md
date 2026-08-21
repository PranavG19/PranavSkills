---
name: worktree
description: Create an isolated git worktree so a task can't disturb the main checkout. Use before a risky change, when running parallel work streams on one repo, or before an unattended agent run.
---

## Create (from inside the repo)

```bash
git worktree add ../<repo>-<branch> -b <branch>       # new branch
git worktree add ../<repo>-<branch> <existing-branch> # existing branch
```

Name the directory after the branch, so parallel trees stay distinguishable, and place it as a sibling of the repo — a nested worktree confuses tooling.

## Work

- `cd` in — it's a full checkout sharing the same `.git`, with its own branch and index, so commits in one tree don't affect another. Give each parallel agent one worktree plus one branch so they never collide.
- **One owner per file / symbol / shared config.** A worktree isolates the *filesystem*, but two streams both editing `package.json`, a lockfile, a migration sequence, or the same symbol still merge-conflict by hand. Split along non-overlapping paths and assign a single writer for anything shared, with others submitting intents to that owner. Overlapping writes erase the parallelism gain.

## Finish

```bash
git worktree list                       # see all trees
git worktree remove ../<repo>-<branch>  # after merging/landing
git worktree prune                      # clean stale entries
```

## Constraints

- A branch checks out in only one worktree at a time. Remove each worktree as soon as its branch merges or is abandoned, so `git worktree list` stays an accurate picture.
- Pushing is the human's step; a hook blocks `git push` from a worktree.
- Non-git VCS, or worktrees unavailable → fall back to a separate clone and say so.
