---
name: web
description: Fast targeted lookup of current external facts — library/API docs, framework changes, releases, error messages. Use before asserting a version-specific or post-cutoff fact you're unsure of, when guessing at an external tool's API, or to decode an unfamiliar error.
---

Guessing at library APIs is a top source of wrong code, so reach for this the moment you're about to state a version-specific or post-cutoff fact you aren't certain of.

## How

1. **Search** the specific question with your web search tool — library plus version plus the exact thing. Prefer official docs, the project's own repo and changelog, and primary sources over blog aggregators.
2. **Fetch** the most authoritative hit with your web fetch tool and read the actual content rather than the search snippet. For internal hostnames, follow the routing rules in the project's agent context file.
3. **Verify version relevance** against the project (`package.json`, the lockfile, `Cargo.toml`). Docs for the wrong major version are worse than none.
4. **Report** with the source link, so the claim stays checkable.

## Constraints

- Cite every non-obvious external claim; an uncited one gets flagged as unverified.
- One page that didn't answer the question means keep searching — search is cheap, wrong code is expensive.
- This is for *lookups*. "Research X across many sources into a report" is a fan-out: dispatch a
  subagent per source or angle in one batch, and synthesize their returns.
