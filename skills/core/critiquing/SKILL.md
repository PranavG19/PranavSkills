---
name: critiquing
description: Stress or expand an artifact through independent subagents. Use when ideating, red-teaming, seeking expert perspectives, or validating a design, spec, plan, or consequential diff.
---

`frame artifact → pick mode + N named angles → dispatch in parallel (≤8 findings each) → verify (CONFIRMED/PLAUSIBLE/REFUTED) → sweep for gaps → ranked report`

One harness, three modes. Spawn several **independent** subagents over an artifact, verify what they surface, then synthesize. Independence is the point — parallel agents blind to each other's take surface failure modes (or ideas) a single pass misses.

**Mode is a parameter.** Take it from the caller when given; otherwise pick from the request — refuting or breaking → **adversarial** (the default); expanding options → **ideate**; multi-discipline sign-off where named roles carry the judgment → **expert**. The three are defined at the bottom.

This critiques *any* artifact — code, design, spec, plan, decision — via a multi-agent panel. A built-in code-review tool reviews a diff or PR against itself; that is a different job and can run alongside.

## Phase 0 — Frame the artifact
State exactly what's under review and the bar it must meet. **Read it fully first** — for code, get the diff (`git diff @{upstream}...HEAD`, fall back to `git diff main...HEAD` / `git diff HEAD`; or a passed PR/path) and trace the real call paths; for a spec/plan/design, read the whole document and the `CONTEXT.md` glossary. Critique from the artifact itself, never from names or a partial read.

## Phase 1 — Dispatch N independent angles in parallel
Launch the chosen mode's angles as **independent subagents dispatched in one batch** so they run concurrently. Give each the same artifact and one named angle. Each returns **up to 6 candidate findings**: location, one-line summary, concrete consequence (the failure / the cost / the opportunity). **Don't let one angle suppress another** — two flagging the same spot for different reasons → record both. Use 3–4 angles normally and never more than 6. Set a bounded wait before dispatch; a timed-out angle is missing evidence, not permission to wait forever.

**Subagents run in fresh context — they see nothing but their prompt.** The independence that makes this work is what makes each child blind: it did not read the artifact, the conversation, or `CONTEXT.md` — *you* did. Hand each a **self-contained packet**: the full artifact text or exact diff inlined, the bar it must meet, and any `CONTEXT.md` terms spelled out. Brief it as if it knows nothing, because it does. A child re-discovering the artifact burns its window; a child that can't find the file critiques from the *name* — the exact failure Phase 0 rules out, smuggled back through the briefing.

## Phase 2 — Verify (1 verifier per candidate, 3-state)
Dedup candidates pointing at the same spot/mechanism, keeping the most concrete consequence, then
shortlist at most 12 by likely consequence. Run **one verifier subagent per shortlisted candidate**
in batches of at most 6. Give it the artifact and candidate; it returns exactly one of:
- **CONFIRMED** — can name the inputs/state that trigger it and the wrong outcome. Quote the proving line/passage.
- **PLAUSIBLE** — mechanism is real, trigger uncertain. State what would confirm it.
- **REFUTED** — factually wrong or already handled elsewhere. Quote the line/passage that disproves it.

Keep CONFIRMED and PLAUSIBLE; drop REFUTED. Tune the bar to stakes: high-stakes/recall (a missed flaw ships) → a single non-REFUTED vote carries; low-stakes/precision → require CONFIRMED. In ideate mode, "verify" asks "is this option real and additive," not "can it be refuted."

## Phase 3 — Sweep for gaps
**One fresh subagent** sees the verified list and hunts ONLY for what was missed, rather than re-deriving anything already found. Up to 8 new candidates; nothing new → return empty. An empty sweep is a valid result.

## Phase 4 — Self-review, then report
Before emitting anything, run one pass over your **own** verified findings — this is where confident-but-wrong findings die:
1. **Re-read each cited location.** Confirm the problem exists in the actual artifact/diff — not in unchanged code, an adjacent line, or your paraphrase of it. A finding whose cited line doesn't say what the finding claims is cut.
2. **Verify every name.** Each symbol, file path, function, config key, and URL you reference must actually exist — check it yourself rather than trusting the subagent. A finding built on a misremembered symbol is a false positive.
3. **Recalibrate severity** against the bar from Phase 0.
4. **Dedup by root cause** — merge findings that are the same underlying problem surfacing in different spots.
5. **False-positive sweep** — drop anything still resting on speculation with no supporting evidence.

Then report: ranked most-important first, grouped, each with location + concrete fix/option + **the authority it's judged against** (see Constraints). Real and actionable findings only — when the artifact holds up, say so plainly.

---

## Mode: adversarial (default)
Each subagent **refutes** — assume it's wrong and try to prove it. Assign distinct named angles that fit the artifact:
- **correctness** — wrong logic, inverted conditions, off-by-one, missing cases, broken invariants.
- **failure modes / edge cases** — what input, state, timing, scale, or platform breaks it.
- **security** — injection, authz gaps, secret exposure, unsafe trust boundaries.
- **removed/changed behavior** (diff/revision) — what guarantee the old version held that the new one drops.
- **assumptions** — the load-bearing claim that, if false, collapses the whole thing.
- **performance** (when relevant) — wasted work, N+1, blocking hot paths.

Best for: pre-commit validation, plan stress-testing, security/correctness passes, "poke holes in this."

## Mode: ideate
Each subagent **generates and expands** — alternatives, missing capabilities, better framings. Diversity by angle: user-first, risk-first, simplest-thing-first, what-would-10x-this, what-are-we-not-considering. Breadth then convergence: surface distinct options, synthesize the strongest, graft the best ideas from runners-up. Best for: early design, brainstorming a direction.

## Mode: expert
Each subagent adopts a **distinct named persona / domain lens** and critiques in character — security principal, performance specialist, domain architect, skeptical staff engineer, the end user — each with that role's priorities and blind spots. Best for: multi-discipline design validation, "what would a panel say."

## Constraints
- Subagents are **independent** — keep one's output out of another's prompt in the same round.
- Evidence over assertion: every finding cites a location/reason, every recommendation is concrete. A vague "consider improving X" is not a finding.
- **Cite the authority.** When a finding judges the artifact against a standard — a spec section, a `CONTEXT.md` term, a convention in the project's agent context file, a design doc, an established codebase pattern — name it and quote it. "This violates the cascade rule in the spec's Lifecycle section" is actionable and verifiable; "this seems wrong" is not. A finding that judges against a *generic* best practice (not a project-specific rule) says so, so the reader can weigh it as opinion rather than a broken contract.
- This *evaluates and reports*. Apply fixes only when asked; otherwise hand findings to implementation or to a cleanup pass.
- Scale to stakes — a quick sanity check is 2–3 angles and no formal verify pass; a pre-launch review is the full harness.
