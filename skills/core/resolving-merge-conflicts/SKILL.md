---
name: resolving-merge-conflicts
description: Resolve a merge or rebase conflict by recovering each side's intent, not by concatenating markers. Use when a merge, rebase, or cherry-pick leaves conflicts, or a worktree integration stalls on them.
---

`resolving-merge-conflicts → recover each side's intent → resolve by intent → prove with an unauthored signal → never abort what you were asked to resolve`

A conflict is two changes that each meant something. **Stitching the two marker blocks together produces text that compiles and satisfies neither intent, which is worse than either side alone because it looks resolved.** Recover what each side was trying to do, then write the version that honors both.

## How to resolve

1. **Recover each side's intent from its primary source.** Read the commit and its context on each side, not just the conflicting lines. What was each change trying to accomplish? The markers show you what collided, not why.
2. **Resolve by intent, not by markers.** Write the code that satisfies both intents. If they genuinely cannot coexist, that is a decision to surface, not a merge to fudge. Do not paste both blocks and hope.
3. **Prove the result with an unauthored signal.** A resolution that compiles is self-consistent, not correct. Run the tests or a focused check that would fail if either intent was dropped (see `verify`).
4. **Never abort a conflict you were asked to resolve.** Aborting the merge or rebase hands the problem back untouched. If a resolution needs a decision you cannot make, surface the specific choice, do not undo the operation.

## Constraints

- Resolve by intent recovered from each side's source, never by concatenating marker blocks.
- A compiling resolution is unproven until an independent signal confirms neither intent was lost.
- Do not `--abort` a conflict you were tasked to resolve. Surface the blocking decision instead.
