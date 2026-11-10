#!/usr/bin/env node
// Quality bars for a video-explainer project. Prints one line per bar with the measured value.
//   node check.mjs <project>                       script and timing bars (after build_audio.py)
//   node check.mjs <project> --mp4 out/video.mp4   plus spec, loudness, and silence of the render
// Exit 1 when any bar fails.

import {execFileSync, spawnSync} from 'node:child_process';
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const project = resolve(process.argv[2] ?? '.');
const mp4Arg = process.argv.indexOf('--mp4');
const mp4 = mp4Arg > 0 ? resolve(project, process.argv[mp4Arg + 1] ?? '') : null;
const timingPath = join(project, 'src/timing.json');
for (const [path, fix] of [[timingPath, 'run build_audio.py first'], [mp4, 'render it first']]) {
  if (path && !existsSync(path)) {
    console.error(`check: no ${path}; ${fix}`);
    process.exit(1);
  }
}
const {plan, screenText, words, box, ENTER, EASE} = await import(pathToFileURL(join(project, 'src/state.mjs')));
const timing = JSON.parse(readFileSync(timingPath, 'utf8'));
const {fps, scenes} = timing;
const script = JSON.parse(readFileSync(join(project, 'script.json'), 'utf8'));

let failed = 0;
const bar = (ok, name, measured, bound) => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(22)} ${measured}  (bar: ${bound})`);
};
const list = (xs) => (xs.length ? xs.slice(0, 6).join('; ') + (xs.length > 6 ? `; +${xs.length - 6} more` : '') : 'none');

// --- script and timing ---
bar(statSync(join(project, 'script.json')).mtimeMs <= statSync(timingPath).mtimeMs, 'timing fresh',
  'timing.json vs script.json', 'rerun build_audio.py after editing script.json');
bar(scenes.length >= 5 && scenes.length <= 8, 'scenes', `${scenes.length}`, '5 to 8');
bar(scenes[0].kind === 'card' && !!scenes[0].hero, 'frame 0 claim', `first scene is ${scenes[0].kind}`, 'a card whose hero is the claim');

const allWords = scenes.flatMap((s) => s.cues).reduce((n, c) => n + words(c.text), 0);
const runtime = timing.durationInFrames / fps;
bar(runtime >= 60 && runtime <= 120, 'runtime', `${runtime.toFixed(1)} s`, '60 to 120 s');
bar(allWords <= 300, 'narration words', `${allWords}`, '300 or fewer');

const pace = scenes.map((s) => {
  const spoken = (s.cues.at(-1).to - s.cues[0].from) / fps;
  return [s.id, (s.cues.reduce((n, c) => n + words(c.text), 0) / spoken) * 60];
});
// Kokoro holds a near-constant syllable rate, so written-word pace swings with word length from
// scene to scene (135 to 181 wpm at one speed). The bar is the whole video plus a wide per-scene band.
const spokenAll = scenes.reduce((n, s) => n + (s.cues.at(-1).to - s.cues[0].from) / fps, 0);
const overall = (allWords / spokenAll) * 60;
const off = pace.filter(([, w]) => w < 125 || w > 185).map(([id, w]) => `${id} ${w.toFixed(0)}`);
const paceOk = overall >= 140 && overall <= 165 && !off.length;
// Measured pace moved about as speed^0.5 (1.1 to 0.95 took 177 to 164 wpm), hence the square.
const speed = script.speed ?? 1.1;
bar(paceOk, 'voiced pace', `overall ${overall.toFixed(0)} wpm at speed ${speed}` +
  (overall < 140 || overall > 165 ? `, try speed ${(speed * (152 / overall) ** 2).toFixed(2)}` : '') +
  `; ${pace.map(([id, w]) => `${id} ${w.toFixed(0)}`).join(', ')}`, '140 to 165 wpm overall, 125 to 185 per scene');

const cueFails = [];
let minSec = Infinity;
let maxCps = 0;
for (const s of scenes) {
  s.cues.forEach((c, k) => {
    const where = `${s.id} cue ${k + 1}`;
    const sec = (c.capTo - c.from) / fps;
    const cps = c.text.length / sec;
    minSec = Math.min(minSec, sec);
    maxCps = Math.max(maxCps, cps);
    if (words(c.text) > 20) cueFails.push(`${where} ${words(c.text)} words`);
    if (c.lines.length > 2 || c.lines.some((l) => l.length > 42)) cueFails.push(`${where} caption over 2x42`);
    if (sec < 1.2) cueFails.push(`${where} ${sec.toFixed(2)} s`);
    if (cps > 17) cueFails.push(`${where} ${cps.toFixed(1)} chars/s`);
  });
}
bar(!cueFails.length, 'cues', `shortest ${minSec.toFixed(2)} s, fastest ${maxCps.toFixed(1)} chars/s; ${list(cueFails)}`,
  '20 words, 2 lines of 42, 1.2 s, 17 chars/s');

// Kokoro guesses at identifiers, so each spoken one needs a respelling. narrate.py matches lexicon
// keys as whole tokens, so a key must equal the token as written.
const lexicon = script.lexicon ?? {};
const unspoken = new Set();
for (const c of scenes.flatMap((s) => s.cues)) {
  for (const raw of c.text.split(/\s+/)) {
    const tok = raw.replace(/^[("']+|[.,:;!?)"']+$/g, '').replace(/'s$/, '');
    if (tok in lexicon) continue;
    if (/[a-z][A-Z]|[A-Za-z].*\d|\d.*[A-Za-z]|[A-Z].*[A-Z]/.test(tok)) unspoken.add(tok);
  }
}
bar(!unspoken.size, 'lexicon', `${Object.keys(lexicon).length} respellings; missing ${list([...unspoken])}`,
  'every spoken identifier has a respelling');

// Show ops must name items that exist, and states, stops, focus, and packets need them revealed.
const refFails = [];
for (const s of scenes) {
  const known = new Set((s.items ?? []).map((i) => i.id));
  const revealed = new Set();
  s.cues.forEach((c, k) => {
    const sh = c.show ?? {};
    for (const id of sh.reveal ?? []) (known.has(id) ? revealed.add(id) : refFails.push(`${s.id} cue ${k + 1} reveals unknown ${id}`));
    const used = [...Object.keys(sh.state ?? {}), ...[].concat(sh.focus ?? []), ...(sh.packet ?? []), ...(sh.stop ? [sh.stop.at] : [])];
    for (const id of used) if (!revealed.has(id)) refFails.push(`${s.id} cue ${k + 1} uses ${id} before it is revealed`);
  });
  for (const [a, b] of s.edges ?? []) if (!known.has(a) || !known.has(b)) refFails.push(`${s.id} edge ${a}-${b}`);
  if (s.kind === 'map') for (const it of s.items ?? []) if (!it.at) refFails.push(`${s.id} ${it.id} has no at`);
}
bar(!refFails.length, 'show references', list(refFails), 'every id exists and is revealed first');

// Words on screen at each cue's settled frame, caption excluded.
let maxOn = 0;
let maxNew = 0;
const screenFails = [];
for (const s of scenes) {
  let prev = words(screenText(s, 0).join(' '));
  s.cues.forEach((c, k) => {
    const n = words(screenText(s, c.to - 3).join(' '));
    maxOn = Math.max(maxOn, n);
    maxNew = Math.max(maxNew, n - prev);
    if (n > 30) screenFails.push(`${s.id} cue ${k + 1} shows ${n}`);
    if (n - prev > 12) screenFails.push(`${s.id} cue ${k + 1} adds ${n - prev}`);
    prev = n;
  });
  for (const it of s.items ?? []) for (const f of ['label', 'sub']) if (it[f] && words(it[f]) > 4) screenFails.push(`${s.id} ${it.id} ${f} "${it[f]}"`);
  for (const [a, b, l] of s.edges ?? []) if (l && words(l) > 4) screenFails.push(`${s.id} edge ${a}-${b} label`);
}
bar(!screenFails.length, 'words on screen', `max ${maxOn} per frame, max ${maxNew} new per cue; ${list(screenFails)}`,
  '30 per frame, 12 new per cue, labels of 4 words');

// A map node's label and sub must fit its box. Widths are estimates for the system sans at the
// kit's sizes (bold 40 px about 23 px a character, regular 36 px about 18), wrapping at spaces only.
const lines = (text, px, width) => {
  let n = 1;
  let used = 0;
  for (const w of text.split(' ')) {
    const need = (used ? 1 : 0) * px + w.length * px;
    if (used && used + need > width) { n++; used = w.length * px; } else used += need;
  }
  return n;
};
const overflow = [];
for (const s of scenes.filter((x) => x.kind === 'map')) {
  for (const it of (s.items ?? []).filter((i) => !i.group && i.at)) {
    const b = box(it);
    const width = b.w * 144 - 28 - 52 - 8;
    const height = b.h * 112 - 28 - 8;
    const need = lines(it.label ?? '', 23, width) * 46 + (it.sub ? 6 + lines(it.sub, 18, width) * 43 : 0);
    if (need > height) overflow.push(`${s.id} ${it.id} needs ${need} of ${height} px`);
  }
}
bar(!overflow.length, 'node text fits', list(overflow), 'label and sub fit their box (widen w or raise h)');

// A map's final layout, containers included, should use the figure area, not a corner of it.
const fills = [];
for (const s of scenes.filter((x) => x.kind === 'map')) {
  const ev = plan(s);
  const last = s.cues.at(-1).to;
  const bs = (s.items ?? []).filter((i) => ev.reveal[i.id] != null && ev.reveal[i.id] <= last).map(box);
  if (!bs.length) continue;
  const w = Math.max(...bs.map((b) => b.x + b.w)) - Math.min(...bs.map((b) => b.x));
  const h = Math.max(...bs.map((b) => b.y + b.h)) - Math.min(...bs.map((b) => b.y));
  fills.push([s.id, (w * h) / 72]);
}
bar(fills.every(([, f]) => f >= 0.6), 'map fill', fills.map(([id, f]) => `${id} ${(f * 100).toFixed(0)}%`).join(', ') || 'no maps', '60% of the 12x6 area');

// Nothing moves in a scene's last 20 frames, so every cut lands on a still frame.
const late = [];
for (const s of scenes) {
  const ev = plan(s);
  const ends = [
    ...Object.values(ev.reveal).map((f) => f + EASE),
    ...Object.values(ev.state).flat().map((e) => e.at + EASE),
    ...ev.stop.map((e) => e.at + EASE),
    ...ev.focus.map((e) => e.from + EASE),
    ...ev.packet.map((e) => e.to),
  ];
  const lastMove = Math.max(ENTER, ...ends);
  if (lastMove > s.durationInFrames - 20) late.push(`${s.id} moves until ${s.durationInFrames - lastMove} frames before the cut`);
}
bar(!late.length, 'still before cut', list(late), 'no motion in the last 20 frames');

// No font size literal under 36 in src/.
const small = [];
const walk = (d) => readdirSync(d, {withFileTypes: true}).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
for (const f of walk(join(project, 'src')).filter((f) => /\.(tsx?|mjs)$/.test(f))) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/fontSize[:=]\s*\{?\s*(\d+)/g)) if (+m[1] < 36) small.push(`${f.slice(project.length + 1)} ${m[1]}`);
  const scale = text.match(/export const T = \{([^}]*)\}/);
  for (const m of scale?.[1].matchAll(/:\s*(\d+)/g) ?? []) if (+m[1] < 36) small.push(`theme T ${m[1]}`);
}
bar(!small.length, 'text size', list(small), 'no fontSize under 36');

// Text tokens on the surfaces they sit on, in both themes.
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const palette = JSON.parse(readFileSync(join(project, 'src/palette.json'), 'utf8'));
let minRatio = Infinity;
const lowContrast = [];
for (const [theme, p] of Object.entries(palette)) {
  const pairs = [['caption', 'captionBg']];
  for (const fg of ['ink', 'muted', 'accent', 'ok', 'warn', 'bad']) pairs.push([fg, 'bg'], [fg, 'soft']);
  for (const soft of ['accentSoft', 'okSoft', 'warnSoft', 'badSoft']) pairs.push(['ink', soft], ['muted', soft], [soft.replace('Soft', ''), soft]);
  for (const [fg, bg] of pairs) {
    const r = ratio(p[fg], p[bg]);
    minRatio = Math.min(minRatio, r);
    if (r < 4.5) lowContrast.push(`${theme} ${fg} on ${bg} ${r.toFixed(2)}`);
  }
}
bar(!lowContrast.length, 'contrast', `lowest ${minRatio.toFixed(2)}:1; ${list(lowContrast)}`, '4.5:1, both themes');

// --- the rendered file ---
if (mp4) {
  const dir = join(project, 'node_modules/@remotion');
  const comp = existsSync(dir) ? readdirSync(dir).find((d) => d.startsWith('compositor-')) : null;
  const bin = (name) => (comp ? join(dir, comp, name) : name);
  const env = {...process.env, DYLD_LIBRARY_PATH: comp ? join(dir, comp) : ''};
  const probe = JSON.parse(execFileSync(bin('ffprobe'), ['-v', 'error', '-count_packets', '-show_streams', '-of', 'json', mp4], {env}).toString());
  const vs = probe.streams.find((s) => s.codec_type === 'video');
  const as = probe.streams.find((s) => s.codec_type === 'audio');
  const frames = +vs.nb_read_packets;
  bar(vs.codec_name === 'h264' && vs.width === 1920 && vs.height === 1080 && vs.r_frame_rate === '30/1'
      && as?.codec_name === 'aac' && +as?.sample_rate === 48000 && Math.abs(frames - timing.durationInFrames) <= 1,
    'spec', `${vs.codec_name} ${vs.width}x${vs.height} ${vs.r_frame_rate}, ${as?.codec_name} ${as?.sample_rate}, ${frames} of ${timing.durationInFrames} frames`,
    '1920x1080 30 fps h264, aac 48k, frames within 1');

  const ff = (af) => spawnSync(bin('ffmpeg'), ['-hide_banner', '-nostats', '-i', mp4, '-vn', '-af', af, '-f', 'null', '-'], {env}).stderr.toString();
  const ln = JSON.parse(ff('loudnorm=print_format=json').match(/\{[^{}]*"input_i"[^{}]*\}/)[0]);
  bar(Math.abs(+ln.input_i + 16) <= 1 && +ln.input_tp <= -1.5, 'loudness', `${ln.input_i} LUFS, ${ln.input_tp} dBTP`, '-16 LUFS within 1, true peak -1.5 dBTP or lower');

  // Classify each silence by where it sits: across a cut, at the close, or inside a scene.
  const sd = ff('silencedetect=noise=-45dB:d=0.25');
  const starts = [...sd.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
  const endsAt = [...sd.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
  const total = timing.durationInFrames / fps;
  const cuts = scenes.map((s) => s.from / fps);
  const worst = {inside: 0, cut: 0, close: 0};
  const gaps = [];
  starts.forEach((a, i) => {
    const b = endsAt[i] ?? total;
    const kind = b >= total - 0.05 ? 'close' : cuts.some((t) => a <= t + 0.05 && b >= t - 0.05) ? 'cut' : 'inside';
    worst[kind] = Math.max(worst[kind], b - a);
    const s = scenes.findLast((x) => x.from / fps <= a);
    const k = s.cues.findLastIndex((c) => (s.from + c.from) / fps <= a);
    if (b - a > {inside: 0.4, cut: 1.0, close: 2.5}[kind]) gaps.push(`${kind} ${(b - a).toFixed(2)} s at ${a.toFixed(1)} s (${s.id} cue ${k + 1})`);
  });
  bar(!gaps.length, 'silence', `longest inside ${worst.inside.toFixed(2)}, at a cut ${worst.cut.toFixed(2)}, at the close ${worst.close.toFixed(2)} s; ${list(gaps)}`,
    '0.4 s inside a scene, 1.0 s at a cut, 2.5 s at the close');
}

console.log(failed ? `\n${failed} bar(s) failed` : '\nall bars pass');
process.exit(failed ? 1 : 0);
