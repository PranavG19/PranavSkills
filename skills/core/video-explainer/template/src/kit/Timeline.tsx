import React from 'react';
import {AbsoluteFill} from 'remotion';
import {hours, lanes, ticks} from '../state.mjs';
import {AREA, FONT, T, blend, gx, useC} from '../theme';
import {Badge, enter, useView, type Scene} from './common';

// Lanes of time blocks on a scaled axis. A block's state colors it (ghost reads as "if needed"),
// and an item with `time` is a marker line such as go / no-go.
export const Timeline: React.FC<{scene: Scene}> = ({scene}) => {
  const C = useC();
  const v = useView(scene);
  const axis = scene.axis ?? {from: '09:00', to: '17:00'};
  const names = lanes(scene);
  const x0 = gx(2);
  const x1 = gx(12);
  const xAt = (t: string) => x0 + ((hours(t) - hours(axis.from)) / (hours(axis.to) - hours(axis.from))) * (x1 - x0);
  // 110 px above the lanes for marker labels, 70 below for ticks, the whole block centered in AREA.
  const laneH = Math.min(170, (AREA.h - 110 - 70) / Math.max(1, names.length));
  const top = AREA.y + (AREA.h - (110 + laneH * names.length + 70)) / 2 + 110;
  const bottom = top + laneH * names.length;
  const items = scene.items ?? [];
  return (
    <AbsoluteFill style={{fontFamily: FONT}}>
      {names.map((name, i) => (
        <div key={name} style={{position: 'absolute', left: AREA.x, top: top + i * laneH, width: x0 - AREA.x - 24, height: laneH, display: 'flex', alignItems: 'center', fontSize: T.label, fontWeight: 700, color: C.ink}}>
          {name}
        </div>
      ))}
      <div style={{position: 'absolute', left: x0, top, width: x1 - x0, height: bottom - top, background: C.soft, borderRadius: 16}} />
      {ticks(axis).map((t) => {
        const x = x0 + ((t.h - hours(axis.from)) / (hours(axis.to) - hours(axis.from))) * (x1 - x0);
        return (
          <div key={t.label} style={{position: 'absolute', left: x - 70, width: 140, top: bottom + 14, textAlign: 'center', fontSize: T.small, color: C.muted}}>
            {t.label}
          </div>
        );
      })}
      {items.filter((it) => it.lane).map((it) => {
        const st = v.state(it.id);
        const c = blend(C, st);
        const lane = names.indexOf(it.lane as string);
        const left = xAt(it.from as string);
        return (
          <div
            key={it.id}
            style={{
              position: 'absolute', left: left + 4, top: top + lane * laneH + 14, width: xAt(it.to as string) - left - 8, height: laneH - 28,
              boxSizing: 'border-box', border: `4px ${st.state === 'ghost' ? 'dashed' : 'solid'} ${c.edge}`, borderRadius: 14, background: c.fill,
              display: 'flex', alignItems: 'center', padding: '0 18px', fontSize: T.small, fontWeight: 700, color: c.ink, lineHeight: 1.1,
              ...enter(v.shown(it.id), v.dim(it.id)),
            }}
          >
            {it.label}
            <Badge state={st.state} p={st.p} />
          </div>
        );
      })}
      {items.filter((it) => it.time).map((it) => {
        const x = xAt(it.time as string);
        const color = v.state(it.id).state === 'fail' ? C.bad : C.ink;
        return (
          <div key={it.id} style={enter(v.shown(it.id), v.dim(it.id))}>
            <div style={{position: 'absolute', left: x - 2, top: top - 24, width: 5, height: bottom - top + 36, background: color}} />
            <div style={{position: 'absolute', left: x - 300, width: 600, top: top - 92, textAlign: 'center', fontSize: T.label, fontWeight: 700, color}}>{it.label}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
