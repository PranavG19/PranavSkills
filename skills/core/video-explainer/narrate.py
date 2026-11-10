#!/usr/bin/env python3
"""Local narration: one WAV per line, loudness-normalized, cached.

Usage:
  narrate.py --in lines.json --out-dir DIR [--engine kokoro|qwen|say|auto] [--voice NAME]
             [--speed X] [--lexicon lexicon.json]

lines.json is a list of {"id": str, "text": str}. For each line this writes DIR/<id>.wav (mono
16-bit PCM, 48 kHz, one linear gain to -16 LUFS integrated, or less when a -2 dBTP true peak
cap binds, edge silence trimmed to a 50 ms pad, inner pauses capped at 0.3 s) and
DIR/durations.json mapping id -> seconds.
Finished audio is cached in DIR/.cache under a hash of (engine, model, voice, speed, spoken
text), so unchanged lines are not regenerated.

Engines (all local, nothing goes to the network; HF_HUB_OFFLINE=1 is forced):
  kokoro  Kokoro-82M via mlx-audio. Default voice af_heart. Default engine.
  qwen    Qwen3-TTS-12Hz-0.6B-CustomVoice-8bit via mlx-audio. Default voice Aiden.
  say     macOS `say`. Default voice Samantha. Robotic; last resort.
  auto    the first of kokoro, qwen, say that is available (and accepts --voice, if given).
An explicit engine that is unavailable is an error that names the missing piece; only auto falls
back.

--speed is Kokoro's native speed and the `say` rate multiplier. Default 1.1 for kokoro (about 147
written words per minute on technical text, inside a 140-165 wpm bar; 1.0 gave 139) and 1.0 for
the others. Qwen has no native speed control, so qwen accepts only 1.0.

--lexicon is a JSON object of spoken replacements, e.g. {"PAY4": "pay four"}. Each key is
matched as a whole token (case-sensitive), longest key first, before synthesis.

Environment (defaults are what this Mac already has):
  NARRATE_PYTHON        python with mlx-audio and misaki. If the running interpreter cannot
                        import mlx_audio, the script re-executes itself under this one.
                        Default ~/.claude/voice/kokoro-venv/bin/python
  NARRATE_KOKORO_MODEL  Kokoro model dir (config.json, voices/*.safetensors).
                        Default ~/models/Kokoro-82M-bf16
  NARRATE_QWEN_MODEL    HF repo id (read from the local HF cache only) or a local dir.
                        Default mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-8bit
  NARRATE_FFMPEG        ffmpeg with the loudnorm filter. Default: `ffmpeg` on PATH, else
                        ./node_modules/@remotion/compositor-darwin-arm64/ffmpeg under the current
                        directory (the binary Remotion bundles).
"""
import argparse
import array
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import wave

os.environ["HF_HUB_OFFLINE"] = "1"

ENGINES = ("kokoro", "qwen", "say")
AUTO_ORDER = ("kokoro", "qwen", "say")
DEFAULT_VOICE = {"kokoro": "af_heart", "qwen": "Aiden", "say": "Samantha"}
DEFAULT_SPEED = {"kokoro": 1.1, "qwen": 1.0, "say": 1.0}
OUT_RATE = 48000
TARGET_LUFS = -16.0
TARGET_TP = -2.0  # 0.5 dB under a -1.5 dBTP bar; loudnorm landed at -1.48 on one line with -1.5
SILENCE_DB = -50.0  # edge trim threshold, per 10 ms window
PAD_S = 0.05
PAUSE_DB = -42.0  # a window this quiet counts as pause; at most +4.5 dB of later gain keeps it under -45 dB
MAX_PAUSE_S = 0.3  # Kokoro held one comma for 0.48 s, past a 0.4 s silence bar
# Bump when the processing below changes, so old cache entries stop matching.
PIPELINE_VERSION = 4
QWEN_INSTRUCT = "Speak naturally with clear articulation, conversational pauses, and expressive intonation."
SEED = 0  # both models draw random numbers; a fixed seed per line makes the same text give the same audio

