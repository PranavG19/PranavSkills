---
name: browser
description: Drive and inspect a real browser. Use when a UI needs visual or interaction QA, a JS-rendered page needs scraping, an E2E/login flow needs running, or a bug reproduces only in a browser.
---

`open → snapshot -i → act on @refs → wait → screenshot/extract → close`

Drive a browser through **`agent-browser`**, a CLI built for AI agents (Chrome via CDP, no Playwright/Puppeteer). It returns accessibility-tree snapshots with compact `@eN` refs (~200-400 tokens) instead of raw HTML, and persists across commands so a sequence feels like one session. On demand only; nothing runs in the background between tasks.

If `agent-browser` isn't installed: `npm i -g agent-browser && agent-browser install`.

## Load the canonical skill first

`agent-browser` ships version-matched skills, **the source of truth for commands**, tracking the CLI as it changes. Read them rather than guessing flags:

```bash
agent-browser skills get core --full    # full command reference + templates, read before driving
agent-browser skills list               # specialized: electron, slack, dogfood, agentcore, vercel-sandbox
agent-browser skills get dogfood        # systematic web-app exploration / bug hunting
agent-browser skills get electron       # VS Code, Slack, Discord, Figma desktop apps
```

## The core loop

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
| Attaching to an existing **authenticated** Chrome | The task needs the user's logged-in session (SSO or another logged-in app); a fresh spawn has no cookies and lands on a login page |
| Headed mode and handing a step to the user | The user must click through login or a security key |
| Network inspection, HAR, request mocking | Asserting on or faking traffic |
| `eval`, tabs, iframes, parallel sessions, saved state | The flow reaches past a single page in a single tab |
| Full locator list and troubleshooting | A click/fill isn't taking, or a ref won't resolve |

For changed user interfaces, read [VISUAL-QA.md](VISUAL-QA.md). It defines viewport, state,
animation, accessibility, console/network, screenshot, and mobile-device evidence without adding a
separate visual-QA skill.

## Constraints

- On-demand only. Close agent-created browser sessions and dev servers when done; leave attached
  user-owned browser processes untouched.
- Wait on a concrete condition; re-snapshot after every page change. Stale refs are the most common failure.
- Read `agent-browser skills get core --full` for anything beyond the above; it carries the current flags.
