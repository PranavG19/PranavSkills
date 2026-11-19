---
name: diff-review
description: Read-only blocker review of a diff, PR, CR, patch or commit range. Use whenever you are asked to review, approve, judge or refute a code change, including as a review sub-agent whose brief names a diff, even when the brief does not mention a skill. A local ticket goes to ticket-review.
---

`diff-review → pin the diff and its claims → read-only → refute the claims → report blockers with file:line → verdict`

You are reviewing a change you did not write and there is no local ticket to anchor it. The trap is trusting the author's summary, the author's green, and the author's framing of what the change does. **A review that restates the author's claims has verified nothing. The signal is in what the author did not mention and what their own claims fail to survive.** Read the diff, refute its claims, and report only what would block.

This is the sibling of `ticket-review`. `ticket-review` pins a local ticket and moves its state through the board. This skill reviews an external diff (CR, PR, patch) that has no ticket, so it owns nothing and changes no state. Call the Skill tool with `critiquing` only for an extra multi-angle panel; this is the narrower, read-only blocker pass.

## Step 1. Pin the diff and its claims

Resolve the exact target and freeze it. The revision id, branch, or patch, its merge-base or parent commit, the file set, and the repository standards that apply. Search the repository for every file that documents how code should be written; `CODING_STANDARDS.md`, `CONTRIBUTING.md`, and agent context files are on the list when they exist. Write down the change's stated claims (what the description says it does and why it is safe). A moving or unresolved target stops the review.

## Step 2. Read-only, always

Never edit, build, or push in this mode. You are inspecting someone else's work, not fixing it. If the change needs edits, that is a finding, not an action you take. Treat the author's evidence as a claim to test, not a verdict to accept, and note that a green from a superseded revision certifies the old tree, not this diff.

## Step 3. Refute the claims

For each stated claim, try to break it against the diff. Trace the modified call paths. Ask what input, state, or ordering makes the claim false. A claim you cannot refute after a real attempt is stronger evidence than one you never tested. Grade every blocker by where its evidence lands.

1. **You said so.** An assertion. Worthless on its own.
2. **You pointed at the line.** You read the code that makes it true.
3. **You showed the bad case can't happen.** You reasoned it through structurally.
4. **You ran a check that fails loud if wrong.** The bar for a blocking finding.
5. **You reproduced it.** The strongest rung.

Rung 4 is the bar for calling something a blocker. Below it, mark the finding's certainty.

## Step 4. Report blockers only

Report only medium, high, and critical blockers. For each, give file:line, the trigger, the consequence, and the smallest fix. Skip nits and style preferences not backed by a repository rule. If nothing blocks, say "none". A review that pads its list with nits reads as thorough while burying the one finding that matters.

## Step 5. Verdict

State exactly one verdict. The claims survived and nothing blocks; or specific blockers must be resolved (list them, smallest fix each); or the review is blocked because a needed artifact or authority is unavailable (name what supplies it).

## Constraints

- Read-only means read-only. Editing or building the change is the one thing this mode never does.
- A blocker sits at rung 4 or it is marked as lower-certainty. A re-read proves you pointed at the line, not that the bug is real.
- "none" is a valid and common verdict. Manufacturing findings to look diligent wastes the author's time.
