import React from 'react';
import {useCurrentFrame} from 'remotion';
import {FONT, T, useC} from '../theme';
import type {Cue} from './common';

// Burned-in captions in the bottom band, timed by build_audio.py (cue start to capTo).
export const Captions: React.FC<{cues: Cue[]}> = ({cues}) => {
  const C = useC();
  const frame = useCurrentFrame();
  const cue = cues.find((c) => frame >= c.from && frame < c.capTo);
  if (!cue) return null;
  return (
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 40, display: 'flex', justifyContent: 'center'}}>
      <div style={{background: C.captionBg, opacity: 0.92, color: C.caption, fontFamily: FONT, fontSize: T.caption, fontWeight: 500, lineHeight: 1.3, padding: '14px 34px', borderRadius: 16, textAlign: 'center'}}>
        {cue.lines.map((l) => (
          <div key={l} style={{whiteSpace: 'nowrap'}}>{l}</div>
        ))}
      </div>
    </div>
  );
};
