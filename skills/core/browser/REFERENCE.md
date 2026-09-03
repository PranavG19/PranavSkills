# browser, long-tail reference

Read the section for the branch you're on; `SKILL.md` carries everything every run needs.

## Attaching to the user's EXISTING authenticated Chrome

When the task needs the user's *authenticated* session (SSO or another logged-in app), attach to their
running Chrome instead of letting `agent-browser` spawn its own; a fresh spawn has no cookies and lands
on a login page. The rules, each learned the hard way:

1. **`agent-browser connect <port>` is the reliable attach.** `--cdp <port>` as a per-command flag is
   not. Subcommands like `tab new` ignored `--cdp 9333` and auto-launched on 9222 instead
   ("Auto-launch failed: All CDP discovery methods failed for 127.0.0.1:9222"). Run `connect <port>`
   ONCE; afterwards plain `agent-browser tab/eval/open/...` (no `--cdp`) target that connection.
   When your harness runs shell commands through a PTY, run `connect <port>` with the PTY disabled
   (e.g. `tty: false`). A PTY can stay attached after Chrome approval, leaving the command apparently
   stuck even though the user accepted the prompt; plain-pipe execution returns normally and preserves
   the foreground workflow.
2. **`curl http://127.0.0.1:<port>/json/version` returning HTTP 404 or empty ≠ dead port.** Chrome
   deliberately DISABLES the DevTools `/json` HTTP endpoint when `--remote-debugging-port` points at the
   DEFAULT/real user-data-dir (security guard). The socket still LISTENs but serves 404. curl probes
   will mislead you into thinking the wrong port is live. Trust `agent-browser connect <port>` +
   `agent-browser tab` over curl. Also, Chrome may bind CDP to `::1`/`localhost`, not `127.0.0.1`.
3. **The port the user *thinks* they're on is a guess.** Verify by listing tabs after connect: the
   user's real browser shows their actual tabs (the corp intranet, a doc tool, the target app); a
   spawned/phantom instance shows one blank or login tab. Observed once. 9222 had a listener that 404'd
   while the real authenticated Chrome answered on a different port, and a totally different browser
   (Arc) was on 9333. Identify the right instance by its TAB LIST, not the port.
4. **To get a debuggable authenticated Chrome from scratch:** the user launches normal Chrome (default
   profile, their cookies) and enables debugging, OR you launch with BOTH `--remote-debugging-port` AND
   a **dedicated** `--user-data-dir` (e.g. `~/.chrome-agent-debug`). The dedicated dir is what makes
   `/json` actually respond, but it starts cookie-less, so the user does SSO once inside it. You cannot
   complete a security-key auth; hand off that ONE step and poll for the post-login URL.
5. **Expired-session tells:** landing on an SSO login page = expired cookie (needs a fresh key tap); an
   `.../SSO/redirect` that never advances = the same thing, silent SSO can't complete. Only the user
   clears it.

### Chrome's short and flaky connection-approval prompt

On some managed Chrome builds, `agent-browser connect <port>` triggers a user-visible approval prompt
that stays clickable for only a couple of seconds. Chrome may ignore a correctly accepted prompt, and
the user may need to be asked for the exact same command several times. In that case:

1. Re-run the exact same `agent-browser connect <port>` command. A timed-out prompt is a reason to
   retry it verbatim, not to switch to speculative diagnostics or another connection method.
2. Keep exactly one connection attempt alive. The harness may return a session ID after its foreground
   wait expires even though the command wasn't launched with `&`; that process is still running. Poll
   that same session, and send `Ctrl-C` before starting another attempt.
3. One `connect` at a time. Stacked stale attempts can release together when a turn is stopped, firing
   many Chrome approval prompts at once.
4. Verify acceptance with a finite command, `agent-browser tab`, and confirm the actual authenticated
   tabs. `agent-browser --auto-connect tab` can falsely succeed against a blank agent-owned browser
   holding only `about:blank`; that is not proof the user's Chrome attached.

## Headed mode (user can see/interact)

```bash
agent-browser open <url> --headed          # visible Chrome window
agent-browser open <url> --headed --profile default  # reuse existing Chrome profile (login state)
```

Use `--headed` when the user needs to interact (login, SSO, a manual step). The session stays open and
you can keep running commands against it.

## Network inspection

```bash
agent-browser network requests                     # list all fired requests
agent-browser network har start                    # begin recording traffic
agent-browser network har stop /tmp/trace.har      # save HAR
agent-browser network route "**/api/*" --body '{}' # mock responses
agent-browser network route "**/analytics" --abort # block requests
```

## JavaScript evaluation

```bash
agent-browser eval "document.title"                         # simple expression
cat <<'EOF' | agent-browser eval --stdin                    # complex script
const els = document.querySelectorAll('[data-e2e-id]');
Array.from(els).map(e => ({id: e.dataset.e2eId, text: e.textContent.trim()}));
EOF
```

## Tabs

```bash
agent-browser tab                      # list open tabs
agent-browser tab new <url>            # open new tab
agent-browser tab 2                    # switch to tab 2
agent-browser tab close 2              # close tab 2
```

## Session persistence

```bash
agent-browser state save ./auth.json          # save cookies + localStorage
agent-browser --state ./auth.json open <url>  # restore on next run
AGENT_BROWSER_SESSION_NAME=myapp agent-browser open <url>  # auto-save/restore
```

## Parallel sessions

```bash
agent-browser --session a open <url>   # isolated browser A
agent-browser --session b open <url>   # isolated browser B
```

## Locators (no snapshot needed)

```bash
agent-browser find role button click --name "Submit"
agent-browser find text "Sign In" click
agent-browser find label "Email" fill "user@test.com"
agent-browser find testid "my-button" click
agent-browser find placeholder "Search" type "query"
agent-browser click "#submit"          # raw CSS selector, last resort
```

## Iframes

Iframes are auto-inlined in snapshots. To scope explicitly:

```bash
agent-browser frame @e3      # switch to iframe
agent-browser snapshot -i
agent-browser frame main     # back to main
```

## Troubleshooting

- **"Ref not found"** → page changed, re-snapshot.
- **Click does nothing** → an overlay/modal is intercepting it; dismiss that first.
- **Fill doesn't work** → `focus @e1` then `keyboard inserttext "text"`.
- **Install issues** → `agent-browser doctor --fix`.
