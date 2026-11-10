---
name: browser
description: Drive a real browser. Use when a task needs UI or interaction QA, a JS-rendered page, an E2E or login flow, a browser-only bug, or an internal site behind SSO that a plain fetch cannot reach.
---

`route surface → open → snapshot → act → wait → screenshot/extract → close`

## Surface routing

When T3 collaborative preview tools are available:

1. call `preview_status`;
2. call `preview_open` if no automation-capable tab is attached;
3. use `preview_navigate`, `preview_snapshot`, semantic locators, focused interaction tools, and
   `preview_wait_for`;
4. use `preview_resize`, appearance emulation, screenshots, and recording when the task needs them.

Prefer T3 because the browser is bound to the current thread and Pranav can watch or take over in
the same application. A failed first call is not a reason to switch tools when the error is
actionable.

Use cmux browser when the browser must remain beside persistent terminals, devices, or several
agent sessions, or when the run must survive the current T3 thread.

Use **`agent-browser`** when T3 preview tools are absent or explicitly unavailable, the user asks
for it, or an existing authenticated Chrome/CDP workflow requires it. It returns accessibility-tree
snapshots with compact `@eN` refs and persists across commands.

### Authenticated internal sites (SSO)

Default to a **seeded agent-owned Chrome**. It completes SSO silently, needs nobody at the
keyboard, and leaves Pranav's own tabs alone:

```bash
python3 <your-state-builder>.py > /tmp/sso-state.json
agent-browser --state /tmp/sso-state.json \
  --executable-path "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  open https://intranet.example.com/
```

Real Chrome via `--executable-path` is required on a managed device; bundled Chromium can fail
`net::ERR_INVALID_AUTH_CREDENTIALS`. Covers SSO-gated sites, not tools with their own auth.
Pranav's only job is refreshing his SSO session once a day; never ask him for more.

Attach to his live Chrome with `agent-browser connect <port>` **only** when the task needs *his*
tabs (an app already in a given state, a session only he can create) or when the seeded path
fails. It costs him a short, flaky approval prompt.

Full mechanism, findings and troubleshooting: `REFERENCE.md`.

All browser tools are on demand. Close agent-created sessions when the selected surface supports
closing them. Leave user-owned authenticated sessions open unless the user asks otherwise.

If the fallback is required and `agent-browser` is not installed:

```bash
npm i -g agent-browser
agent-browser install
```

## Agent-browser fallback reference

When using the fallback, load its version-matched command reference rather than guessing flags:

```bash
agent-browser skills get core --full    # full command reference + templates, read before driving
agent-browser skills list               # specialized: electron, slack, dogfood, agentcore, vercel-sandbox
agent-browser skills get dogfood        # systematic web-app exploration / bug hunting
agent-browser skills get electron       # VS Code, Slack, Discord, Figma desktop apps
```

## The core loop

For T3, use the equivalent `preview_*` operations and snapshot-provided locators.

For `agent-browser`:

```bash
agent-browser open <url>        # navigate
agent-browser snapshot -i       # interactive elements only → gives @e1, @e2... refs
agent-browser click @e3         # act on a ref from the snapshot
agent-browser snapshot -i       # RE-SNAPSHOT after any page change, refs go stale
```

- **Refs are reassigned every snapshot** and go stale the instant the page changes (navigation, submit, dynamic re-render, dialog). Re-snapshot before the next ref interaction.
- Act without a snapshot: `find role button click --name "Submit"`, `find text "Sign In" click`, `find label "Email" fill "..."`.
- Extract: `get text @e1`, `get value @e1`, `get attr @e1 href`, `get url`, `get count ".item"`.
- Close sessions the agent created. Leave a user-owned authenticated browser attached and open
  unless the user explicitly asks to close it.

## Waiting (the #1 source of flakiness)

After any page-changing action, wait for the *specific* thing you expect:

```bash
agent-browser wait @e1                  # element appears
agent-browser wait --text "Success"     # text appears
agent-browser wait --url "**/dashboard" # URL matches (glob)
agent-browser wait --load networkidle   # SPA navigation settled
agent-browser wait --fn "window.app.ready === true"
```

A fixed sleep (`wait 2000`) is a debugging aid only. It is slow and it flakes.

## Screenshots

```bash
agent-browser screenshot               # temp path (printed)
agent-browser screenshot page.png      # specific path
agent-browser screenshot --full f.png  # full scroll height
agent-browser screenshot --annotate a.png  # numbered labels matching @eN refs
```

## When this is the right tool

- **After a UI/page change.** Open it and `screenshot` or assert it renders. Look before claiming a UI works.
- **Scraping/interacting with a JS-rendered page** a plain web fetch can't see (it doesn't run JS).
- **A bug that only reproduces in-browser.** The browser variant of the `investigate` feedback loop. Build a fast deterministic open→act→assert sequence and iterate.
- **E2E / form / auth flows.** Multi-step: log in, navigate, verify.
- **Systematic exploration.** Load the `dogfood` skill for structured bug/UX hunting.

## Branch-specific recipes → `REFERENCE.md`

Read it when the run needs one of these, rather than up front:

| Read `REFERENCE.md` for | When |
|---|---|
| Seeded agent-owned Chrome for SSO-gated sites | The task needs Pranav's authenticated internal session (this is the default path) |
| Attaching to his **live** Chrome | The seeded path failed, or the task needs his actual open tabs |
| Headed mode and handing a step to the user | The user must click through login or a security key |
| Network inspection, HAR, request mocking | Asserting on or faking traffic |
| `eval`, tabs, iframes, parallel sessions, saved state | The flow reaches past a single page in a single tab |
| Full locator list and troubleshooting | A click/fill isn't taking, or a ref won't resolve |

For changed user interfaces, read [VISUAL-QA.md](VISUAL-QA.md). It defines viewport, state,
animation, accessibility, console/network, screenshot, and mobile-device evidence without adding a
separate visual-QA skill.

## Constraints

- Prefer T3 preview when it is available and automation-capable.
- Do not switch from T3 merely because the preview is initially closed; call `preview_open`.
- On-demand only. Close agent-created browser sessions and dev servers when done; leave attached
  user-owned browser processes untouched.
- Wait on a concrete condition; re-snapshot after every page change. Stale refs are the most common failure.
- Read `agent-browser skills get core --full` for anything beyond the above; it carries the current flags.
