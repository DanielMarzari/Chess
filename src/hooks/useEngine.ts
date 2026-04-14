'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { EngineLineInfo } from '@/components/EngineAnalysis';

export function useEngine() {
  const [lines, setLines] = useState<EngineLineInfo[]>([]);
  const [depth, setDepth] = useState(0);
  const [isThinking, setIsThinking] = useState(false);
  const [ready, setReady] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const pendingFen = useRef<string | null>(null);
  const currentTurnRef = useRef<'w' | 'b'>('w');

  const initWorker = useCallback(() => {
    if (workerRef.current) return;

    try {
      const worker = new Worker('/stockfish/stockfish.js');
      workerRef.current = worker;

      const parsedLines: Map<number, EngineLineInfo> = new Map();

      worker.onmessage = (e) => {
        const msg = e.data as string;
        if (typeof msg !== 'string') return;

        if (msg === 'uciok' || msg.startsWith('readyok')) {
          setReady(true);
        }

        if (msg.startsWith('info') && msg.includes('depth') && msg.includes(' pv ')) {
          const parts = msg.split(' ');
          const depthIdx = parts.indexOf('depth');
          const scoreIdx = parts.indexOf('score');
          const pvIdx = parts.indexOf('pv');
          const multipvIdx = parts.indexOf('multipv');

          if (depthIdx === -1 || scoreIdx === -1 || pvIdx === -1) return;

          const d = parseInt(parts[depthIdx + 1]);
          const lineNum = multipvIdx !== -1 ? parseInt(parts[multipvIdx + 1]) : 1;
          const scoreType = parts[scoreIdx + 1];
          let rawScore = parseInt(parts[scoreIdx + 2]);

          // Normalize to white's perspective
          const sign = currentTurnRef.current === 'w' ? 1 : -1;

          let mate: number | null = null;
          if (scoreType === 'mate') {
            mate = rawScore * sign;
            rawScore = rawScore > 0 ? 10000 : -10000;
          }
          const score = rawScore * sign;

          const pv = parts.slice(pvIdx + 1).join(' ');

          parsedLines.set(lineNum, { depth: d, score, mate, pv });
          setDepth(d);

          const sorted = Array.from(parsedLines.entries())
            .sort((a, b) => a[0] - b[0])
            .map((entry) => entry[1]);
          setLines([...sorted]);
        }

        if (msg.startsWith('bestmove')) {
          setIsThinking(false);
          parsedLines.clear();
        }
      };

      worker.postMessage('uci');
      worker.postMessage('setoption name MultiPV value 3');
      worker.postMessage('isready');

      if (pendingFen.current) {
        const fen = pendingFen.current;
        pendingFen.current = null;
        setTimeout(() => {
          worker.postMessage('stop');
          worker.postMessage(`position fen ${fen}`);
          worker.postMessage('go depth 22');
          setIsThinking(true);
        }, 200);
      }
    } catch {
      console.error('Failed to load Stockfish');
    }
  }, []);

  const analyze = useCallback(
    (fen: string) => {
      // Extract turn from FEN (second field)
      const turn = fen.split(' ')[1] === 'b' ? 'b' : 'w';
      currentTurnRef.current = turn;

      const worker = workerRef.current;
      if (!worker) {
        pendingFen.current = fen;
        initWorker();
        return;
      }

      setLines([]);
      setDepth(0);
      setIsThinking(true);
      worker.postMessage('stop');
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage('go depth 22');
    },
    [initWorker]
  );

  useEffect(() => {
    initWorker();
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [initWorker]);

  return { lines, depth, isThinking, ready, analyze };
}
