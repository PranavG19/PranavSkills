---
name: tdd
description: Build one observable behavior at a time through red-green-refactor. Use when implementing a feature or bug fix test-first, or when `implement` reaches a testable acceptance criterion.
---

`agree seam -> write one behavioral test -> prove red -> minimal green -> refactor -> repeat`

1. **Choose the seam.** Test through a public boundary where a caller observes the behavior. Use
   seams already settled by the spec or ticket. If the boundary itself is a real design fork, stop
   and resolve it before writing tests.
2. **Write one test.** Express one behavior from the acceptance criterion using a spec literal,
   worked example, invariant, or other expected value independent of the implementation.
3. **Prove red.** Run the focused test against the parent behavior. Confirm it fails for the
   intended reason, the missing behavior, not an import error, typo, or unrelated fixture. A red
   for the wrong reason proves nothing. A new capability with no parent behavior may use a temporary
   intentional break to prove the assertion observes the seam.
4. **Reach green.** Add only enough production code to pass this test. Do not anticipate later
   cases.
5. **Refactor while green.** Improve names and remove duplication without changing behavior. Run
   the focused test after each meaningful cleanup.
6. **Repeat vertically.** Take the next acceptance behavior through the same loop. Tests stay in
   the same ticket as the behavior they prove.

Read [tests.md](references/tests.md) when choosing test shape. Read
[mocking.md](references/mocking.md) when the behavior crosses time, randomness, storage, process,
network, or another system boundary.

## Guardrails

- Test behavior through public interfaces, not private methods or internal call counts.
- Prefer a real lightweight dependency over mocking code you own.
- Keep one red-green cycle small enough to diagnose from one failure.
- A test changed merely to agree with new output is still red until the spec justifies the change.
- Run focused tests during the loop; typecheck regularly; leave the full suite to the ticket gate.
- Prefer no new test over a bad test, one that mostly exercises mocks, encodes current
  implementation details, or would be deleted right after proving the change. When the only
  reachable test is bad, use a scripted or manual check and say so.
