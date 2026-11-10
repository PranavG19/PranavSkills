---
name: ticket-review
description: Review one implemented ticket from a fresh context against its acceptance criteria and repository standards. Use when a local ticket reaches `review`, or when an independent implementation review is requested.
---

`fixed diff -> independent spec review + standards review -> verify findings -> verdict`

1. **Pin the review.** Resolve the ticket, referenced spec sections, merge-base or parent commit,
   exact diff, commit list, repository standards, and recorded evidence. Search the repository for
   every file that documents how code should be written; `CODING_STANDARDS.md`, `CONTRIBUTING.md`,
   and agent context files are on the list when they exist. Stop on an unresolved
   fixed point or empty diff. Recorded evidence counts only against the pinned diff. A green an
   implementer captured on a superseded revision does not carry to this one, so re-establish it
   against the current diff or treat it as absent.
2. **Start clean.** Review outside the implementation conversation. Treat implementer output as
   evidence to inspect, not a verdict.
3. **Dispatch two independent reviewers.** Start each with a fresh context window, never a fork
   of this conversation. Issue both together in the foreground and aggregate the reports they
   return. Without subagent support, run them in separate fresh sessions so one axis cannot
   anchor the other.
   - **Spec reviewer:** for every acceptance criterion return `met`, `not met`, or `unverified`
     with proving code and signal. Flag missing behavior, wrong behavior, and scope creep.
   - **Standards reviewer:** trace modified call paths and compare the diff with repository rules,
     named exemplars, tests, and surrounding conventions. Flag regressions, unsafe boundaries,
     missing failure handling, unnecessary complexity, and implementation-coupled tests.
4. **Verify candidates.** Re-read each cited location and authority. For any finding on a critical
   path, re-run a focused check. A re-read proves you pointed at the line, not that the bug is
   real. Grade each finding by where its evidence lands: (1) asserted, (2) you pointed at the line,
   (3) you showed the bad case can't happen, (4) you ran a check that fails loud if wrong, (5) you
   reproduced it. Rung 4 is the bar for a blocking finding; below it, mark the finding's certainty.
   Remove findings about unchanged code, nonexistent symbols, preferences not backed by a rule, or
   behavior disproved elsewhere in the diff.
5. **Report the axes separately.** Under `Spec` and `Standards`, rank actionable findings by
   severity with file/line, trigger, consequence, and judging criterion or rule. Do not let one
   clean axis hide a failure in the other.
6. **Give one ticket verdict.**
   - `approve`: every acceptance criterion is met and no blocking finding remains.
   - `changes-requested`: name the smallest required corrections and move the ticket back to
     `in-progress`.
   - `blocked`: required evidence or authority is unavailable; state exactly what supplies it.
7. **Close the review.** On approval, move the ticket to `approved`. The integration owner moves
   it to `done` only after its branch is integrated and the project gate remains green. Human QA
   may add follow-up tickets; it does not silently expand this one.

Use `critiquing` only for an additional multi-angle panel. The two review axes above are mandatory
and narrower: did we build the right thing, and did we build it correctly for this repository?
Reviewing a diff with no local ticket is `diff-review`'s job, not this skill's.
