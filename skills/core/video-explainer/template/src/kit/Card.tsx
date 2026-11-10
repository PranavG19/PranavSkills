import React from 'react';
import {AbsoluteFill} from 'remotion';
import {FONT, T, useC} from '../theme';
import {enter, useView, type Scene} from './common';

// Title (the claim, on screen from frame 0, so the first frame works as a poster) and end card
// (the ask, which holds still). `heading` is the small line above the hero.
export const Card: React.FC<{scene: Scene}> = ({scene}) => {
  const C = useC();
  const v = useView(scene);
  return (
    <AbsoluteFill style={{fontFamily: FONT, padding: '80px 96px 216px', justifyContent: 'center'}}>
      {scene.heading ? <div style={{fontSize: T.label, fontWeight: 700, color: C.muted, marginBottom: 24}}>{scene.heading}</div> : null}
      <div style={{fontSize: T.hero, fontWeight: 800, color: C.ink, lineHeight: 1.05, letterSpacing: -2, maxWidth: 1728}}>{scene.hero}</div>
      <div style={{marginTop: 48, display: 'flex', flexDirection: 'column', gap: 18}}>
        {(scene.items ?? []).map((it) => (
          <div key={it.id} style={{fontSize: T.body, fontWeight: 600, color: C[it.tone ?? 'ink'], lineHeight: 1.25, ...enter(v.shown(it.id), v.dim(it.id))}}>
            {it.text}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
