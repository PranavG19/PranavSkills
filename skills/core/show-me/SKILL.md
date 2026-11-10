---
name: show-me
description: Explains structure, control flow, a refactor, or a change with the smallest fitting visual (pseudocode, a call/file/component tree, Mermaid, a shape-matched diff, or one focused HTML artifact) beside one line of text.
disable-model-invocation: true
---

`show-me → pick the smallest visual that answers the question → put it beside one line of text → stop when the point lands`

Prose is the wrong default for structure, flow, and change. A wall of text describing a call path or a refactor makes the reader rebuild the picture in their head. Show the shape instead, and match the form to the content. **A diagram that restates the prose adds nothing; the one that replaces it earns its place.** Use one form, sometimes several, rarely all. The goal is the smallest view that makes the point, not a gallery.

## Pick the form by what you are explaining

- **Pseudocode** for logic or an algorithm. Strip it to the decision points that matter.
- **Call tree** for runtime control flow. Show who calls whom, only the branches in question.
- **Component tree** for UI structure, with state and module boundaries marked.
- **File tree** for where responsibility lives, in a broad refactor or a new area. Keep it shallow.
- **Mermaid** for interaction, sequence, or data flow across parts.
- **Diff** when only the change matters. Show the before and after lines, not the whole file.
- **Whole code block** when most of it is new, or when order and ownership are the point.
- **One focused HTML artifact** for a dense visual, layout, or state comparison that text cannot carry. Match the surrounding product's colors, type, and spacing, then open it with your platform's open command.

## Match the diff shape to the topic

A change reads clearest as a diff of the thing that changed. A control-flow change is a diff of the call tree, not of the file. A move is a diff of the file tree. A type change is a diff of the signature. Render the layer the reader is asking about, not just the raw text patch.

## Keep it small

Show only the calls, files, props, states, or lines the current question needs. Place each visual next to the short line of text it supports, never in a separate wall. A reader who can answer their question from the picture is done, so stop there.

## Constraints

- The visual serves the reader, not the author. If it does not remove words or confusion, cut it.
- A one-line answer that is already clear stays one line. This is for the moment a picture settles in seconds what paragraphs would drag out.
- Do not invent structure to draw. The tree, diff, or diagram reflects the real code, or it is not drawn.
