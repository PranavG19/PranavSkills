# Pranav Skills

A small, opinionated toolkit for building software with coding agents.

I like to build complex things as simply as possible. This repository turns that preference into a
repeatable workflow: understand the problem, make decisions explicit, split work into verifiable
vertical slices, implement test-first, review from a fresh context, and keep a human responsible
for taste and irreversible decisions.

One source tree renders the same skills and working agreement into **Claude Code**, **Codex**, and
**Kiro**. The skills are harness-neutral; the profiles handle installation details.

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
grilling -> spec -> to-tickets -> implement + tdd -> verify -> code-review -> human QA
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
| Quality | [`code-review`](skills/core/code-review/SKILL.md) | Review a completed ticket from a fresh context against both its spec and repository standards. |
| Architecture | [`agent-arch`](skills/core/agent-arch/SKILL.md) | Design agent-legible codebases, context files, hooks, permissions, and verification gates. |
| Memory | [`learn`](skills/core/learn/SKILL.md) | Promote a surprising, corroborated lesson to its durable owner. |
| Git | [`commit`](skills/core/commit/SKILL.md) | Create a scoped local commit after verification; pushing remains a human action. |

## Common Flows

| Situation | Suggested path |
|---|---|
| Small, clear change | `triage -> implement -> verify` |
| Unknown bug | `investigate -> tdd -> verify -> code-review` |
| New feature | `grilling -> spec -> to-tickets -> orchestrate` |
| Greenfield project | `grilling -> spec -> agent-arch -> to-tickets -> orchestrate` |
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

## Install

Requirements: Git and Node.js.

```bash
git clone https://github.com/PranavG19/PranavSkills.git
cd PranavSkills

# Inspect what each harness targets before changing your home directory.
cat profiles/claude-code.json
cat profiles/codex.json
cat profiles/kiro.json

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
```

### Before rendering

The renderer refuses to replace real skill directories and only retracts symlinks it owns.
However, it **generates the target context file**:

- `~/.claude/CLAUDE.md`
- `~/.codex/AGENTS.md`
- `~/.kiro/AGENTS.md`

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
