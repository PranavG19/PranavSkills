---
name: handoff
description: Write a resumable handoff artifact when stopping mid-task. Durable state, open decisions, the single next action, cited paths and SHAs, secrets redacted. Use before a context boundary or end of day; on resume, read the latest handoff before acting.
---

`handoff → write durable state to a file → name the single next action → cite paths and SHAs → redact secrets → on resume, read it first`

Work stopped mid-task lives only in a context that will not survive a summarization, a crash, or the end of the day. **A plan held only in the conversation is lost the moment the conversation ends, so the next session rebuilds it from the diff and usually rebuilds it wrong.** This skill writes the state to a durable file that any later session (or agent) reads before acting.

Distinct from `learn`, which records a durable lesson for all future work. This records the state of one in-flight task. Distinct from `orchestrate`, which hands off between pipeline stages inside a run. This survives across runs and crashes.

## Write the handoff

Write to a durable file (for example `.agents/handoff/<task>.md`), not to the reply. Keep it short and factual.

1. **Where things stand.** What is done and proven, what is in progress, what is untouched. One honest paragraph, not a transcript.
2. **The single next action.** The one concrete thing the next session should do first. Not a list of ten. The one that unblocks the rest.
3. **Open decisions.** Anything unresolved that the next session or the user must settle before proceeding, each with what is needed to close it.
4. **Cited artifacts.** The exact paths, branch, and base commit SHAs the work sits on, so the next session reads against the right tree.
5. **Redact secrets.** No tokens, keys, or credentials in the file. Name where a needed secret lives, never its value.

## On resume

Before touching anything, read the latest handoff for the task. Trust its cited state as the starting point rather than re-deriving it from scratch, but re-pin the base SHA in case the tree moved while you were away.

## Constraints

- The handoff is a file on disk, not a message. A message dies with the context.
- Exactly one next action, named. A handoff that lists everything prioritizes nothing.
- Secrets are redacted to a pointer. The value never lands in the file.
