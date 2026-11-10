import React, {useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import {plan, view} from '../state.mjs';
import {FONT, T, ease, useC} from '../theme';

export type Item = {
  id: string;
  label?: string;
  sub?: string;
  text?: string;
  at?: [number, number];
  w?: number;
  h?: number;
  group?: boolean;
  mark?: '+' | '-' | '';
  hot?: string;
  tone?: 'ink' | 'muted' | 'accent' | 'ok' | 'bad' | 'warn';
  lane?: string;
  from?: string;
  to?: string;
  time?: string;
};
export type Cue = {text: string; lines: string[]; from: number; to: number; capTo: number; show?: Record<string, unknown>};
export type Scene = {
  id: string;
  kind: 'card' | 'map' | 'diff' | 'timeline';
  heading?: string;
  hero?: string;
  items?: Item[];
  edges?: [string, string, string?][];
  axis?: {from: string; to: string; every?: number};
  from: number;
  durationInFrames: number;
  cues: Cue[];
};
export type Timing = {fps: number; durationInFrames: number; theme?: string; scenes: Scene[]};

type View = {
  shown: (id: string) => number;
  state: (id: string) => {state: string; prev: string; p: number};
  stop: {at: string; msg: string; side?: 'above' | 'below'; p: number} | null;
  dim: (id: string) => number;
  packet: {path: string[]; t: number} | null;
};

export const useView = (scene: Scene): View => {
  const frame = useCurrentFrame();
  const ev = useMemo(() => plan(scene), [scene]);
  return view(ev, frame);
};

// Enter: fade up 16 px. Out-of-focus dimming multiplies in.
export const enter = (p: number, dim = 1): React.CSSProperties => ({
  opacity: ease(p) * dim,
  transform: `translateY(${(1 - ease(p)) * 16}px)`,
});

export const Heading: React.FC<{text?: string}> = ({text}) => {
  const C = useC();
  if (!text) return null;
  return (
    <div style={{position: 'absolute', left: 96, top: 80, right: 96, fontFamily: FONT, fontSize: T.heading, fontWeight: 700, color: C.ink, lineHeight: 1.15}}>
      {text}
    </div>
  );
};

// Round pass or fail mark that pops in with its state.
export const Badge: React.FC<{state: string; p: number}> = ({state, p}) => {
  const C = useC();
  if (state !== 'pass' && state !== 'fail') return null;
  const size = 56;
  return (
    <div
      style={{
        position: 'absolute', right: -20, top: -20, width: size, height: size, borderRadius: size,
        background: state === 'pass' ? C.ok : C.bad, display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: Math.min(1, p * 3), transform: `scale(${0.6 + 0.4 * ease(p)})`,
      }}
    >
      <svg width={28} height={28} viewBox="0 0 24 24">
        <path
          d={state === 'pass' ? 'M4 12.5l5 5L20 6.5' : 'M6 6l12 12M18 6L6 18'}
          stroke={C.bg} strokeWidth={3.4} fill="none" strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
