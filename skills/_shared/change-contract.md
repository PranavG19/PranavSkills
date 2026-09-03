# Change contract template

For a single surgical change that ships as its own CR or PR without a board ticket. Freeze it before the first edit. The filled contract renders directly into the submission writeup. For a board ticket use `code-task-format`; for a whole feature use a `spec` template.

```markdown
# <Change> Contract

## Success criterion
The one observable outcome that means done, stated as a check you can run (a test, a command, a
production signal). Not "it works".

## Non-goals
The nearby behavior this change explicitly does not touch. Each line is a refactor you will not
smuggle in.

## Diff budget
Rough production and test line count expected. Exceeding it materially is the signal to reassess
the design, not to keep adding.

## Required authorities
Packages, APIs, credentials, and data this change must reach, and which you hold. A missing
mandatory authority blocks the build.

## Artifact epoch
- Base commit SHA
- Dependency lock or pinned versions the build resolves against, where the ecosystem has them
- The single package and branch this contract owns (one writer)

## Verification
The independent signal that proves the success criterion (see `verify`). Red-first check, and the
oracle that is not the implementation.

## Submission writeup (rendered when the diff is ready)
- What changed, and why, traced to the success criterion.
- What was left alone, from the non-goals.
- How it was verified, naming the signal.
- Base identity, so the reviewer reads the diff against the right epoch.
```
