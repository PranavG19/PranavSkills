# Pranav Skills

A small, opinionated toolkit for building software with coding agents.

I like to build complex things as simply as possible. This repository turns that preference into a
repeatable workflow: understand the problem, make decisions explicit, split work into verifiable
vertical slices, implement test-first, review from a fresh context, and keep a human responsible
for taste and irreversible decisions.

One source tree renders the same skills and working agreement into **Claude Code**, **Codex**,
**Kiro**, and **pi**. The skills are harness-neutral; the profiles handle installation details.

New here? Open [`docs/overview.html`](docs/overview.html) for a self-contained walkthrough of what
this toolkit is, how it works, and how to use it.

## Philosophy

The model matters less than the environment around it. Good results come from a clear task,
legible code, short feedback loops, independent review, and controls the agent cannot silently
rewrite.

- **Process before prompting.** Resolve ambiguity before implementation.
- **One vertical slice at a time.** Keep each ticket inside one useful context window.
- **Tests are the control loop.** Establish red, implement to green, then refactor.
- **Verification must be independent.** A signal authored by the implementer is not enough for a
  consequential correctness claim.
- **Fresh context for review.** The author should not approve its own assumptions.
- **Human QA still matters.** Agents can check behavior; people decide whether the result has
  taste, clarity, and the right tradeoffs.
- **Small skills beat a giant prompt.** Load procedures only when their trigger fires.
- **Mechanical guardrails beat prose.** Prefer branch protection, permissions, CI, and tested
  hooks over another paragraph saying "be careful."

