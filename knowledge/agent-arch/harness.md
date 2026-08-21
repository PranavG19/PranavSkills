# Agentic Coding Harness

A stack-neutral baseline for making coding agents effective without turning the project's context
file into an encyclopedia. The exact commands vary by repository; the control objectives do not.

## 1. Start with the enforcement ladder

Put each rule at the strongest layer that can enforce it:

1. **Server-side physics**: branch protection, required CI, merge queue, protected environments,
   CODEOWNERS, immutable audit, least-privileged credentials.
2. **Sandbox and permissions**: filesystem roots, network policy, scoped command allowlists,
   read-only production identities.
3. **Hooks**: fast local blocks for destructive commands, secret writes, and obvious scope drift.
4. **Repository automation**: typecheck, tests, contract checks, migration checks, visual tests.
5. **Agent context**: judgment, routing, project-specific commands, and facts that cannot be
   discovered reliably.

If a hook or paragraph is the only thing protecting production, the boundary is misplaced. Hooks
are local walls, not sovereign controls: agents can crash, hooks can be unwired, and another client
can bypass them.

## 2. Keep one canonical context

Use one canonical project context file and render or import it into each harness. A useful file is
short enough to reread every session and contains only:

- what the repository is and where its real boundaries are;
- the exact build, test, lint, typecheck, and local-run commands;
- project-specific constraints that prevent a known error class;
- routes to skills and JIT documents;
- the definition of done and the required reporting shape.

Keep architecture explanations, API catalogs, runbooks, and framework tutorials in linked JIT
documents. Do not cache facts the agent can obtain from package manifests, source, generated
graphs, or `--help`.

Recommended layering:

| Layer | Typical budget | Content |
|---|---:|---|
| Personal/global context | 500-1,000 tokens | Stable working agreement and irreversible-action policy |
| Project context | 500-1,500 tokens | Identity, commands, boundaries, routing, done criteria |
| Directory context | Under 500 tokens | Rules unique to that subtree |
| Skills and docs | Loaded on demand | Procedures and domain knowledge |
| Task prompt/ticket | One vertical slice | Outcome, acceptance criteria, exclusions, exact verification |

For harnesses with different filenames, keep a canonical `AGENTS.md` and import it where imports
exist; otherwise generate the harness file from that source. Generated context must identify its
source and must never be edited directly.

### Minimal project context template

```markdown
# Working agreement

<One paragraph: what this repository does and its main module boundaries.>

## Commands
- Install: `<command>`
- Fast check: `<command>`
- Unit tests: `<command>`
- Full verification: `<command>`
- Run locally: `<command>`

## Boundaries
- <A project-specific invariant and where it is enforced.>
- <An irreversible or production action that requires a human-owned capability.>

## Routing
- Use `<skill or doc>` when <specific trigger>.
- Read `<path>` before changing <specific subsystem>.

## Done
- Acceptance criteria are demonstrated.
- Relevant verification ran with its real exit code.
- Generated artifacts changed at their source.
- Report changed files, skipped checks, and remaining concerns.
```

Delete any line that merely restates generic model behavior. Add a rule only after naming the
failure it prevents.

## 3. Install the minimum hook set

Use binary outcomes: allow or block with a safe next action. Warning-only hooks train the agent to
ignore warnings. Every hook must be executable, bounded, tested with allow and deny fixtures, and
fail closed when its parser fails.

### Pre-action guard: baseline

Block agent execution of:

- remote writes such as `git push`; give a supervisor or human a separate capability if required;
- force push, hard reset, forced clean, broad restore/checkout, and forced branch deletion;
- recursive forced deletion outside an agent-owned scratch directory;
- staging or writing secret-bearing files and private keys;
- production mutation commands without a separately issued, action-scoped capability;
- edits to the hook, permission, or CI policy files by a task that the same controls govern.

Parse structured tool input, then tokenize or parse the command. Regex over the entire command
string false-positives on quoted documentation and heredocs. Test command prefixes, `git -C`,
combined short flags, quoted pathspecs, shell separators, and absolute executable paths.

Return three things on a block: the operation detected, why it is unsafe, and the allowed next
action. Do not suggest bypass syntax.

### Post-action observer: baseline

After file-changing tools:

- report changed-file count and paths;
- block the next completion boundary if secret-shaped paths or out-of-scope roots changed;
- flag an unexpectedly large diff against a repository-specific threshold;
- preserve command exit codes and evidence paths.

