# Mocking Boundaries

Mock only a boundary the code does not own:

- network services and third-party SDKs;
- wall clock, randomness, environment, and process boundaries;
- filesystem or database when a real temporary instance is impractical;
- irreversible effects such as charging, sending, or deleting.

Prefer a fake, test container, temporary directory, or local test database when it remains fast.
Do not mock internal classes or modules merely to make a test isolated; that couples the test to
the implementation.

Wrap an external boundary in a narrow domain interface. Inject that interface, then give the test
one explicit response per operation. Avoid generic fetch mocks whose behavior depends on URL
conditionals spread through the test.

Assert what crossed the system boundary only when that effect is the public behavior. Otherwise
verify through the caller-facing result.
