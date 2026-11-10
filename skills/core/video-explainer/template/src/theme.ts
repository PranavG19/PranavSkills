import React from 'react';
import {Easing, interpolateColors} from 'remotion';
import palette from './palette.json';

export type Palette = typeof palette.light;
export const PALETTES: Record<string, Palette> = palette;
export const Theme = React.createContext<Palette>(palette.light);
export const useC = () => React.useContext(Theme);

// 1920x1080. Side margins 96, top 80, and the bottom 216 px belong to captions.
// Figures sit on a 12x6 grid inside AREA and are placed in grid units, never pixels.
export const AREA = {x: 96, y: 176, w: 1728, h: 672};
export const CELL = {w: AREA.w / 12, h: AREA.h / 6};
export const GUTTER = 14; // inset on every side of a grid box
export const gx = (u: number) => AREA.x + u * CELL.w;
export const gy = (u: number) => AREA.y + u * CELL.h;

// Type scale in px at 1080. Nothing renders under 36 (check.mjs greps src/ for it).
export const T = {hero: 120, heading: 64, body: 48, label: 40, mono: 40, caption: 44, small: 36};
export const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif';
export const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

// One easing curve for every enter.
export const ease = Easing.bezier(0.22, 1, 0.36, 1);

export type State = 'idle' | 'pass' | 'fail' | 'hot' | 'ghost';

// Color means status: red rejects, green passes, accent marks the change, dashed is not in play.
export const tone = (C: Palette, s: string) =>
  ({
    idle: {fill: C.soft, edge: C.faint, ink: C.ink},
    pass: {fill: C.okSoft, edge: C.ok, ink: C.ink},
    fail: {fill: C.badSoft, edge: C.bad, ink: C.ink},
    hot: {fill: C.accentSoft, edge: C.accent, ink: C.ink},
    ghost: {fill: C.bg, edge: C.faint, ink: C.muted},
  })[s] ?? {fill: C.soft, edge: C.faint, ink: C.ink};

// Blend from the previous state's colors to the current one as the op eases in.
export const blend = (C: Palette, st: {state: string; prev: string; p: number}) => {
  const a = tone(C, st.prev);
  const b = tone(C, st.state);
  const p = ease(st.p);
  const mix = (x: string, y: string) => interpolateColors(p, [0, 1], [x, y]);
  return {fill: mix(a.fill, b.fill), edge: mix(a.edge, b.edge), ink: mix(a.ink, b.ink)};
};
