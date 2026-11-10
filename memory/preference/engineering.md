# engineering standards

The codebase's own convention wins. Where it has none, hold the change to this bar.

## code

Java is shown. Apply the same idea in other languages.

- Build objects through the DI container with constructor injection, never by hand. In Java
  that is `@RequiredArgsConstructor(onConstructor_ = @Inject)` over `private final` fields.
- `@NonNull` on every field, parameter and return value that cannot be null. Return `Optional`
  when a value may be absent, and chain it (`map`, `flatMap`, `orElseThrow`) in place of stacked
  null checks.
- `final` and immutable values (records, `@Value`, unmodifiable collections) by default, with the
  narrowest visibility that compiles.
- Throw a specific exception whose message names what was wrong, and pass the original cause when
  rethrowing.
- Logs carry identifiers only. Secrets, credentials, full tokens and personal data stay out. Mask
  a token to a short prefix when a log line must correlate it.

## comments

- One short plain line, only for a non-obvious reason or gotcha. Match the density of neighboring
  files.
- Plain text. No Javadoc or HTML tags, no `@param`/`@return` restating the signature.
- History (ticket ids, review rounds, "per the design doc") goes in the commit and the CR.

## tests

- Name a test by the behavior it checks (`rejectsExpiredToken`). Plan ids like `CT-06` mean
  nothing to someone reading a test report, so they stay out of test names, data-provider labels
  and test comments.
- A bug fix starts with a test that fails before the fix.
- Loosening a test, threshold or lint rule to get green is my call. Ask first.
