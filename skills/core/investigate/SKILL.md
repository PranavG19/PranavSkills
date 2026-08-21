---
name: investigate
description: Disciplined diagnosis for hard bugs and performance regressions. Use when a bug, test failure, crash, or perf regression has a cause that isn't immediately clear; skip typos and one-liners.
---

`investigate → build feedback loop → reproduce → 3–5 ranked falsifiable hypotheses → instrument (one variable) → fix + regression test → cleanup + post-mortem`

A discipline for hard bugs. The iron law: **no fix without a confirmed root cause.** Skipping a phase requires stating the justification. An obvious one-line fix gets fixed directly, without this skill.

While exploring, use the repo's `CONTEXT.md` glossary for a mental model and check `docs/adr/` for decisions in the area you're touching.

## Phase 1 — Build a feedback loop. This is the skill.

A fast, deterministic, runnable pass/fail signal for the bug. With it, bisection, hypothesis-testing, and instrumentation all just consume the signal; without it, staring at code won't save you. **Be aggressive and creative — spend disproportionate effort here.**

Ways to build one, in rough order of preference:

1. Failing test at whatever seam reaches the bug.
2. curl / HTTP script against a running dev server.
3. CLI invocation with a fixture, diffing stdout vs known-good.
4. Headless browser script (use the `browser` skill) asserting on DOM/console/network.
5. Replay a captured trace/payload through the code path in isolation.
6. Throwaway harness — minimal subset of the system, one function call.
7. Property/fuzz loop for "sometimes wrong" bugs.
8. Bisection harness (`git bisect run`) if it appeared between two known states.
9. Differential loop — same input through old vs new, diff outputs.

Then **iterate on the loop**: faster, sharper (assert the specific symptom rather than "didn't crash"), more deterministic (pin time, seed RNG, isolate fs/network). A 2-second deterministic loop is a superpower; a 30-second flaky one barely helps.

**Non-deterministic bugs:** raise the *reproduction rate* instead of hunting a clean repro — loop 100×, parallelize, add stress, narrow timing. 50% is debuggable; 1% isn't.

**When a loop genuinely can't be built:** stop, say so, list what you tried, and ask for environment access, a captured artifact (HAR, log dump, recording), or permission for temporary instrumentation. Hypothesizing without a loop is the failure mode this phase exists to prevent.

## Phase 2 — Reproduce

Run the loop and watch the bug appear. Confirm it is the failure mode the **user** described (a nearby look-alike means wrong bug, wrong fix), that it reproduces across runs, and that the exact symptom is captured for later verification.

## Phase 3 — Hypothesize

Generate **3–5 ranked falsifiable hypotheses before testing any** — single-hypothesis thinking anchors on the first plausible idea. Each states its prediction: "if X is the cause, changing Y makes it disappear." A hypothesis with no stateable prediction is a vibe; sharpen or discard it. **Show the ranked list to the user** before testing — they often re-rank instantly with domain knowledge. Proceed without blocking if they're AFK.

## Phase 4 — Instrument

Each probe maps to a specific prediction; **change one variable at a time.** Prefer a debugger/REPL breakpoint over ten logs. Tag every debug log with a unique prefix (`[DEBUG-a4f2]`) so cleanup is one grep. For perf, logs are usually wrong — measure a baseline (profiler, timing harness, query plan), then bisect. Measure first, fix second.

## Phase 5 — Fix + regression test

Write the regression test **before the fix**, provided a **correct seam** exists — one exercising the real bug pattern at the call site. If the only available seam is too shallow to catch the real bug, a test there gives false confidence; **record that absence as a finding** (the architecture is preventing lockdown). With a correct seam: turn the repro into a failing test → watch it **fail on the unfixed code** (red-first — a test that passes before your fix proves nothing) → apply the fix → watch it pass → re-run the Phase 1 loop on the original scenario.

**The regression test's expected value must come from a source the bug couldn't author.** You wrote fix *and* test in the same breath, so a test asserting what your fixed code now produces is a mirror — it locks in your fix's behavior rather than the *correct* behavior. Anchor to something independent: the symptom the user reported, a known-good value from before the regression, a differential against the old or other implementation, a round-trip/invariant. On a critical path (money, auth, data) or for a subtle fix, hand the claim to `verify` for an independent oracle rather than trusting the suite you just extended.

## Phase 6 — Cleanup + post-mortem

Before declaring done:

- [ ] Original repro no longer reproduces (re-run the loop)
- [ ] Regression test passes (or the absent seam is documented)
- [ ] All `[DEBUG-...]` instrumentation removed (grep the prefix)
- [ ] Throwaway harnesses deleted
- [ ] The correct hypothesis stated in the commit message

Then ask: **what would have prevented this?** An architectural answer (no good seam, tangled callers, hidden coupling) gets surfaced as a recommendation *after* the fix is in. A non-obvious root cause is worth a `learn` entry.