NARRATE_PYTHON = os.path.expanduser(os.environ.get("NARRATE_PYTHON", "~/.claude/voice/kokoro-venv/bin/python"))
KOKORO_MODEL = os.path.expanduser(os.environ.get(
    "NARRATE_KOKORO_MODEL", "~/models/Kokoro-82M-bf16"))
QWEN_MODEL = os.environ.get("NARRATE_QWEN_MODEL", "mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-8bit")


class Unavailable(Exception):
    """An engine or tool is missing; the message names the missing piece."""


def die(msg, code=2):
    print(f"narrate: {msg}", file=sys.stderr)
    sys.exit(code)


def has_mlx_audio():
    try:
        import mlx_audio  # noqa: F401
        return True
    except ImportError:
        return False


def maybe_reexec(engine):
    """Kokoro and qwen need mlx-audio. Re-run under NARRATE_PYTHON when this interpreter lacks it."""
    if engine == "say" or has_mlx_audio() or os.environ.get("NARRATE_REEXEC"):
        return
    if not os.path.isfile(NARRATE_PYTHON):
        if engine == "auto":
            return  # auto can still reach `say`; the kokoro/qwen checks report why they failed
        die(f"engine {engine} needs mlx-audio, which {sys.executable} cannot import, and "
            f"NARRATE_PYTHON={NARRATE_PYTHON} does not exist. Point NARRATE_PYTHON at a python "
            f"with mlx-audio and misaki installed.")
    os.environ["NARRATE_REEXEC"] = "1"
    os.execv(NARRATE_PYTHON, [NARRATE_PYTHON, os.path.abspath(__file__), *sys.argv[1:]])


def find_ffmpeg():
    candidates = [os.environ.get("NARRATE_FFMPEG"), shutil.which("ffmpeg"),
                  os.path.join(os.getcwd(), "node_modules/@remotion/compositor-darwin-arm64/ffmpeg")]
    for path in candidates:
        if path and os.path.isfile(path) and os.access(path, os.X_OK):
            return path
    raise Unavailable("ffmpeg not found. Set NARRATE_FFMPEG, put ffmpeg on PATH, or run from a "
                      "Remotion project (node_modules/@remotion/compositor-darwin-arm64/ffmpeg).")


def ffmpeg(ff, args):
    # Remotion's bundled ffmpeg loads its dylibs from its own directory.
    env = {**os.environ, "DYLD_LIBRARY_PATH": os.path.dirname(ff)}
    r = subprocess.run([ff, "-hide_banner", "-nostats", *args], capture_output=True, text=True, env=env)
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg failed (exit {r.returncode}): {' '.join(args)}\n{r.stderr[-2000:]}")
    return r.stderr


# ---------------------------------------------------------------- engines

class Kokoro:
    name = "kokoro"

    def __init__(self, voice, speed):
        self.voice, self.speed, self.model = voice, speed, None

    def model_id(self):
        return os.path.basename(KOKORO_MODEL.rstrip("/"))

    def check(self):
        if not has_mlx_audio():
            raise Unavailable(f"mlx_audio is not importable in {sys.executable} (set NARRATE_PYTHON)")
        try:
            import misaki  # noqa: F401
        except ImportError:
            raise Unavailable(f"misaki (Kokoro's G2P) is not importable in {sys.executable}")
        if not os.path.isfile(os.path.join(KOKORO_MODEL, "config.json")):
            raise Unavailable(f"Kokoro model not found at NARRATE_KOKORO_MODEL={KOKORO_MODEL}")
        voices = sorted(f[:-12] for f in os.listdir(os.path.join(KOKORO_MODEL, "voices"))
                        if f.endswith(".safetensors"))
        if self.voice not in voices:
            raise Unavailable(f"Kokoro has no voice {self.voice!r}; English voices: "
                              f"{', '.join(v for v in voices if v[0] in 'ab')}")
        if self.voice[0] not in "ab":
            raise Unavailable(f"voice {self.voice!r} is not English (a_/b_); only misaki English G2P is set up")

    def synth(self, text):
        import mlx.core as mx
        import numpy as np
        if self.model is None:
            from mlx_audio.tts.utils import load_model
            self.model = load_model(KOKORO_MODEL)
        mx.random.seed(SEED)
        voice = os.path.join(KOKORO_MODEL, "voices", f"{self.voice}.safetensors")
        parts = list(self.model.generate(text, voice=voice, speed=self.speed, lang_code=self.voice[0]))
        audio = np.concatenate([np.asarray(p.audio, dtype=np.float32).reshape(-1) for p in parts])
        return audio, int(self.model.sample_rate)


