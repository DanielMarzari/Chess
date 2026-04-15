'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

export interface TimeControl {
  initialSeconds: number;
  incrementSeconds: number;
  label: string;
}

export const TIME_PRESETS: TimeControl[] = [
  { initialSeconds: 60, incrementSeconds: 0, label: '1+0' },
  { initialSeconds: 120, incrementSeconds: 1, label: '2+1' },
  { initialSeconds: 180, incrementSeconds: 0, label: '3+0' },
  { initialSeconds: 180, incrementSeconds: 2, label: '3+2' },
  { initialSeconds: 300, incrementSeconds: 0, label: '5+0' },
  { initialSeconds: 300, incrementSeconds: 3, label: '5+3' },
  { initialSeconds: 600, incrementSeconds: 0, label: '10+0' },
  { initialSeconds: 600, incrementSeconds: 5, label: '10+5' },
  { initialSeconds: 900, incrementSeconds: 10, label: '15+10' },
  { initialSeconds: 1800, incrementSeconds: 0, label: '30+0' },
  { initialSeconds: 1800, incrementSeconds: 30, label: '30+30' },
];

export interface ClockState {
  white: number; // seconds remaining
  black: number;
  activeColor: 'w' | 'b' | null;
  running: boolean;
  flagged: 'w' | 'b' | null; // who timed out
}

export function useClock(onFlag?: (color: 'w' | 'b') => void) {
  const [tc, setTc] = useState<TimeControl | null>(null);
  const [state, setState] = useState<ClockState>({
    white: 0,
    black: 0,
    activeColor: null,
    running: false,
    flagged: null,
  });
  const lastTickRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  const start = useCallback((timeControl: TimeControl) => {
    setTc(timeControl);
    setState({
      white: timeControl.initialSeconds,
      black: timeControl.initialSeconds,
      activeColor: 'w',
      running: false, // starts running on first move
      flagged: null,
    });
  }, []);

  const stop = useCallback(() => {
    setState((s) => ({ ...s, running: false, activeColor: null }));
  }, []);

  const disable = useCallback(() => {
    setTc(null);
    setState({ white: 0, black: 0, activeColor: null, running: false, flagged: null });
  }, []);

  // Called after a move — switches active side and applies increment
  const pressMove = useCallback(
    (mover: 'w' | 'b') => {
      setState((s) => {
        if (!tc) return s;
        const incremented = s[mover === 'w' ? 'white' : 'black'] + tc.incrementSeconds;
        const next = { ...s };
        if (mover === 'w') next.white = incremented;
        else next.black = incremented;
        next.activeColor = mover === 'w' ? 'b' : 'w';
        next.running = true;
        return next;
      });
    },
    [tc]
  );

  // Tick down active clock
  useEffect(() => {
    if (!state.running || !state.activeColor || state.flagged) return;

    lastTickRef.current = performance.now();

    const tick = () => {
      const now = performance.now();
      const elapsed = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      setState((s) => {
        if (!s.running || !s.activeColor || s.flagged) return s;
        const key = s.activeColor === 'w' ? 'white' : 'black';
        const next = Math.max(0, s[key] - elapsed);
        if (next === 0) {
          onFlag?.(s.activeColor);
          return { ...s, [key]: 0, running: false, flagged: s.activeColor };
        }
        return { ...s, [key]: next };
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [state.running, state.activeColor, state.flagged, onFlag]);

  return { tc, state, start, stop, disable, pressMove };
}

export function formatTime(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const totalDeci = Math.floor(seconds * 10);
  const mins = Math.floor(totalDeci / 600);
  const secs = Math.floor((totalDeci % 600) / 10);
  const deci = totalDeci % 10;
  if (seconds < 10) {
    return `${mins}:${secs.toString().padStart(2, '0')}.${deci}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
