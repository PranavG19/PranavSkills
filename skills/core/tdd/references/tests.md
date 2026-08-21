# Behavioral Tests

Choose the cheapest level that exercises the settled public seam:

- Pure function or value object: focused unit test through its exported interface.
- Module with storage or framework wiring: integration test through the module API using a test
  database or real lightweight adapter.
- User workflow: browser, API, CLI, or device test through the same entry point the user reaches.

A durable test:

- names an observable capability;
- arranges only state relevant to that behavior;
- uses a spec literal, worked example, fixture, or invariant as its oracle;
- fails when the behavior regresses but survives an internal refactor;
- has one logical reason to fail.

Reject tests that:

- assert private methods, internal collaborators, call counts, or implementation order;
- recompute the expected value with the same formula as production;
- query a side channel when the public interface can verify the result;
- snapshot unstable or irrelevant output;
- bundle many imagined behaviors before any implementation exists.

For a regression, reproduce the exact failing input first. For a new capability, start with the
smallest representative example, then add edge cases learned from each completed cycle.
