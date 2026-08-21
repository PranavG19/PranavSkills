# cmux Command Map

The installed CLI is authoritative: run `cmux --help`, `cmux capabilities`, or
`cmux docs <settings|api|browser|agents|sidebars>`.

## Addressing and inspection

```bash
cmux identify
cmux tree --all
cmux list-workspaces
cmux list-panes --workspace <ref>
cmux list-pane-surfaces --workspace <ref> --pane <ref>
cmux read-screen --workspace <ref> --surface <ref> --lines 120
cmux surface-health --workspace <ref>
```

Targets accept UUIDs or short refs such as `workspace:2`, `pane:3`, and `surface:4`. Capture refs
from command output; indexes can change as the UI is rearranged.

## Create and communicate

```bash
cmux new-workspace --name <project> --cwd <path> --command <command> --focus false
cmux new-surface --type agent-session --workspace <ref> --provider <claude|codex> --focus false
cmux new-pane --type <terminal|browser|simulator> --workspace <ref> --direction right
cmux send --workspace <ref> --surface <ref> '<text>'
cmux send-key --workspace <ref> --surface <ref> enter
```

Use `set-status`, `set-progress`, `todo`, `log`, and `notify` for compact human-visible state.
Use `events --cursor-file <path>` or notifications for transitions; inspect `read-screen` when a
transition is ambiguous.

## Embedded browser

Use `cmux browser --help` for the current command set. The normal loop is:

```bash
cmux browser open <url>
cmux browser snapshot -i
cmux browser click '<selector>' --snapshot-after
cmux browser wait --text '<expected>' --timeout-ms 10000
cmux browser screenshot --out <path> --json
cmux browser console list
cmux browser errors list
```

The embedded browser supports navigation, DOM snapshots, selectors, JavaScript evaluation,
screenshots, console/errors, cookies/storage, tabs, state, and design mode. Use the standalone
`browser` skill when it provides the stronger existing interaction path; use cmux browser when
the visible surface and human takeover are part of the workflow.

## Simulator

Create or identify a simulator surface with `new-pane --type simulator` or
`new-surface --type simulator`. Then inspect the installed subcommands with:

```bash
cmux simulator help
cmux ios help
```

Socket-backed help may require execution inside cmux. Capture screenshots or recordings into the
project's evidence directory, exercise rotation and appearance where relevant, and keep the
surface ref in the ticket.
