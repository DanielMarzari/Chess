'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type SoundType = 'move' | 'capture' | 'check' | 'castle' | 'victory' | 'defeat' | 'draw' | 'notify';

const SOUND_FILES: Record<SoundType, string> = {
  move: '/sounds/Move.mp3',
  capture: '/sounds/Capture.mp3',
  check: '/sounds/Check.mp3',
  castle: '/sounds/Move.mp3',
  victory: '/sounds/Victory.mp3',
  defeat: '/sounds/Defeat.mp3',
  draw: '/sounds/Draw.mp3',
  notify: '/sounds/GenericNotify.mp3',
};

export function useSound() {
  const [enabled, setEnabled] = useState(true);
  const audioCache = useRef<Record<string, HTMLAudioElement>>({});

  useEffect(() => {
    const saved = localStorage.getItem('soundEnabled');
    if (saved !== null) setEnabled(saved === 'true');
  }, []);

  useEffect(() => {
    localStorage.setItem('soundEnabled', String(enabled));
  }, [enabled]);

  const play = useCallback(
    (type: SoundType) => {
      if (!enabled) return;
      try {
        let audio = audioCache.current[type];
        if (!audio) {
          audio = new Audio(SOUND_FILES[type]);
          audio.volume = 0.6;
          audioCache.current[type] = audio;
        }
        audio.currentTime = 0;
        void audio.play().catch(() => {});
      } catch {
        // noop
      }
    },
    [enabled]
  );

  return { play, enabled, setEnabled };
}
