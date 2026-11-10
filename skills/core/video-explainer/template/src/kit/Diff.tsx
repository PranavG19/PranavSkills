import React from 'react';
import {AbsoluteFill} from 'remotion';
import {AREA, FONT, MONO, T, blend, useC} from '../theme';
import {Badge, enter, useView, type Scene} from './common';

// Before and after lines (mark "-" or "+"), or code revealed a line per cue (mark "").
// `hot` is the changed token, drawn in accent.
export const Diff: React.FC<{scene: Scene}> = ({scene}) => {
  const C = useC();
  const v = useView(scene);
  const bg = {'-': C.badSoft, '+': C.okSoft, '': C.soft};
  const fg = {'-': C.bad, '+': C.ok, '': C.muted};
  return (
    <AbsoluteFill style={{fontFamily: FONT}}>
      <div style={{position: 'absolute', left: AREA.x, top: AREA.y, width: AREA.w, height: AREA.h, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28}}>
        {(scene.items ?? []).map((it) => {
          const mark = it.mark ?? '';
          const st = v.state(it.id);
          const edge = st.state === 'idle' ? 'transparent' : blend(C, st).edge;
          const [pre, post] = it.hot && it.text?.includes(it.hot) ? it.text.split(it.hot) : [it.text ?? '', null];
          return (
            <div key={it.id} style={{position: 'relative', ...enter(v.shown(it.id), v.dim(it.id))}}>
              {it.label ? <div style={{fontSize: T.small, fontWeight: 700, color: C.muted, marginBottom: 10}}>{it.label}</div> : null}
              <div style={{display: 'flex', background: bg[mark], border: `4px solid ${edge}`, borderRadius: 16, padding: '18px 28px', fontFamily: MONO, fontSize: T.mono, lineHeight: 1.35, color: C.ink}}>
                <div style={{width: 48, flex: 'none', fontWeight: 700, color: fg[mark]}}>{mark}</div>
                <div style={{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>
                  {pre}
                  {post !== null ? (
                    <>
                      <span style={{color: C.accent, background: C.accentSoft, fontWeight: 700, borderRadius: 8, padding: '0 6px'}}>{it.hot}</span>
                      {post}
                    </>
                  ) : null}
                </div>
              </div>
              <Badge state={st.state} p={st.p} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
