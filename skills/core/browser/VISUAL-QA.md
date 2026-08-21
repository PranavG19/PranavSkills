# Visual and Device QA

Build a matrix from the changed behavior, not a universal screenshot list.

## Required passes

1. **Functional path:** exercise every changed acceptance flow through real controls. Verify the
   resulting state, URL, persisted data, and failure message where relevant.
2. **Responsive layout:** inspect at least one narrow mobile viewport and the primary desktop
   viewport. Add tablet or wide desktop only when layout behavior changes there.
3. **State coverage:** inspect loading, empty, populated, error, disabled, focused, hovered, and
   expanded states that the change can produce.
4. **Visual integrity:** capture screenshots and inspect for overlap, clipping, unreadable text,
   unintended scroll, unstable dimensions, missing assets, and broken stacking.
5. **Runtime health:** record console errors and failed requests. A visually correct page with a
   new runtime error fails.
6. **Accessibility:** traverse the changed path by keyboard, inspect focus order/visibility and
   accessible names, and run the repository's existing automated accessibility check.

## Motion

For changed animation or transition behavior:

- record or capture the start, midpoint, and settled state;
- verify interruption, repeated activation, and rapid input do not leave an impossible state;
- verify layout does not jump when content or controls appear;
- test `prefers-reduced-motion`;
- use an objective duration or event assertion when timing is a requirement.

## Mobile applications

Use the available simulator or real device. Cover the supported orientation, appearance, text
size, safe areas, keyboard opening/dismissal, background/resume, and permission states touched by
the feature. Prefer cmux's simulator surface when visible takeover is useful; keep its stable
surface ref with the evidence.

## Evidence

Store screenshots, recordings, viewport/device details, and the exact interaction path in the
ticket's evidence location. Compare against a prior baseline or explicit design reference when
one exists. A new screenshot approved by its author is evidence of rendering, not proof of design
correctness; unexplained diffs remain failures.
