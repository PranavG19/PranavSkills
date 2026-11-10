---
name: recall
description: Look up a name, system, or concept in the local knowledge vault, recording it when missing. Use before answering from general knowledge about an internal system, service, package, team, tool, acronym, codename, business, UX, or past session.
---

The vault answers "what is this thing and how does it connect." It is a set of Obsidian-style
markdown domains, read with `grep` and `read`. No server, no embedding step, no index to build.

Use it whenever a task names something you would otherwise guess at. An unfamiliar service in a
stack trace, a codename in a ticket, an acronym in a review comment. The vault is the first place to
look and the place the answer gets written back to.

## Resolve the root

`$AGENT_KNOWLEDGE_DIR`, falling back to `~/agents/knowledge`. Everything below is relative to it.

**Domains are whatever directories exist there.** List them rather than assuming. A hardcoded list
in this file would go stale the first time a domain was added, and then a present domain would look
absent.

```bash
ls "${AGENT_KNOWLEDGE_DIR:-$HOME/agents/knowledge}"
```

Each domain owns an `INDEX.md` that states its scope and lists its pages. Read that first. One index
is cheap; the pages behind it are not.

## Distinguish the three outcomes

This matters more than anything else here. A domain that does not exist and a domain with no answer
are different facts, and treating them the same is how a lookup failure becomes a confident wrong
answer.

| Outcome | What it means | What to do |
|---|---|---|
| **Hit** | A page answers the question | Read it, follow the links that bear on the task |
| **Miss** | The right domain exists, the page does not | Research it and write the page. See below |
| **No such domain** | Nothing in the vault covers this subject at all | Say so plainly, then use `web` or general knowledge |

A page carrying `status: stub` in its frontmatter names something real but holds no research. That is
a **miss**, not a hit.

## Look it up

1. **List the domains, pick by subject, read that domain's `INDEX.md`.** The index states what the
   domain covers and how current it is. Carry that provenance into your answer, and verify anything
   load-bearing against the live source.

2. **Grep the domain for the term before opening anything.**

   ```bash
   grep -rin "<term>" "${AGENT_KNOWLEDGE_DIR:-$HOME/agents/knowledge}/<domain>/"
   ```

   Grep the whole vault when you do not know the domain. For `.jsonl` domains, grep matches one
   self-contained entry per line, which is often the entire answer with no file read needed.

3. **Search aliases, not just filenames.** Pages declare every other spelling in frontmatter:

   ```yaml
   aliases: [OMS, Order Management Service, order-mgmt]
   ```

   This is how a bare mention in code resolves to the page. A filename is one spelling; the aliases
   are the rest. If you find the page under an alias that is not yet declared, add it.

4. **Read the page at the lines grep found, then follow the `[[links]]` that matter.** Stop when the
   question is answered. Resolve each link back through the index.

5. **Delegate a wide read to a subagent.** When the answer spans several pages, or any file over
   about 20 KB, dispatch a subagent to read the domain and report the conclusion, so the file dumps
   stay out of this context. Tracing a full X to Y to Z flow is always a subagent job.

## On a miss, research it and write the page

**This is how the vault grows, and it is the expected path, not an error.** A miss is a gap with a
known filler, so fill it rather than guessing or silently falling back to general knowledge.

1. **Find the ground truth.** For an internal subject that means the
   organization's own search, code search, wiki and deployment tools. For anything public, use `web`. Dispatch a subagent for this, because
   research reads far more than the answer needs.

2. **Write the page in the shape that domain's `INDEX.md` specifies**, with frontmatter carrying
   `type`, `aliases` covering every spelling you saw in the wild, and `[[links]]` to the systems it
   touches.

3. **Add its index row in the same change.** An unindexed page is unreachable by step 1, which is
   the same silent failure as not having written it.

4. **Record only what you found.** Where the ground truth stayed out of reach, the page says so.
   A sourced gap is useful; an inferred answer presented as fact is worse than a stub.

5. **Read the page back and judge whether it answers the original question.** If it is thin, that is
   a signal to research further now, while the context is loaded, rather than leaving a stub that
   will read as an answer later.

## What belongs in the vault

The vault holds durable, general knowledge about how things connect. Three tests, and a candidate
must pass all three.

- **Will this still be true in six months?** A `/tmp` path, a commit SHA, a PID, or a current ticket
  status will not be. Those are not vault material.
- **Is it findable from the code in under a minute?** Then do not store it. A function signature or a
  code snippet is cheaper to re-read than to keep correct.
- **Is it about a shape or an instance?** "Ledger is the payment recording service, owned by X,
  sitting between Y and Z" is a shape. "Ledger is failing right now" is an instance. Shapes belong
  here; instances do not belong anywhere in this vault.

Everything else is somebody else's job. A standing preference about how work should be done goes in
`~/agents/AGENTS.md`. Ticket and board state stays in the repo's `.agents/`. A lesson that a lint
rule, test, or hook could enforce should become that instead, because an enforced rule cannot be
forgotten and needs no lookup.

## Keeping the vault sound

- A `[[link]]` you add resolves to a real page, or to a stub you deliberately created.
- A new page gets its index row in the same change.
- Verify with the two checkers before you consider vault work done. Both resolve
  `$AGENT_KNOWLEDGE_DIR`.

  ```bash
  python3 <PranavSkills>/scripts/assert-wikilinks.py <domain>
  python3 <PranavSkills>/scripts/assert-index-count.py <domain>
  ```

- Never commit vault content into the PranavSkills repo. That repo is the portable installer and its
  remote is public; the vault holds internal material. A pre-commit hook refuses it.
