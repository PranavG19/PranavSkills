#!/usr/bin/env python3
"""Voice a video project and time every scene from the measured audio.

Usage: build_audio.py <project>

Reads <project>/script.json, voices every cue with narrate.py (next to this file, cached per
line), and writes:
  public/narration.wav    each cue placed at its frame, silence between, two-pass loudnorm to
                          -16 LUFS and -2 dBTP (48 kHz mono)
  src/timing.json         the script plus frames: scene from/durationInFrames, cue from/to, caption lines
  captions.srt, script.md the captions, and the narration as text for the watch test
A scene lasts lead-in + cues + gaps + tail, so its length comes from audio, never a typed number.
Exit 1 when a caption cannot fit 2 lines of 42 characters; narrate.py's exit code when voicing fails.
"""
import json
import math
import os
import re
import subprocess
import sys
import wave

FPS = 30
RATE = 48000  # narrate.py's output rate; 1600 samples per frame
LEAD, GAP, TAIL, CLOSE = 0.3, 0.2, 0.5, 1.5  # seconds: before a scene's first cue, between cues, after the last, after the final scene
LINE = 42
HERE = os.path.dirname(os.path.abspath(__file__))
NARRATE = os.path.join(HERE, "narrate.py")
sys.path.insert(0, HERE)
import narrate  # noqa: E402  (its ffmpeg helpers; stdlib only at import)


def die(msg, code=1):
    print(f"build_audio: {msg}", file=sys.stderr)
    sys.exit(code)


def caption_lines(text):
    """One line, or the most even two-line split, preferring a break after punctuation."""
    if len(text) <= LINE:
        return [text]
    words = text.split()
    best = None
    for i in range(1, len(words)):
        a, b = " ".join(words[:i]), " ".join(words[i:])
        if len(a) <= LINE and len(b) <= LINE:
            score = max(len(a), len(b)) - (6 if a[-1] in ",.:;" else 0)
            if best is None or score < best[0]:
                best = (score, [a, b])
    if not best:
        die(f"caption does not fit 2 lines of {LINE} characters, shorten it: {text!r}")
    return best[1]