class Qwen:
    name = "qwen"

    def __init__(self, voice, speed):
        self.voice, self.speed, self.model, self.speakers = voice, speed, None, []

    def model_id(self):
        return QWEN_MODEL

    def model_path(self):
        if os.path.isdir(os.path.expanduser(QWEN_MODEL)):
            return os.path.expanduser(QWEN_MODEL)
        # snapshot_download(local_files_only=True) rejects this cache because README.md and
        # .gitattributes were never downloaded, so resolve the snapshot dir from config.json.
        from huggingface_hub import try_to_load_from_cache
        config = try_to_load_from_cache(QWEN_MODEL, "config.json")
        path = os.path.dirname(config) if isinstance(config, str) else None
        if not path or not os.path.isdir(os.path.join(path, "speech_tokenizer")):
            raise Unavailable(f"Qwen3-TTS model {QWEN_MODEL} (config.json and speech_tokenizer/) is not in "
                              f"the local Hugging Face cache (set NARRATE_QWEN_MODEL to a cached repo id or a dir)")
        return path

    def check(self):
        if not has_mlx_audio():
            raise Unavailable(f"mlx_audio is not importable in {sys.executable} (set NARRATE_PYTHON)")
        path = self.model_path()
        with open(os.path.join(path, "config.json")) as f:
            spk = json.load(f).get("talker_config", {}).get("spk_id", {})
        self.speakers = sorted(spk)
        if self.voice.lower() not in self.speakers:
            raise Unavailable(f"Qwen3-TTS has no speaker {self.voice!r}; speakers: {', '.join(self.speakers)}")
        if self.speed != 1.0:
            raise Unavailable("qwen has no native speed control; use --speed 1.0")

    def synth(self, text):
        import mlx.core as mx
        import numpy as np
        if self.model is None:
            from mlx_audio.tts.utils import load_model
            self.model = load_model(self.model_path())
        mx.random.seed(SEED)
        parts = list(self.model.generate_custom_voice(text=text, speaker=self.voice, language="English",
                                                      instruct=QWEN_INSTRUCT, max_tokens=4096))
        audio = np.concatenate([np.asarray(p.audio, dtype=np.float32).reshape(-1) for p in parts])
        return audio, int(self.model.sample_rate)


class Say:
    name = "say"

    def __init__(self, voice, speed):
        self.voice, self.speed = voice, speed

    def model_id(self):
        return "macos-say"

    def check(self):
        if not shutil.which("say"):
            raise Unavailable("macOS `say` is not on PATH")
        listing = subprocess.run(["say", "-v", "?"], capture_output=True, text=True).stdout
        voices = [m.group(1).strip() for m in re.finditer(r"^(.+?)\s{2,}[a-z]{2}_[A-Z]{2}", listing, re.M)]
        if self.voice not in voices:
            raise Unavailable(f"`say` has no voice {self.voice!r} (see `say -v '?'`)")

    def synth(self, text):
        # Returns 16-bit PCM bytes; the pipeline below handles both forms.
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "say.wav")
            rate = str(round(175 * self.speed))
            subprocess.run(["say", "-v", self.voice, "-r", rate, "-o", path, "--file-format=WAVE",
                            "--data-format=LEI16@24000", text], check=True)
            with wave.open(path) as w:
                return w.readframes(w.getnframes()), w.getframerate()


