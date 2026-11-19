# How skills are written here

Distilled from Matt Pocock's `writing-for-agents`. These rules are enforced by
`scripts/doctor.mjs`.

## Frontmatter: four keys, no others

```yaml
---
name: <kebab-case, equals the directory name>
description: <see below>
disable-model-invocation: true   # only on user-invoked skills
argument-hint: "<question>"      # only when the skill takes an argument
---
```

No `allowed-tools`, no `version`, no `tags`, no `model`. Single-line descriptions, and
no YAML block scalars (`>-`), which render inconsistently across harnesses.

## The description is a trigger, not a summary

It is a **context pointer**: the only thing loaded in every session, and the sole basis
on which the agent decides to open the skill. Write it to fire, not to describe.

**Model-invoked**. `<Terse capability statement>. Use when <trigger>, <trigger>, or <trigger>.`

```yaml
description: Diagnosis loop for hard bugs and performance regressions. Use when the user
  says "diagnose"/"debug this", or reports something broken/throwing/failing/slow.
```

**User-invoked**. A human reads this. Strip the trigger list entirely.

```yaml
description: A relentless interview to sharpen a plan or design.
```

Rules:

- **Front-load the leading word.** The capability comes first, not the provenance.
- **One trigger per branch.** Synonyms that rename a single branch are one branch written twice.
- **Cut identity the body already carries.** Provenance ("distilled from a 40-axis research
  program"), disambiguation from sibling skills, and mechanism all belong in the body.
- **Under 60 words.** Over that, it is a summary. Spend the extra words on the situations where
  the skill was measured to miss, such as a sub-agent brief that never names it.

## Invocation is the organizing axis

Every skill is user-invoked or model-invoked. The test for model-invoked: *could the model
usefully reach for this on its own?* Reuse is a reason to extract a skill, not the test.

**A user-invoked skill may call model-invoked skills, never another user-invoked one.**

Thin user-invoked wrappers over thick model-invoked primitives are the intended shape.

## Body

- No H1 repeating the name, no preamble, no "When to use" section. The description owns that.
- Numbered steps with a **bold lead-in**, for procedures.
- Every step needs a checkable bound, or the agent stops early and calls it done.
  A bound has two levers, clarity and demand. "Every modified model accounted for" demands more
  legwork than "produce a change list", though both are clear. Sharpen the bound first, since that
  is local and cheap. Split the work across a context boundary only when the bound is irreducibly
  fuzzy and the rush to finish persists.
- Express a dependency as "Call the Skill tool with `<name>`", one skill per call; a step needing
  two skills is two calls. When the target is user-invoked, write "tell the user to run
  `/<name>`" instead. Never deep-link `../other-skill/FILE.md`.

## Write harness-neutral

The same file is read by Claude Code and Codex. Never name a harness-specific artifact. The one
exception is the Skill tool: naming it is what makes a cross-skill call fire, and a harness with no
Skill tool reads the named skill's SKILL.md instead.

| Instead of | Write |
|---|---|
| `CLAUDE.md` / `AGENTS.md` | the project's agent context file |
| "the Agent tool in a single message" | dispatch parallel subagents in one batch |
| `web_search` / `web_fetch` | your web search / fetch tool |
| `~/.claude/…/memory/` | your memory store (the `learn` skill resolves the path per harness) |

Harness-specific presentation goes in a sidecar: `<skill>/agents/openai.yaml`.

## Four things to avoid

- **Negation.** Prohibition drags the forbidden behavior into context and makes it *more*
  available. Prompt the positive target. A bare "don't" earns its place only as a hard guardrail
  that cannot be phrased positively, and even then, pair it with the positive.
- **No-ops.** An instruction the model already follows by default pays load to say nothing.
  The test is behavioral, not aesthetic. Does it change the output versus the default? When a
  sentence fails, delete the sentence, do not trim words from it.
- **Duplication.** The same meaning in two places costs maintenance and inflates that meaning's
  apparent rank.
- **Caching the environment.** A document restating what one command or one file already reports
  is a cache, and it goes stale. Record what the agent cannot find by looking: the unwritten
  convention, the reason behind a choice, the gotcha no config confesses.

## Reuse the load-bearing tokens

Cohesion across skills comes from reusing a handful of tokens verbatim (mirror oracle, blast
radius, red-first, vertical slice, certainty ladder). Repeat the token, never re-spell the meaning.
This reconciles with the no-duplication rule above. Duplicating a definition inflates its rank,
whereas reusing a token keeps one definition and many pointers to it.

## Progressive disclosure

Three rungs: in-file step → in-file reference section → separate file behind a pointer.
Branching is the test. Inline what every run needs; push behind a pointer what only some
runs reach. A skill over ~120 lines is usually one that skipped this.

Bulk reference material is not a skill. It goes in `knowledge/<domain>/` with an `INDEX.md`,
reached by a router skill that owns the domain.

## Change a skill only for an observed failure

A new skill, a rewritten description, or a new step needs a failure seen in a real session: a
missed or false trigger in the history, a review comment, a wrong result. A hypothetical
improvement is not enough. Name the session or the measurement in the commit message.

## Retiring a skill

Delete it. Git is the archive, and the commit message names whatever replaced it.
There is no `deprecated/` bucket.