This is inspired by [Matt Pocock's process-first skills](https://github.com/mattpocock/skills),
adapted for local tickets, multi-project supervision, risk-based verification, and shared use
across several agent harnesses.

## Core Workflow

```text
grilling -> spec -> to-tickets -> implement + tdd -> verify -> ticket-review -> human QA
```

For larger work, `orchestrate` moves one project through that sequence. For several projects,
`supervise` coordinates project orchestrators through `cmux` while each project keeps its own
tickets, worktrees, tests, and review boundary.

The local ticket system lives in `.agents/tickets/`. Tickets are dependency-aware vertical slices,
not a long plan that one session must remember.

## Skills

| Area | Skill | Use it when |
|---|---|---|
| Shape | [`triage`](skills/core/triage/SKILL.md) | Classify reversibility and blast radius before touching data, money, credentials, infrastructure, or contracts. |
| Shape | [`grilling`](skills/core/grilling/SKILL.md) | Interview through unresolved design forks, one question at a time. |
| Shape | [`critiquing`](skills/core/critiquing/SKILL.md) | Ideate, stress-test, or red-team a design, plan, spec, or consequential diff. |
| Shape | [`spec`](skills/core/spec/SKILL.md) | Record settled decisions in an implementation-ready design. |
| Shape | [`change-contract`](skills/core/change-contract/SKILL.md) | Freeze the success criterion, non-goals, and diff budget for a single scoped fix that ships on its own. |
| Plan | [`to-tickets`](skills/core/to-tickets/SKILL.md) | Turn a spec into dependency-aware, independently reviewable vertical slices. |
| Run | [`orchestrate`](skills/core/orchestrate/SKILL.md) | Move substantial work through shaping, tickets, implementation, review, and QA. |
| Run | [`supervise`](skills/core/supervise/SKILL.md) | Coordinate multiple project orchestrators without collapsing their boundaries. |
| Run | [`cmux`](skills/core/cmux/SKILL.md) | Launch, observe, and resume terminals, browsers, simulators, and agent sessions in cmux. |
| Isolate | [`worktree`](skills/core/worktree/SKILL.md) | Give risky, parallel, or unattended work an isolated Git checkout. |
| Build | [`implement`](skills/core/implement/SKILL.md) | Complete exactly one approved local ticket. |
| Build | [`tdd`](skills/core/tdd/SKILL.md) | Build one observable behavior through red-green-refactor. |
| Diagnose | [`investigate`](skills/core/investigate/SKILL.md) | Find the root cause of a non-obvious bug, failure, crash, or regression. |
| Research | [`web`](skills/core/web/SKILL.md) | Check current external documentation, releases, APIs, and error messages. |
| UI | [`browser`](skills/core/browser/SKILL.md) | Exercise a real interface and inspect interactions, screenshots, responsive states, console, and network behavior. |
| Quality | [`verify`](skills/core/verify/SKILL.md) | Select a risk-based test gauntlet and prove a claim with an independent signal. |
| Quality | [`ticket-review`](skills/core/ticket-review/SKILL.md) | Review a completed ticket from a fresh context against both its spec and repository standards. |
| Quality | [`diff-review`](skills/core/diff-review/SKILL.md) | Read-only blocker review of a change you do not own, with no local ticket, refuting the author's claims. |
| Explain | [`explainer`](skills/core/explainer/SKILL.md) | Build a single-file HTML report where figures and tables carry every fact and text is caption. |
| Explain | [`show-me`](skills/core/show-me/SKILL.md) | Explain with the smallest fitting visual (tree, diagram, shape-matched diff) instead of a wall of prose. |
| Architecture | [`agent-arch`](skills/core/agent-arch/SKILL.md) | Design agent-legible codebases, context files, hooks, permissions, and verification gates. |
| Incident | [`postmortem`](skills/core/postmortem/SKILL.md) | Draft a postmortem, RCA, or incident retro from a confirmed root cause. |
| Continuity | [`handoff`](skills/core/handoff/SKILL.md) | Write a resumable record when stopping mid-task, so the next session reads state instead of re-deriving it. |
| Continuity | [`resolving-merge-conflicts`](skills/core/resolving-merge-conflicts/SKILL.md) | Resolve a conflict by recovering each side's intent, not by stitching markers together. |
| Memory | [`learn`](skills/core/learn/SKILL.md) | Promote a surprising, corroborated lesson to its durable owner. |
| Git | [`commit`](skills/core/commit/SKILL.md) | Create a scoped local commit after verification; pushing remains a human action. |

## Common Flows

| Situation | Suggested path |
|---|---|
| Small, clear change | `triage -> implement -> verify` |
| Unknown bug | `investigate -> tdd -> verify -> ticket-review` |
| New feature | `grilling -> spec -> to-tickets -> orchestrate` |
| Greenfield project | `grilling -> spec -> agent-arch -> to-tickets -> orchestrate` |
| Scoped fix that ships on its own | `triage -> change-contract -> implement -> verify -> commit` |
| Reviewing someone else's change | `diff-review` (read-only, refute the claims, report blockers) |
| After an incident is understood | `investigate -> postmortem` |
| Stopping mid-task, or resuming | `handoff` (write on stop, read first on resume) |
| UI or mobile work | Add `browser` and the visual/device tier from `verify` |
| Several projects at once | `supervise -> cmux -> one orchestrate session per project` |

These are compositions, not mandatory ceremony. A typo does not need a spec; a data migration
does need more than a green unit test.

## How Rendering Works

`scripts/render.mjs` treats this repository as the canonical source. Skills and knowledge are
symlinked rather than copied, so edits are immediately visible in every rendered harness. Context
files are generated because each harness loads them differently.

| Profile | Target | Skills and knowledge | Generated context |
|---|---|---|---|
| Claude Code | `~/.claude` | Symlinks into `skills/` and `knowledge/` | `CLAUDE.md` imports this repository's `AGENTS.md` |
| Codex | `~/.codex` | Symlinks into `skills/` and `knowledge/` | `AGENTS.md` contains the rendered working agreement |
| Kiro | `~/.kiro` | Adds owned symlinks while preserving Kiro-managed real directories and external links | `AGENTS.md` contains the rendered working agreement |
| pi | `~/.pi/agent` | Adds owned symlinks alongside pi's own skill links; a name already taken (e.g. `cmux`) is skipped, never overwritten | `AGENTS.md` at `~/.pi/agent/AGENTS.md` contains the rendered working agreement |
| Claude personal | `~/.claude-personal` | Core skills and personal knowledge; skipped when the directory is absent | `CLAUDE.md` imports this repository's `AGENTS.md` |
| SDK workers | `~/.claude-brew` | Settings only (effort high); skipped when absent | None |

```text
PranavSkills/
├── AGENTS.md                 canonical working agreement
├── CONVENTIONS.md            skill-writing rules
├── knowledge/agent-arch/     JIT architecture and harness guidance
├── profiles/                 per-harness destinations and selections
├── scripts/
│   ├── doctor.mjs            validates skills and rendered links
│   └── render.mjs            installs the selected profile
└── skills/
    ├── _shared/              formats and spec templates
    └── core/                 harness-neutral skills
```

Adding or removing a skill requires another render. Editing an existing symlinked skill does not.

Profiles can also pin harness settings, and `doctor.mjs` fails if they drift:

- `optional: true` skips the profile on machines without that config directory.
- `settings` merges keys into a Claude `settings.json` one level deep (for example `effortLevel`).
- `disablePlugins` turns plugins off in Claude `settings.json` and in existing Codex
  `config.toml` sections, for plugins that add tokens to every session but see little use.

Skills no other skill calls (`show-me`, `handoff`, `postmortem`, `change-contract`) are
user-invoked in Claude Code to keep the listing small. Codex ignores that flag, so it still routes
to them; `supervise` is hidden from Codex through `agents/openai.yaml`.

## Knowledge Base

The `knowledge/` directory holds domain-specific knowledge bases that agents load on demand.
Each domain has its own directory with an `INDEX.md` manifest that lists every record and its
one-line description. The frontmatter `record-count` and per-section counts in `INDEX.md` must
match the files on disk; `assert-index-count.py` enforces this (see Verify below).

Domains (`agent-arch`, `business`, `sessions`, `ux`) follow the same INDEX.md convention.
Layered domains split records into `semantic/` (entity and reference pages), `procedural/`
(runbooks), `episodic/` (dated event records), and `flow/` (end-to-end sequences).

Records use Obsidian-style `[[wikilinks]]` for cross-references; `assert-wikilinks.py` checks that
every link resolves (see Verify below).

**How agents query it.** Entity questions go to the semantic layer by exact filename
(`knowledge/<domain>/semantic/<Name>.md`). How-do-I questions go to procedural first. Event
questions go to episodic, sorted by recency. Anything with a fast staleness class should be
re-verified live before it is relied on. Each domain's `INDEX.md` is the entry point.

The `memory/` directory holds lightweight preference files (e.g. `memory/preference/style.md`)
that are not part of the knowledge base but persist personal conventions.

## Install

Requirements: Git and Node.js.

```bash
git clone https://github.com/PranavG19/PranavSkills.git
cd PranavSkills

# Inspect what each harness targets before changing your home directory.
cat profiles/claude-code.json
cat profiles/codex.json
cat profiles/kiro.json
cat profiles/pi.json

# Preview, render all profiles, then validate the installation.
node scripts/render.mjs --dry-run
node scripts/render.mjs
node scripts/doctor.mjs
```

Render only one profile:

```bash
node scripts/render.mjs codex
node scripts/render.mjs claude-code
node scripts/render.mjs kiro
node scripts/render.mjs pi
```

### Before rendering

The renderer refuses to replace real skill directories and only retracts symlinks it owns.
However, it **generates the target context file**:

- `~/.claude/CLAUDE.md`
- `~/.codex/AGENTS.md`
- `~/.kiro/AGENTS.md`
- `~/.pi/agent/AGENTS.md`

Read `scripts/render.mjs`, back up any existing context file, and merge personal instructions into
this repository's `AGENTS.md` before rendering. Run `--dry-run` first.

The public profiles intentionally install no hooks. The
[`agent-arch` harness guide](knowledge/agent-arch/harness.md) explains how to design pre-action,
post-action, and optional stop hooks without treating them as a substitute for CI or server-side
protection.

## Customize

1. Edit `AGENTS.md` to match how you want an agent to work.
2. Edit or add skills under `skills/core/`.
3. Add reusable knowledge under a routed directory in `knowledge/`.
4. Change profile selections and targets in `profiles/`.
5. Run `node scripts/doctor.mjs`.
6. Re-render after changing skill membership, knowledge domains, profiles, or context.

Skill descriptions are triggers, not summaries. Keep procedures concise, keep detailed reference
material behind JIT links, and avoid naming one harness inside a shared skill. The full rules live
in [`CONVENTIONS.md`](CONVENTIONS.md).

## Verify

This repository has no unit test suite. The verification surface is: regeneration should be
idempotent, the two knowledge-base check scripts should pass, and the doctor should report no
problems in the skill definitions.

**Regeneration (idempotent).** Running `node scripts/render.mjs` a second time with no source
changes should produce no new writes. This confirms the generated context files and symlinks are
stable.

**`doctor.mjs` -- skill and harness lint.** Validates every skill's frontmatter against
`CONVENTIONS.md` (required keys, description word budget, no harness leakage), checks the
aggregate description budget across all model-invoked skills, and verifies that each rendered
harness's symlinks point back to this repository. Run it from the repo root:

```bash
node scripts/doctor.mjs
```

Exits 0 when no problems are found. Warnings (e.g. name collisions on a shared target) do not
fail the run; problems (missing frontmatter, broken symlinks, drifted copies) do.

**`assert-index-count.py` -- INDEX.md vs. disk.** Compares the record list in a domain's
`INDEX.md` against the actual files on disk. Catches phantom entries, missing entries, and a
stale frontmatter `record-count`. A domain argument is required for any domain other than the
default (`agent-arch`):

```bash
python3 scripts/assert-index-count.py agent-arch
python3 scripts/assert-index-count.py ux
```

Exits 0 on pass, 1 on any mismatch. Both enumerated sections (file-by-file comparison) and
count-declared sections (header count vs. disk count) are supported.

**`assert-wikilinks.py` -- wikilink integrity.** Scans every `[[wikilink]]` in a domain's
records and checks that each one resolves to an actual `.md` file using Obsidian's shortest-path
rules. Reports broken links (no target) and dangling-resolvable links (a name-variant file
exists but the link text does not match). Both count as failures. Same argument convention:

```bash
python3 scripts/assert-wikilinks.py agent-arch
python3 scripts/assert-wikilinks.py ux
```

Both check scripts accept a single positional argument (the domain name, bare, no flags).
Passing a flag like `--help` is rejected. Omitting the argument defaults to `agent-arch`. Run
without arguments to see the list of available domains.

## Safety

This public repository contains only generic skills and architecture knowledge. It deliberately
excludes machine archives, credentials, private sessions, organization-specific knowledge, and
work profiles.

The workflow also separates authority:

- implementation agents work in scoped branches or worktrees;
- reviewers use a fresh context;
- merge, deploy, and production capabilities belong to a supervisor, CI, or human;
- irreversible operations require explicit human ownership.

Local instructions and hooks improve behavior, but they are not security boundaries. Use
least-privileged credentials, sandboxes, branch protection, required CI, and protected deployment
environments for real enforcement.

## License

MIT. See [`LICENSE`](LICENSE).
