import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import {PALETTES, Theme} from './theme';
import {Heading, type Scene, type Timing} from './kit/common';
import {Captions} from './kit/Captions';
import {Card} from './kit/Card';
import {Diff} from './kit/Diff';
import {SystemMap} from './kit/SystemMap';
import {Timeline} from './kit/Timeline';

const KINDS: Record<Scene['kind'], React.FC<{scene: Scene}>> = {card: Card, map: SystemMap, diff: Diff, timeline: Timeline};

// Hard cuts between scenes and one narration track, all placed by timing.json.
export const Explainer: React.FC<{timing: Timing}> = ({timing}) => {
  const C = PALETTES[timing.theme ?? 'light'];
  return (
    <Theme.Provider value={C}>
      <AbsoluteFill style={{background: C.bg}}>
        <Audio src={staticFile('narration.wav')} />
        {timing.scenes.map((scene) => {
          const Kind = KINDS[scene.kind];
          return (
            <Sequence key={scene.id} from={scene.from} durationInFrames={scene.durationInFrames} name={scene.id}>
              {scene.kind === 'card' ? null : <Heading text={scene.heading} />}
              <Kind scene={scene} />
              <Captions cues={scene.cues} />
            </Sequence>
          );
        })}
      </AbsoluteFill>
    </Theme.Provider>
  );
};
