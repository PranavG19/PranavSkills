import React from 'react';
import {AbsoluteFill} from 'remotion';
import {box, fit} from '../state.mjs';
import {AREA, CELL, FONT, GUTTER, T, blend, ease, gx, gy, useC} from '../theme';
import {Badge, enter, useView, type Item, type Scene} from './common';

type Rect = {x: number; y: number; w: number; h: number};
const rectIn = (off: {dx: number; dy: number}) => (it: Item): Rect => {
  const b = box(it);
  return {x: gx(b.x + off.dx) + GUTTER, y: gy(b.y + off.dy) + GUTTER, w: b.w * CELL.w - 2 * GUTTER, h: b.h * CELL.h - 2 * GUTTER};
};
const mid = (r: Rect): [number, number] => [r.x + r.w / 2, r.y + r.h / 2];

// Where the ray from r's center toward (tx, ty) leaves r, pushed `pad` px further out.
const exit = (r: Rect, tx: number, ty: number, pad = 0): [number, number] => {
  const [cx, cy] = mid(r);
  const dx = tx - cx;
  const dy = ty - cy;
  const len = Math.hypot(dx, dy) || 1;
  const t = Math.min(dx ? r.w / 2 / Math.abs(dx) : Infinity, dy ? r.h / 2 / Math.abs(dy) : Infinity);
  return [cx + dx * t + (dx / len) * pad, cy + dy * t + (dy / len) * pad];
};

// Wrap only at spaces: the browser also breaks after a hyphen, which splits ids like CHG-1234.
const words = (s: string) => s.split(' ').map((w, i) => <span key={i} style={{whiteSpace: 'nowrap'}}>{i ? ' ' : ''}{w}</span>);

const along = (pts: [number, number][], t: number): [number, number] => {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  let d = t * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const k = seg[i] ? Math.min(1, d / seg[i]) : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
    }
    d -= seg[i];
  }
  return pts[pts.length - 1];
};

// Grid nodes, drawn-on edges, a packet that stops at a failing node, a "rejected here" callout
// with the real message, and focus dimming. Also serves as a stepper: a row of nodes whose
// states turn pass one by one.
export const SystemMap: React.FC<{scene: Scene}> = ({scene}) => {
  const C = useC();
  const v = useView(scene);
  const items = scene.items ?? [];
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const rect = rectIn(fit(items));
  const stopItem = v.stop ? byId[v.stop.at] : null;

  const packet = (() => {
    if (!v.packet) return null;
    const rs = v.packet.path.map((id) => rect(byId[id]));
    const pts = rs.map(mid);
    const n = pts.length;
    pts[n - 1] = exit(rs[n - 1], pts[n - 2][0], pts[n - 2][1], 20); // stop at the last node's door
    const [x, y] = along(pts, ease(v.packet.t));
    const end = v.state(v.packet.path[n - 1]).state;
    const color = v.packet.t < 1 ? C.ink : end === 'fail' ? C.bad : end === 'pass' ? C.ok : C.ink;
    return {x, y, color};
  })();

  return (
    <AbsoluteFill style={{fontFamily: FONT}}>
      {items.filter((i) => i.group).map((it) => {
        const r = rect(it);
        return (
          <div key={it.id} style={{position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, boxSizing: 'border-box', border: `3px solid ${C.line}`, borderRadius: 28, ...enter(v.shown(it.id), v.dim(it.id))}}>
            <div style={{position: 'absolute', left: 28, top: 16, fontSize: T.small, fontWeight: 700, color: C.muted}}>{it.label}</div>
          </div>
        );
      })}

      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        {(scene.edges ?? []).map(([a, b, label]) => {
          const p = Math.max(0, Math.min(1, (Math.min(v.shown(a), v.shown(b)) - 0.5) * 2));
          if (!p) return null;
          const ra = rect(byId[a]);
          const rb = rect(byId[b]);
          const [x1, y1] = exit(ra, ...mid(rb), 6);
          const [x2, y2] = exit(rb, ...mid(ra), 10);
          const xe = x1 + (x2 - x1) * ease(p);
          const ye = y1 + (y2 - y1) * ease(p);
          const ghost = v.state(a).state === 'ghost' || v.state(b).state === 'ghost';
          const ang = Math.atan2(y2 - y1, x2 - x1);
          const head = [0, -0.45, 0.45].map((da, i) => (i ? [x2 - 20 * Math.cos(ang + da), y2 - 20 * Math.sin(ang + da)] : [x2, y2]).join(',')).join(' ');
          const opacity = Math.max(v.dim(a), v.dim(b));
          return (
            <g key={`${a}-${b}`} opacity={opacity}>
              <line x1={x1} y1={y1} x2={xe} y2={ye} stroke={C.faint} strokeWidth={4} strokeLinecap="round" strokeDasharray={ghost ? '12 10' : undefined} />
              <polygon points={head} fill={C.faint} opacity={p >= 1 ? 1 : 0} />
              {label ? (
                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 22} textAnchor="middle" fontSize={T.small} fontWeight={600} fill={C.muted} stroke={C.bg} strokeWidth={10} paintOrder="stroke" opacity={p}>
                  {label}
                </text>
              ) : null}
            </g>
          );
        })}
        {packet ? <circle cx={packet.x} cy={packet.y} r={18} fill={packet.color} /> : null}
      </svg>

      {items.filter((i) => !i.group).map((it) => {
        const r = rect(it);
        const st = v.state(it.id);
        const c = blend(C, st);
        return (
          <div
            key={it.id}
            style={{
              position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, boxSizing: 'border-box',
              border: `4px ${st.state === 'ghost' ? 'dashed' : 'solid'} ${c.edge}`, borderRadius: 20, background: c.fill,
              display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 26px',
              ...enter(v.shown(it.id), v.dim(it.id)),
            }}
          >
            <div style={{fontSize: T.label, fontWeight: 700, color: c.ink, lineHeight: 1.15}}>{words(it.label ?? '')}</div>
            {it.sub ? <div style={{fontSize: T.small, color: C.muted, lineHeight: 1.2, marginTop: 6}}>{words(it.sub)}</div> : null}
            <Badge state={st.state} p={st.p} />
          </div>
        );
      })}

      {v.stop && stopItem ? (() => {
        const r = rect(stopItem);
        const w = 760;
        const left = Math.max(AREA.x, Math.min(AREA.x + AREA.w - w, r.x + r.w / 2 - w / 2));
        // Below the node by default; side "above" anchors it to the node's top instead.
        const at = v.stop.side === 'above' ? {bottom: 1080 - r.y + 18} : {top: r.y + r.h + 18};
        return (
          <div style={{position: 'absolute', left, ...at, width: w, textAlign: 'center', ...enter(v.stop.p)}}>
            <div style={{fontSize: T.small, fontWeight: 700, color: C.bad, letterSpacing: 1}}>rejected here</div>
            <div style={{fontSize: T.label, fontWeight: 700, color: C.bad, lineHeight: 1.2}}>{v.stop.msg}</div>
          </div>
        );
      })() : null}
    </AbsoluteFill>
  );
};