ENGINE_CLASSES = {"kokoro": Kokoro, "qwen": Qwen, "say": Say}


def pick_engine(requested, voice, speed):
    names = AUTO_ORDER if requested == "auto" else (requested,)
    reasons = []
    for name in names:
        engine = ENGINE_CLASSES[name](voice or DEFAULT_VOICE[name], speed or DEFAULT_SPEED[name])
        try:
            engine.check()
            return engine
        except Unavailable as e:
            reasons.append(f"{name}: {e}")
            if requested == "auto":
                print(f"narrate: auto skipped {name}: {e}", file=sys.stderr)
    if requested != "auto":
        die(f"engine {requested} unavailable: {reasons[0].split(': ', 1)[1]}")
    die("no engine available (reasons above)")


# ---------------------------------------------------------------- text and audio

def apply_lexicon(text, lexicon):
    for key in sorted(lexicon, key=len, reverse=True):
        text = re.sub(rf"(?<![\w-]){re.escape(key)}(?![\w-])", lambda _m, v=lexicon[key]: v, text)
    return text


def to_pcm16(audio):
    """float32 numpy array or raw 16-bit bytes -> array('h')."""
    if isinstance(audio, (bytes, bytearray)):
        return array.array("h", audio)
    import numpy as np
    return array.array("h", (np.clip(audio, -1.0, 1.0) * 32767).astype("<i2").tobytes())