Observation does not replace a pre-action block for irreversible commands. Its value is catching
the whole outcome class when a command matcher misses a spelling.

### Stop hook: optional

Do not run the full test suite blindly whenever an agent tries to stop. This causes loops, hides
which checks matter, and is easy to disable when slow.

Use a stop hook only when the repository has a cheap, deterministic completion contract. A sound
stop hook:

- completes in under 10 seconds;
- checks a durable verification receipt tied to the current diff or commit;
- blocks once with the missing command/evidence, then avoids recursive stop loops;
- never claims correctness from agent-authored prose;
- leaves CI and branch protection as the authoritative merge gate.

Without a trustworthy receipt mechanism, omit the stop hook and require verification in the
ticket plus CI.

## 4. Scope permissions by effect

Start from the capabilities a task needs, not a broad tool allowlist:

- repository read/write only, with separate agent-owned scratch space;
- network denied by default, then allow package registries and required documentation hosts;
- credentials absent by default; prefer short-lived, read-only identities;
- no wildcard permission that overlaps a hook's blocked class;
- production writes unavailable to implementation agents;
- merge/deploy capability held by a separate supervisor or CI identity.

Worktrees isolate Git state, not credentials, processes, ports, caches, or the host filesystem.
Give parallel agents unique ports, databases, temporary directories, and test namespaces.

## 5. Build a risk-based verification ladder

Discover the repository's real commands from manifests and CI, then record stable entry points in
the project context file. Do not prescribe a language-specific command globally.

| Change | Minimum evidence |
|---|---|
| Docs/config-only | Parser/schema check plus diff inspection |
| Pure logic | Type/static check, red-first unit test, mutation or property check where critical |
| Module boundary | Unit plus integration/contract test |
| Data/schema | Migration lint, populated-data rehearsal, rollback/forward proof, human gate |
| API/event contract | Compatibility check against registered consumers |
| UI/mobile | Functional E2E, console/network clean, desktop/mobile screenshots, interaction and animation inspection |
| Concurrency/retry | Deterministic race/retry test plus jitter or fault injection |
| Performance-sensitive | Representative benchmark/load test with a stated baseline and threshold |
| Auth/tenancy/money | Negative-path tests plus an independent oracle outside the changed module |

Run the cheapest discriminating checks in the inner loop. Run expensive load, mutation, device,
and broad integration suites when the risk class earns them, often asynchronously before merge.
A universal maximal gauntlet increases latency until people bypass it.

## 6. Separate author, reviewer, and integrator

For substantial work:

1. Shape one vertical slice with explicit acceptance criteria and exclusions.
2. Implement it in an isolated branch or worktree.
3. Verify through the risk-appropriate ladder.
4. Review in a fresh context against both the spec and repository standards.
5. Integrate through CI and branch protection with a separate identity.
6. Perform human QA for taste, ambiguity, and irreversible decisions.

Parallelize only tickets with independent write sets and explicit dependencies. The supervisor
owns scheduling, readiness handshakes, merge order, and failed-integration recovery; workers do not
merge themselves.

## 7. Audit the setup

Before calling a harness ready, prove:

- every rendered skill and context file points to its canonical source;
- hook wiring exists in the active profile and each hook is executable;
- allow/deny hook fixtures pass, including parser failures and bypass-shaped variants;
- the agent cannot push, mutate production, or edit its own enforcement boundary;
- the fast check finishes inside its latency budget;
- required CI cannot be changed in the same feature change without owner review;
- a synthetic bad change is rejected by each critical gate;
- browser/device tooling can capture inspectable evidence when the product has a UI;
- a fresh session can locate the correct command and module from the context router alone.

Re-run the audit after harness upgrades. Hook schemas and config filenames are adapters that may
change; the enforcement ladder and control objectives are the stable design.

## Antipatterns

- A generated repository encyclopedia loaded into every session.
- The same instruction copied into personal, project, and directory context.
- A stop hook used as the primary safety or correctness boundary.
- Hooks that warn but permit, silently fail open, or match prose as executable commands.
- Broad shell/network permissions justified by a long denylist.
- An implementation agent holding merge, deploy, and production-write credentials.
- Running every expensive test for every edit instead of selecting by risk.
- Letting the author review and approve its own work in the same context.
