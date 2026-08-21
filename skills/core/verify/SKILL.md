---
name: verify
description: Prove a behavioral claim with a signal you did not author. Use when implementing logic that touches money, auth, or data, before declaring a correctness claim done, or when a green test suite needs to mean something.
---

`verify → name the claim → find an oracle the implementation cannot reach → red-first → grade by an independent signal → report what is verified vs merely self-consistent`

This is the antidote to the **mirror oracle**: the agent writes the code AND the test AND grades itself green. The iron law — **a green check from a signal the author produced proves only that the author agreed with themselves.** Every signal in the stack (typecheck, the test you just wrote, coverage, even mutation score) certifies *self-consistency*, never *correctness*. Break the loop: grade the claim from a vantage the implementation cannot author. Where none is reachable, call it **unverified** — an honest "unverified" beats a false green.

Sibling skills sit elsewhere: `critiquing` runs a design-time panel on the same model; the project's test runner reports a signal its author also wrote. This skill is the only one that asks where the expected value came from.

## The one question

**Where does the expected value come from, and can the code reach it?** A value the implementation computed — or that you wrote in the same breath as the code — is a mirror. Exactly three author-independent sources of truth exist; use one:

1. **Content / input identity** — the input itself is the oracle. Round-trip (`decode(encode(x)) == x`), inverse, a reproducible hash a third party recomputes. The witness is the input, which the buggy code cannot re-derive.
2. **A monotonic baseline** — yesterday's number you didn't get to pick this change: test count must not drop, coverage must not regress, finding-count per rule must not rise. "Satisfy the gate" becomes "hold a measurement from a commit you didn't author."
3. **An outside-in production signal** — a vantage the emitting code cannot write: the edge SLI (gateway/LB, rather than the app's own success counter), a black-box probe asserting on the response *body*, a canary, a honeytoken the attacker trips, a screenshot diff for visual output.

## How to verify (scale to the claim's blast radius)

1. **Name the claim precisely.** Not "it works" — "`charge(cents)` rounds half-to-even and never produces a negative receipt." A claim you can't state is a claim you can't verify.

2. **Pick the cheapest sufficient oracle** — tier by cost so the inner loop stays affordable:
   - **Pure-shape** (rename, move, type-only): typecheck is enough — reported as `unverified: behavior-not-checked` rather than as correctness.
   - **Return-value logic**: one focused test whose expected value is a **spec literal** (`toBe(80)` from the ticket) or a **differential reference** from a *different* module/library/prior release. A literal that re-derives the SUT's own formula (`toBe(price * rate)`) is a mirror.
   - **Algebraic / invariant-bearing** (codec, parser, sort, normalize): a **property** (round-trip / metamorphic / differential) plus ≥1 spec-anchored literal. The property must assert an invariant the spec states, not re-encode the implementation's formula.
   - **Effect-bearing** (I/O, ordered calls, mutation): assert the **effect transcript** (recorded call sequence) instead of the return value. Falsify by swapping two adjacent effects — still green means it doesn't pin order.
   - **Critical path** (money, auth, data, irreversible): the above **plus mutation testing on changed lines** as a sensitivity check (gate: zero new survivors) **plus** an outside-in signal if it ships to prod (canary on edge SLI).

3. **Prove sensitivity red-first.** Run the new/changed test against the *parent* state and confirm
   it fails, then confirm it passes on the new code. A test green on both proves nothing about the
   change. For a new feature, temporarily break the implementation and confirm the test catches
   it. This proves the test observes the change; it does not make its expected value independent.

4. **Confirm the assertion actually ran.** An assertion-free or guarded test (`if (cond) expect(...)` where `cond` is false on the failing input) reaches green while verifying nothing. Make "did the assertion fire" a measured number (`expect.assertions(N)` or equivalent) rather than an eyeball.

5. **Watch for the swallow.** Code that catches an error and returns a success value (a 2xx, a default) makes its own success signal a lie. Verify against what the *caller/edge* observed, and add a distinct failure counter that a test forces to move.

## Feature gauntlet

For a completed feature, integration frontier, or release candidate, read
[GAUNTLET.md](GAUNTLET.md). Select every test family whose trigger is present and record why each
other family is not applicable. This is risk selection, not a ritual that runs every expensive
suite against every change.

## Report — per claim, separately

- **Verified** — by which independent oracle, named: input identity / spec literal / differential
  reference / historical baseline / edge SLI / externally judged screenshot.
- **Self-consistent only** — typecheck passed, code agrees with its own test, no independent oracle. **Not** done.
- **Unverified** — no oracle reachable; say why and what would provide one.

Four greens from one wrong belief are still one wrong belief. Format + lint + typecheck + my-own-test are correlated on exactly what they don't cover: runtime behavior against the spec. Keep them itemized rather than summed into "it works."

## Escalate, don't fake

For a claim about an **irreversible operation**, a **cross-system boundary**, or **perceptual output you cannot observe**, an independent oracle may be unreachable from inside the loop. Say so and request the human, the canary, or the real device — manufacturing a green here is the one failure this skill exists to prevent. (Same escalation trigger as `triage` and `agent-arch`.)

## Constraints

- The expected value comes from outside the implementation. Red-first and mutation testing prove
  sensitivity, not that an author-chosen expected value is correct.
- Gate mutation testing on **zero new survivors on changed lines**, not on a percentage — equivalent mutants make 100% unreachable and teach suppression.
- A red snapshot gets diagnosed, not re-blessed; `--update` to reach green launders a regression into truth.
- A flaky test is a bug to fix or a quarantine to file. Retrying it to green counts as neither.
- Cheap-but-honest beats expensive-and-skipped: a sub-second focused test with an independent oracle, run red-first, outperforms a full suite the agent stops running. Keep the loop fast (step 2's tiering) so it actually runs.
