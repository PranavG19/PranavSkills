# CONTEXT.md format

`CONTEXT.md` at a repo root is a **domain glossary** — the shared vocabulary for the codebase. It is totally devoid of implementation details: no file paths, no function names, no code. It defines what the *words* mean.

A repo with multiple bounded contexts has a `CONTEXT-MAP.md` at root listing each context, and one `CONTEXT.md` per context directory.

## Structure

```markdown
# <Context Name> — Glossary

## <Term>
The precise, canonical definition. One concept, one term. If two words are used
interchangeably in conversation but mean different things, define both and note
the distinction explicitly (e.g. Customer vs. User).

## <Term>
...
```

## Rules
- One canonical term per concept. When you spot a fuzzy or overloaded word, propose the precise term and record it here.
- Definitions only — never behavior, never "how it works", never a spec.
- Write entries lazily: add a term the moment it's resolved in conversation, not in batches.
- If a term conflicts with one already here, flag it immediately rather than silently adding a duplicate.
