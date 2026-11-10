# commits and PRs (GitHub)

## commits

- The message is one line, `<type>: <lower-case subject>` with type feat, fix, test, refactor,
  docs or chore. Nothing else, so no body, no co-author or tool trailers, and no mention of AI.
- A PR is squash-merged, so its title uses the same format and becomes the one commit on main.

## PRs

- One kind of change per PR, under about 300 changed lines, with each change kept beside its own
  tests.
- Put each part of a feature in the earliest PR where that kind of code lives.
- A PR uses only its own code or code already on main. In a stack, each PR targets the one below
  it and builds on its own.
- The description covers only that diff. Link the issue with `Closes #<n>` when one exists.
- Before opening, a fresh-context reviewer checks correctness and security first, and every
  finding gets a disposition.
- Leave approved PRs as they are. Rewriting one for a small refactor costs the reviewer a re-read
  for little gain.

## pushing

- Agents may push any branch of a GitHub repository, main included, once an independent Opus 5.5
  review and an independent Sol 6.1 review both approve the diff. Neither reviewer is its author.
- A project's own rules still decide how a pull request lands (its review rule, its gate).
- Repositories on a review-only host (`BASH_GUARD_NO_PUSH_HOSTS`) take changes through that host's review tool, never a push.
- Never force-push, delete a remote branch or skip hooks. The shell guard enforces the mechanical
  part.
