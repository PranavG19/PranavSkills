---
name: cmux
description: Control cmux workspaces, terminals, browsers, simulators, and agent sessions. Use when work must be launched, observed, or resumed in cmux, especially across visible long-running sessions.
---

`identify -> address stable ref -> act -> observe exact target -> record ref`

## T3 routing boundary

Use T3 collaborative preview and T3 Device panel for one thread's browser or native QA when their
tools are available and authorized. Use cmux when work needs persistent cross-thread terminals,
several visible agents, long-running logs, remote sessions, resource supervision, or a fallback
after T3 reports device access unavailable.

Do not create duplicate browser or simulator surfaces in both products without a named evidence or
supervision reason.

Use the installed CLI, preferring `cmux` on `PATH` and falling back to:

```bash
/Applications/cmux.app/Contents/Resources/bin/cmux
```

1. **Confirm access.** Run `cmux identify` or `cmux tree`. If the socket returns
   `auth_required`, inspect `~/.config/cmux/cmux.json` before asking the user for anything:
   - `socketControlMode: "password"` with no non-empty `socketPassword` is an inconsistent local
     configuration, not evidence that the user has or knows a password.
   - When the user has authorized this external process to control their local cmux, back up the
     config, set `automation.socketControlMode` to `"allowAll"`, remove `socketPassword`, run
     `cmux config doctor`, then `cmux reload-config` and retry `identify`.
   - Never recover or print an old socket credential from shell history, agent transcripts, or
     backups. A cmux socket credential is not an account password.
   A process launched outside cmux can otherwise be intentionally denied by `cmuxOnly`; report
   that boundary when external control was not authorized.
2. **Discover targets.** Use `tree`, `list-workspaces`, `list-panes`, or
   `list-pane-surfaces`. Capture the returned workspace and surface refs.
3. **Address explicitly.** Pass `--workspace` and `--surface` for cross-project actions. Use
   `CMUX_WORKSPACE_ID` and `CMUX_SURFACE_ID` only for the caller's own workspace.
4. **Act.** Create workspaces/surfaces, send input, open a browser or simulator, or update status.
   Before sending terminal input, use `read-screen` to confirm the surface is idle at the expected
   agent prompt and belongs to the expected project. Then `send` the text and `send-key ... enter`
   separately when submission is intended.
5. **Observe.** Use `read-screen`, `surface-health`, browser snapshots/screenshots, simulator
   capture, events, or notifications. A successful send proves delivery, not task completion.
6. **Return stable refs and evidence.** Report what was targeted, the observed state, and any
   surface left open for human takeover.

Read [commands.md](references/commands.md) for command families and embedded browser/simulator
routing. For the installed version, `cmux --help` and `cmux docs <topic>` are authoritative.

## Constraints

- Target refs, never current focus, for automation across workspaces.
- Read from the exact surface that received the command.
- Use bounded waits or event cursors; endless polling is not supervision.
- Keep browser/device evidence with the project ticket, not only in terminal scrollback.
- `cmux` operates surfaces. For multi-project scheduling and policy, tell the user to run `/supervise`.
