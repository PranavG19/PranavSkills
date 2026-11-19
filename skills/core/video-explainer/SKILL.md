---
name: video-explainer
description: Narrated explainer video (MP4) of a system, change, or plan, where animated figures carry the facts and measured narration sets the timing.
disable-model-invocation: true
argument-hint: "<subject>"
---

`research with explainer → storyboard → script.json → voice and time → check → contact sheet → render → check the MP4 → watch test → open it`

The viewer is an engineer who sees each picture once, at the narrator's pace, with no pause button. One figure per scene carries the facts, the narration says what the figure is showing right now, and captions repeat it. Every word on screen and every spoken word lives in `script.json`. The kit in [template/](template/) draws it, and [build_audio.py](build_audio.py) times every scene from the measured audio, so nothing is placed by pixel or timed by hand.

Paths below are relative to this skill's directory. The project is `<task-dir>/video/`.

## Steps

1. **Research.** Call the Skill tool with `explainer` and run its steps 1 to 6 (map, claim, 5 facts and deep items, napkin, inventory, reader questions), stopping before any markup. Save the result as `video/research.md`. Bound: explainer's own bounds for those steps. Where its steps name a page figure, read it as a scene.
2. **Storyboard.** Add a table to `research.md` with one row per scene, 5 to 8 scenes, each one of explainer's figures drawn with a kit kind (`card`, `map`, `diff`, `timeline`). Scene 1 is a `card` whose hero is the claim, so frame 0 works as a poster. Scene 2 is the core map, the failure today. The last scene is a `card` with the ask, which holds still. Bound: every fact and deep item names the scene and cue whose `show` prints its key words on screen.
3. **Set up and script.** Copy [template/](template/) to `video/` and run `npm ci` there (about 1 min, inside the project only). Write `video/script.json` from the storyboard ([template/script.example.json](template/script.example.json) shows every kind, and the reference below lists every field). Each cue is one spoken sentence of 20 words or fewer plus the `show` state it reveals. Speak real names, and keep long ids on screen rather than in speech ("the change" aloud, `CHG-1234` on the card). Put a respelling for every identifier you do speak in `lexicon` (`"PAY4": "pay four"`, `"PlnSvc": "plan service"`). Bound: the `lexicon` bar in step 4 passes.
4. **Voice and time.** Run `python3 build_audio.py video` (Kokoro through [narrate.py](narrate.py), cached per line), then `node check.mjs video`. When `voiced pace` fails across the board, set `speed` in `script.json` to the speed it suggests and rerun. When one scene fails alone, reword its cues. Fix every other failing bar in `script.json`, never in the kit. Bound: `check.mjs video` exits 0.
5. **Contact sheet.** Run `node contact.mjs video` and open `video/out/contact.png` (frame 0, every cue's settled frame, the last frame). Bound: each tile shows its cue's state as the storyboard says, with no clipped, overlapping, or off-grid text, and the first tile shows the claim. Fix a layout problem by moving items on the grid in `script.json`, then repeat steps 4 and 5.
6. **Render.** Run `npx remotion render Explainer out/video.mp4` in `video/`, then `node check.mjs video --mp4 out/video.mp4`. Bound: it exits 0 (spec, loudness, and silence bars added).
7. **Watch test.** Dispatch two fresh subagents in one batch, neither given `research.md`. Muted gets only `contact.png` and must state the claim and 3 of the 5 facts. Full gets `contact.png` and `script.md` and must state the claim, all 5 facts, the answer to every reader question, and two thirds of the deep items. Ask both for every term they could not explain. Grade them against `research.md`. Each miss names the cue to redraw or reword. Rerun steps 4 to 7 once, then report what still misses.
8. **Open it** with your platform's open command, and name the file.

## script.json

The top level holds `theme` (`light` or `dark`), `speed` (Kokoro, default 1.1), `voice` (default `af_heart`), `engine` (`kokoro`, `qwen`, `say`, `auto`), `lexicon`, and `scenes`. Each scene has an `id`, a `kind`, a `heading` (a claim, shown top left), `items`, and `cues`.

| Kind | Scene fields | Item fields |
|---|---|---|
| `card` | `hero` (the claim or the ask, on screen from the first frame), `heading` (small line above it) | `text`, `tone` (`ink`, `muted`, `accent`, `ok`, `bad`, `warn`) |
| `map` | `edges`: `[from, to, label?]`, drawn once both ends show | `label`, `sub`, `at: [col, row]` on the 12x6 grid, `w` (default 3), `h` (default 1, or 1.5 with a `sub`), `group: true` for a container drawn behind. The kit centers the whole layout. |
| `diff` | | `text`, `mark` (`-`, `+`, or empty for plain code), `hot` (the changed token, in accent), `label` |
| `timeline` | `axis`: `{from: "09:00", to: "17:00", every: 2}` | a block `{lane, from, to, label}` or a marker `{time, label}` |

A cue is `{text, show}`. Its `show` ops start 6 frames into the cue and ease over 12.

- `reveal: [ids]` and `state: {id: idle | pass | fail | hot | ghost}` last for the rest of the scene. Red `fail` is only a rejection, green `pass` only a pass, `hot` marks the part this change touches, and dashed `ghost` is not in play or unknown.
- `stop: {at, msg, side}` prints `rejected here` and the real message below a node (`side: "above"` to clear an edge) until a later cue sets another stop or `null`.
- `focus: id or [ids]` dims everything else to 0.35, and `packet: [ids]` moves a dot along that path across 60% of the cue. Both last one cue. A `state` or `stop` on a node the packet passes waits until the packet reaches it.
- A stepper is a `map` row of nodes that turn `pass` cue by cue. Code is a `diff` with a line revealed per cue.

## Bars

[check.mjs](check.mjs) measures each one and prints the value next to its bar.

| Bar | Bound |
|---|---|
| Runtime | 60 to 120 s, 300 narration words or fewer |
| Voiced pace | 140 to 165 written words per minute over the whole video and 125 to 185 in every scene, from the measured audio |
| Cue | 20 words or fewer, a caption of 2 lines of 42 characters, shown 1.2 s or longer, 17 characters per second or fewer |
| Lexicon | every spoken identifier (internal capitals, letters mixed with digits, or 2 or more capitals) has a respelling |
| Words on screen | 30 or fewer per settled frame, caption excluded, 12 or fewer new per cue, labels of 4 words or fewer |
| Node text | each map node's label and sub fit its box, wrapping only at spaces |
| Map fill | the last cue's nodes and groups span 60% or more of the 12x6 grid |
| Still before a cut | nothing moves in a scene's last 20 frames |
| Text size and contrast | no font under 36 px, text tokens 4.5:1 or better in both themes |
| Spec | 1920x1080, 30 fps, h264, aac 48 kHz, frame count equal to `timing.json` within 1 |
| Loudness | -16 LUFS within 1, true peak -1.5 dBTP or lower |
| Silence (-45 dB) | 0.4 s or less inside a scene, 1.0 s or less at a cut, 2.5 s or less at the close |