def stamp(sec):
    ms = round(sec * 1000)
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def main():
    if len(sys.argv) != 2:
        die("usage: build_audio.py <project>", 2)
    project = os.path.abspath(sys.argv[1])
    with open(os.path.join(project, "script.json")) as f:
        script = json.load(f)
    scenes = script["scenes"]
    scene_ids = [s["id"] for s in scenes]
    if len(set(scene_ids)) != len(scene_ids) or not all(re.fullmatch(r"[a-z0-9-]+", i) for i in scene_ids):
        die(f"scene ids must be unique and match [a-z0-9-]+: {scene_ids}")

    build = os.path.join(project, "build")
    voice_dir = os.path.join(build, "voice")
    os.makedirs(voice_dir, exist_ok=True)
    lines = [{"id": f"{s['id']}-{k + 1:02d}", "text": c["text"]} for s in scenes for k, c in enumerate(s["cues"])]
    with open(os.path.join(build, "lines.json"), "w") as f:
        json.dump(lines, f, indent=1)
    with open(os.path.join(build, "lexicon.json"), "w") as f:
        json.dump(script.get("lexicon", {}), f, indent=1)
    cmd = [sys.executable, NARRATE, "--in", os.path.join(build, "lines.json"), "--out-dir", voice_dir,
           "--lexicon", os.path.join(build, "lexicon.json")]
    for key in ("engine", "voice", "speed"):
        if key in script:
            cmd += [f"--{key}", str(script[key])]
    r = subprocess.run(cmd, cwd=project)  # cwd lets narrate.py find Remotion's bundled ffmpeg
    if r.returncode != 0:
        die(f"narrate.py failed (exit {r.returncode}), see its message above", r.returncode)

    per_frame = RATE // FPS
    placed = []  # (start frame, pcm bytes)
    cursor = 0
    for si, scene in enumerate(scenes):
        local = round(LEAD * FPS)
        for k, cue in enumerate(scene["cues"]):
            with wave.open(os.path.join(voice_dir, f"{scene['id']}-{k + 1:02d}.wav")) as w:
                if (w.getframerate(), w.getnchannels(), w.getsampwidth()) != (RATE, 1, 2):
                    die(f"{scene['id']} cue {k + 1}: expected 48 kHz mono 16-bit from narrate.py")
                pcm = w.readframes(w.getnframes())
            sec = len(pcm) / 2 / RATE
            cue.update({"from": local, "to": local + math.ceil(sec * FPS), "sec": round(sec, 3),
                        "lines": caption_lines(cue["text"])})
            placed.append((cursor + local, pcm))
            local = cue["to"] + round(GAP * FPS)
        local = scene["cues"][-1]["to"] + round((CLOSE if si == len(scenes) - 1 else TAIL) * FPS)
        scene.update({"from": cursor, "durationInFrames": local})
        # A caption stays up until the next cue starts, or TAIL after its audio, so the final
        # frame (the poster) has none.
        for k, cue in enumerate(scene["cues"]):
            cue["capTo"] = scene["cues"][k + 1]["from"] if k + 1 < len(scene["cues"]) else cue["to"] + round(TAIL * FPS)
        cursor += local

    audio = bytearray(cursor * per_frame * 2)
    for frame, pcm in placed:
        at = frame * per_frame * 2
        audio[at:at + len(pcm)] = pcm
    raw = os.path.join(build, "narration-raw.wav")
    with wave.open(raw, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(bytes(audio))
    # Lines arrive at -16 LUFS or quieter (their true peak cap), so level the joined file once.
    # loudnorm goes dynamic when one linear gain would break the peak cap.
    os.chdir(project)
    ff = narrate.find_ffmpeg()
    s = narrate.loudnorm_stats(ff, raw)
    measured = (f":measured_I={s['input_i']}:measured_TP={s['input_tp']}:measured_LRA={s['input_lra']}"
                f":measured_thresh={s['input_thresh']}:offset={s['target_offset']}:linear=true")
    os.makedirs(os.path.join(project, "public"), exist_ok=True)
    out = os.path.join(project, "public", "narration.wav")
    narrate.ffmpeg(ff, ["-y", "-i", raw, "-af", f"loudnorm=I=-16:TP=-2:LRA=11{measured},aresample={RATE}",
                        "-ac", "1", "-ar", str(RATE), "-c:a", "pcm_s16le", "-f", "wav", out])
    with wave.open(out) as w:
        drift = w.getnframes() - len(audio) // 2
    if abs(drift) > per_frame:
        die(f"loudnorm changed the narration length by {drift} samples, more than one frame")

    timing = {"fps": FPS, "durationInFrames": cursor, "theme": script.get("theme", "light"), "scenes": scenes}
    with open(os.path.join(project, "src", "timing.json"), "w") as f:
        json.dump(timing, f, indent=1)
        f.write("\n")

    srt, md, n = [], ["# Narration", ""], 0
    for i, scene in enumerate(scenes, 1):
        md += [f"## {i}. {scene.get('heading') or scene.get('hero')} ({scene['from'] / FPS:.1f}s)", ""]
        for cue in scene["cues"]:
            n += 1
            a, b = (scene["from"] + cue["from"]) / FPS, (scene["from"] + cue["capTo"]) / FPS
            srt += [str(n), f"{stamp(a)} --> {stamp(b)}", *cue["lines"], ""]
            md.append(f"- {cue['text']}")
        md.append("")
    with open(os.path.join(project, "captions.srt"), "w") as f:
        f.write("\n".join(srt))
    with open(os.path.join(project, "script.md"), "w") as f:
        f.write("\n".join(md))

    for scene in scenes:
        cues = scene["cues"]
        words = sum(len(c["text"].split()) for c in cues)
        spoken = (cues[-1]["to"] - cues[0]["from"]) / FPS
        print(f"build_audio: {scene['id']:<12} {scene['durationInFrames'] / FPS:5.1f}s {words:3d} words "
              f"{words / spoken * 60:4.0f} wpm", file=sys.stderr)
    print(f"build_audio: total {cursor / FPS:.1f}s, {cursor} frames", file=sys.stderr)


if __name__ == "__main__":
    main()
