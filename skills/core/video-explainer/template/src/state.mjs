// Turns each cue's `show` ops into frame events. The scene kit reads them to draw a frame, and
// check.mjs reads them to count what a settled frame shows, so the two cannot disagree.
// Plain JS with no imports, so node can load it without the bundler.
//
// show ops: reveal [ids] and state {id: idle|pass|fail|hot|ghost} accumulate across a scene's
// cues. stop {at, msg} stays until a later cue sets another stop or null. focus (id or [ids])
// and packet ([ids], a path) last one cue.

export const ENTER = 6; // a show op starts this many frames into its cue
export const EASE = 12; // and eases over this many frames
export const PACKET_SHARE = 0.6; // a packet crosses its path in this share of its cue
export const DIM = 0.35; // opacity of what is out of focus

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ids = (v) => (v == null ? [] : [].concat(v));

// A map node's box in grid units, and its center (the points a packet travels through).
export const box = (it) => ({x: it.at[0], y: it.at[1], w: it.w ?? 3, h: it.h ?? (it.sub ? 1.5 : 1)});
export const center = (it) => {
  const b = box(it);
  return [b.x + b.w / 2, b.y + b.h / 2];
};

// The kit centers a map's whole layout (every item, revealed or not, so nothing shifts mid-scene)
// on the 12x6 grid. Returns the grid-unit offset to add to each box.
export const fit = (items) => {
  const bs = items.filter((i) => i.at).map(box);
  if (!bs.length) return {dx: 0, dy: 0};
  const minX = Math.min(...bs.map((b) => b.x));
  const minY = Math.min(...bs.map((b) => b.y));
  const w = Math.max(...bs.map((b) => b.x + b.w)) - minX;
  const h = Math.max(...bs.map((b) => b.y + b.h)) - minY;
  return {dx: (12 - w) / 2 - minX, dy: (6 - h) / 2 - minY};
};

export function plan(scene) {
  const byId = Object.fromEntries((scene.items ?? []).map((i) => [i.id, i]));
  const ev = {reveal: {}, state: {}, stop: [], focus: [], packet: []};
  scene.cues.forEach((cue, k) => {
    const s = cue.show ?? {};
    const start = cue.from + ENTER;
    const end = k + 1 < scene.cues.length ? scene.cues[k + 1].from : scene.durationInFrames;
    // A state or stop on a node the packet passes starts when the packet reaches that node.
    const arrive = {};
    if (ids(s.packet).length >= 2 && s.packet.every((id) => byId[id]?.at)) {
      const travel = Math.max(EASE, Math.round((cue.to - cue.from) * PACKET_SHARE));
      const pts = s.packet.map((id) => center(byId[id]));
      const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
      const total = seg.reduce((a, b) => a + b, 0) || 1;
      let run = 0;
      s.packet.forEach((id, i) => {
        if (i > 0) run += seg[i - 1];
        arrive[id] = start + Math.round((travel * run) / total);
      });
      ev.packet.push({from: start, to: start + travel, end, path: s.packet, pts});
    }
    const at = (id) => arrive[id] ?? start;
    for (const id of ids(s.reveal)) ev.reveal[id] ??= start;
    for (const [id, st] of Object.entries(s.state ?? {})) (ev.state[id] ??= []).push({at: at(id), state: st});
    if (s.stop !== undefined) ev.stop.push({at: s.stop ? at(s.stop.at) : start, stop: s.stop});
    if (s.focus) ev.focus.push({from: start, to: end, ids: ids(s.focus)});
  });
  return ev;
}

// What frame `f` (scene-local) shows. Progress values are linear 0..1; the kit applies easing.
export function view(ev, f) {
  const shown = (id) => (ev.reveal[id] == null ? 0 : clamp01((f - ev.reveal[id]) / EASE));
  const state = (id) => {
    let prev = 'idle';
    let cur = {state: 'idle', at: -Infinity};
    for (const e of ev.state[id] ?? []) if (e.at <= f) [prev, cur] = [cur.state, e];
    return {state: cur.state, prev, p: clamp01((f - cur.at) / EASE)};
  };
  const last = ev.stop.filter((e) => e.at <= f).pop();
  const stop = last?.stop ? {...last.stop, p: clamp01((f - last.at) / EASE)} : null;
  const dim = (id) => {
    let w = 0;
    for (const e of ev.focus) {
      if (e.ids.includes(id)) continue;
      w = Math.max(w, clamp01((f - e.from) / EASE) * (1 - clamp01((f - e.to) / EASE)));
    }
    return 1 - (1 - DIM) * w;
  };
  const pk = ev.packet.find((e) => e.from <= f && f < e.end);
  const packet = pk ? {...pk, t: clamp01((f - pk.from) / (pk.to - pk.from))} : null;
  return {shown, state, stop, dim, packet};
}

// Words a settled frame prints, caption excluded. Every string field of a visible item renders,
// so this is the whole list: heading, hero, item label/sub/text, edge labels whose ends both
// show, the stop callout, and a timeline's lane names and tick labels.
export function screenText(scene, f) {
  const v = view(plan(scene), f);
  const out = [scene.heading, scene.hero];
  for (const it of scene.items ?? []) {
    if (v.shown(it.id) < 1) continue;
    out.push(it.label, it.sub, it.text);
  }
  for (const [a, b, label] of scene.edges ?? []) if (v.shown(a) >= 1 && v.shown(b) >= 1) out.push(label);
  if (v.stop) out.push('rejected here', v.stop.msg);
  if (scene.kind === 'timeline') {
    out.push(...lanes(scene), ...ticks(scene.axis).map((t) => t.label));
  }
  return out.filter(Boolean);
}

export const words = (s) => (s.match(/\S+/g) ?? []).filter((w) => /[A-Za-z0-9]/.test(w)).length;

// Timeline helpers, shared with the kit. Times are "HH:MM".
export const hours = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h + m / 60;
};
export const lanes = (scene) => [...new Set((scene.items ?? []).filter((i) => i.lane).map((i) => i.lane))];
export const ticks = (axis) => {
  const out = [];
  for (let h = hours(axis.from); h <= hours(axis.to) + 1e-9; h += axis.every ?? 1) {
    out.push({h, label: `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`});
  }
  return out;
};
