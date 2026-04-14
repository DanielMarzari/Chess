'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export type OpponentColor = 'white' | 'black' | 'random';

interface BestMove {
  from: string;
  to: string;
  promotion?: string;
}

export function useOpponent() {
  const [enabled, setEnabled] = useState(false);
  const [color, setColor] = useState<OpponentColor>('black'); // color THE COMPUTER plays
  const [elo, setElo] = useState(1500);
  const [isThinking, setIsThinking] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const callbackRef = useRef<((move: BestMove) => void) | null>(null);

  const initWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    try {
      const worker = new Worker('/stockfish/stockfish.js');
      workerRef.current = worker;

      worker.onmessage = (e) => {
        const msg = e.data as string;
        if (typeof msg !== 'string') return;

        if (msg.startsWith('bestmove')) {
          const parts = msg.split(' ');
          const moveStr = parts[1];
          if (moveStr && moveStr !== '(none)') {
            const move: BestMove = {
              from: moveStr.slice(0, 2),
              to: moveStr.slice(2, 4),
              promotion: moveStr.length > 4 ? moveStr.slice(4, 5) : undefined,
            };
            if (callbackRef.current) {
              callbackRef.current(move);
              callbackRef.current = null;
            }
          }
          setIsThinking(false);
        }
      };

      worker.postMessage('uci');
      worker.postMessage('isready');
      return worker;
    } catch {
      console.error('Failed to load Stockfish opponent');
      return null;
    }
  }, []);

  // Configure engine strength whenever ELO changes
  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;

    // Map ELO to Skill Level (0-20) and also set UCI_Elo
    // Skill Level mapping approximating ELO:
    // 0 ≈ 800, 5 ≈ 1200, 10 ≈ 1600, 14 ≈ 2000, 17 ≈ 2400, 20 ≈ 2850+
    let skillLevel: number;
    if (elo <= 800) skillLevel = 0;
    else if (elo <= 1000) skillLevel = 2;
    else if (elo <= 1200) skillLevel = 5;
    else if (elo <= 1400) skillLevel = 8;
    else if (elo <= 1600) skillLevel = 10;
    else if (elo <= 1800) skillLevel = 12;
    else if (elo <= 2000) skillLevel = 14;
    else if (elo <= 2200) skillLevel = 15;
    else if (elo <= 2400) skillLevel = 17;
    else if (elo <= 2600) skillLevel = 18;
    else if (elo <= 2800) skillLevel = 19;
    else skillLevel = 20;

    worker.postMessage(`setoption name Skill Level value ${skillLevel}`);
    worker.postMessage('setoption name UCI_LimitStrength value true');
    worker.postMessage(`setoption name UCI_Elo value ${Math.max(1320, Math.min(3190, elo))}`);
  }, [elo]);

  const requestMove = useCallback(
    (fen: string, onMove: (move: BestMove) => void) => {
      const worker = workerRef.current || initWorker();
      if (!worker) return;

      callbackRef.current = onMove;
      setIsThinking(true);

      // Configure strength again to be safe
      worker.postMessage('stop');
      worker.postMessage(`position fen ${fen}`);

      // Lower ELO = shallower search, more variability
      const moveTime = elo < 1200 ? 100 : elo < 1800 ? 300 : elo < 2400 ? 800 : 1500;
      worker.postMessage(`go movetime ${moveTime}`);
    },
    [elo, initWorker]
  );

  const cancelMove = useCallback(() => {
    workerRef.current?.postMessage('stop');
    callbackRef.current = null;
    setIsThinking(false);
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      if (!next) {
        workerRef.current?.postMessage('stop');
        callbackRef.current = null;
        setIsThinking(false);
      } else if (!workerRef.current) {
        initWorker();
      }
      return next;
    });
  }, [initWorker]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  return {
    enabled,
    toggle,
    color,
    setColor,
    elo,
    setElo,
    isThinking,
    requestMove,
    cancelMove,
  };
}
