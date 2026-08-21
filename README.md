# Pranav Skills

A small, editable set of coding-agent skills inspired by Matt Pocock's process-first workflow.
One source tree renders the same core skills into Claude Code, Codex, and Kiro.

## Use

```bash
node scripts/doctor.mjs
node scripts/render.mjs --dry-run
node scripts/render.mjs
```

Skills are symlinked into each profile, so edits stay in one place. Adding or removing a skill
requires another render. Kiro keeps its existing managed skill directories; this renderer owns
only the symlinks it creates.

The workflow is intentionally composable: shape with `grilling` and `spec`, split work with
`to-tickets`, implement one ticket through `tdd`, review in a fresh context, and use
`supervise` plus `cmux` when coordinating several projects.

## Safety

This public export contains only generic core skills. Machine archives, credentials, internal
knowledge, work profiles, and organization-specific skills are deliberately excluded.

## Attribution

Parts of the workflow design were adapted from
[Matt Pocock's skills](https://github.com/mattpocock/skills), used under the MIT License.