def trim_edges(samples, sr):
    """Drop leading/trailing 10 ms windows below SILENCE_DB, keeping PAD_S of real audio context."""
    win = max(1, sr // 100)
    limit = (32768 * 10 ** (SILENCE_DB / 20)) ** 2
    loud = [i for i in range(len(samples) // win)
            if sum(s * s for s in samples[i * win:(i + 1) * win]) / win > limit]
    if not loud:
        raise RuntimeError("engine returned silence")
    pad = int(PAD_S * sr)
    start = max(0, loud[0] * win - pad)
    end = min(len(samples), (loud[-1] + 1) * win + pad)
    return samples[start:end]


def cap_pauses(samples, sr):
    """Shorten every inner run of PAUSE_DB windows to MAX_PAUSE_S by cutting its quiet middle."""
    win = max(1, sr // 100)
    limit = (32768 * 10 ** (PAUSE_DB / 20)) ** 2
    quiet = [sum(s * s for s in samples[i * win:(i + 1) * win]) / win <= limit for i in range(len(samples) // win)]
    keep = int(MAX_PAUSE_S * 100) // 2  # windows kept on each side of a cut
    out, i = array.array("h"), 0
    pos = 0  # samples copied so far
    while i < len(quiet):
        if not quiet[i]:
            i += 1
            continue
        j = i
        while j < len(quiet) and quiet[j]:
            j += 1
        if j - i > 2 * keep and i > 0 and j < len(quiet):
            out.extend(samples[pos:(i + keep) * win])
            pos = (j - keep) * win
        i = j
    out.extend(samples[pos:])
    return out


def write_wav(path, samples, sr):
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(samples.tobytes())


def loudnorm_stats(ff, path, extra=""):
    err = ffmpeg(ff, ["-i", path, "-vn", "-af",
                      f"loudnorm=I={TARGET_LUFS}:TP={TARGET_TP}:LRA=11{extra}:print_format=json", "-f", "null", "-"])
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", err, re.S)
    if not m:
        raise RuntimeError(f"could not read loudnorm stats:\n{err[-1500:]}")
    return json.loads(m.group(0))


def normalize(ff, src, dst):
    """One linear gain toward TARGET_LUFS, capped so the true peak stays at TARGET_TP; mono 16-bit at OUT_RATE.

    Kokoro's true peaks sit 15 to 19 dB above its loudness, so the cap binds on most lines. When it
    binds, loudnorm's linear mode went dynamic on lines of 3 s or more and stayed capped below
    that, so levels depended on line length (-16.6 to -20.9 LUFS). One capped gain treats every
    line the same. A caller joining lines should loudnorm the joined file.
    """
    s = loudnorm_stats(ff, src)
    gain = min(TARGET_LUFS - float(s["input_i"]), TARGET_TP - float(s["input_tp"]))
    ffmpeg(ff, ["-y", "-i", src, "-vn", "-af", f"volume={gain:.2f}dB,aresample={OUT_RATE}",
                "-ac", "1", "-ar", str(OUT_RATE), "-c:a", "pcm_s16le", "-f", "wav", dst])


def wav_seconds(path):
    with wave.open(path) as w:
        return w.getnframes() / w.getframerate()


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--in", dest="inp", required=True, help="lines.json: [{\"id\": str, \"text\": str}]")
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--engine", default="kokoro", choices=(*ENGINES, "auto"))
    ap.add_argument("--voice")
    ap.add_argument("--speed", type=float, help="default: 1.1 for kokoro, 1.0 otherwise")
    ap.add_argument("--lexicon", help="JSON object of spoken replacements")
    args = ap.parse_args()

    if args.speed is not None and args.speed <= 0:
        die("--speed must be positive")
    maybe_reexec(args.engine)

    with open(args.inp) as f:
        lines = json.load(f)
    if not isinstance(lines, list) or not all(
            isinstance(l, dict) and isinstance(l.get("id"), str) and isinstance(l.get("text"), str) for l in lines):
        die(f"{args.inp} must be a JSON list of {{\"id\": str, \"text\": str}}")
    ids = [l["id"] for l in lines]
    bad = [i for i in ids if not re.fullmatch(r"[A-Za-z0-9_.-]+", i) or i.startswith(".")]
    if bad or len(set(ids)) != len(ids):
        die(f"ids must be unique and match [A-Za-z0-9_.-]+ (bad or duplicate: {bad or ids})")
    lexicon = {}
    if args.lexicon:
        with open(args.lexicon) as f:
            lexicon = json.load(f)

    try:
        ff = find_ffmpeg()
    except Unavailable as e:
        die(str(e))
    engine = pick_engine(args.engine, args.voice, args.speed)
    print(f"narrate: engine={engine.name} voice={engine.voice} speed={engine.speed} python={sys.executable}",
          file=sys.stderr)

    cache_dir = os.path.join(args.out_dir, ".cache")
    os.makedirs(cache_dir, exist_ok=True)
    durations = {}
    for line in lines:
        spoken = apply_lexicon(line["text"], lexicon)
        key = hashlib.sha256(json.dumps([PIPELINE_VERSION, engine.name, engine.model_id(), engine.voice,
                                         engine.speed, spoken]).encode()).hexdigest()[:20]
        cached = os.path.join(cache_dir, f"{key}.wav")
        status = "cached"
        if not os.path.isfile(cached):
            status = "generated"
            audio, sr = engine.synth(spoken)
            samples = cap_pauses(trim_edges(to_pcm16(audio), sr), sr)
            with tempfile.TemporaryDirectory() as tmp:
                raw = os.path.join(tmp, "raw.wav")
                write_wav(raw, samples, sr)
                part = cached + ".part"
                normalize(ff, raw, part)
                os.replace(part, cached)
        out = os.path.join(args.out_dir, f"{line['id']}.wav")
        shutil.copyfile(cached, out)
        durations[line["id"]] = round(wav_seconds(out), 3)
        print(f"narrate: {line['id']} {status} {durations[line['id']]:.3f}s", file=sys.stderr)

    with open(os.path.join(args.out_dir, "durations.json"), "w") as f:
        json.dump(durations, f, indent=2)
        f.write("\n")


if __name__ == "__main__":
    main()
