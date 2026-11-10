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

## External socket recovery

If `identify` returns `auth_required`, inspect the active automation config. Password mode with an
empty or absent `socketPassword` cannot authenticate any caller. For user-authorized local
automation from outside cmux, use a recoverable config edit:

1. Back up `~/.config/cmux/cmux.json`.
2. Set `automation.socketControlMode` to `"allowAll"`.
3. Remove `automation.socketPassword`.
4. Run `cmux config doctor` and `cmux reload-config`.
5. Retry `cmux identify`.

Do not search histories or transcripts for an old credential. Do not describe the generated socket
credential as a password the user should know. If the configured mode is `cmuxOnly`, external
denial may be intentional; change it only when the user authorized external cmux control.

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

Prefer the T3 collaborative preview when it is available for the current thread and the browser
does not need persistent co-location with cmux terminals, devices, or agent sessions.

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
screenshots, console/errors, cookies/storage, tabs, state, and design mode. Use cmux browser when
the visible surface must persist with the workspace or when T3 preview is unavailable.

## Simulator

Prefer T3 Device panel for thread-local iOS or Android QA when `device_list` and `device_open` are
available and agent device access is enabled. Use cmux simulator surfaces for persistent
cross-workspace supervision or when T3 device access is disabled.

Create or identify a simulator surface with `new-pane --type simulator` or
`new-surface --type simulator`. Then inspect the installed subcommands with:

```bash
cmux simulator help
cmux ios help
```

Socket-backed help may require execution inside cmux. Capture screenshots or recordings into the
project's evidence directory, exercise rotation and appearance where relevant, and keep the
surface ref in the ticket.
