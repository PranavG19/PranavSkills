import React from 'react';
import {Composition} from 'remotion';
import {Explainer} from './Explainer';
import type {Timing} from './kit/common';
import timing from './timing.json';

// build_audio.py writes timing.json from measured narration, so the duration is never hand-typed.
export const RemotionRoot: React.FC = () => (
  <Composition
    id="Explainer"
    component={Explainer}
    defaultProps={{timing: timing as Timing}}
    width={1920}
    height={1080}
    fps={timing.fps}
    durationInFrames={timing.durationInFrames}
    calculateMetadata={({props}) => ({durationInFrames: props.timing.durationInFrames, fps: props.timing.fps})}
  />
);
