'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { EngineLineInfo } from '@/components/EngineAnalysis';

export function useEngine() {
  const [enabled, setEnabled] = useState(false);
  const [lines, setLines] = useState<EngineLineInfo[]>([]);
  const [depth, setDepth] = useState(0);
  const [isThinking, setIsThinking] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const pendingFen = useRef<string | null>(null);

  const initWorker = useCallback(() => {
    if (workerRef.current) return;

    try {
      const worker = new Worker('/stockfish/stockfish.js');
      workerRef.current = worker;

      const parsedLines: Map<number, EngineLineInfo> = new Map();

      worker.onmessage = (e) => {
        const msg = e.data as string;

        if (msg.startsWith('info depth')) {
          const parts = msg.split(' ');
          const depthIdx = parts.indexOf('depth');
          const scoreIdx = parts.indexOf('score');
          const pvIdx = parts.indexOf('pv');
          const multipvIdx = parts.indexOf('multipv');

          if (depthIdx === -1 || scoreIdx === -1 || pvIdx === -1) return;

          const d = parseInt(parts[depthIdx + 1]);
          const lineNum = multipvIdx !== -1 ? parseInt(parts[multipvIdx + 1]) : 1;
          const scoreType = parts[scoreIdx + 1];
          let score = parseInt(parts[scoreIdx + 2]);
          let mate: number | null = null;

          if (scoreType === 'mate') {
            mate = score;
            score = score > 0 ? 10000 : -10000;
          }

          const pv = parts.slice(pvIdx + 1).join(' ');

          parsedLines.set(lineNum, { depth: d, score, mate, pv });
          setDepth(d);

          const sorted = Array.from(parsedLines.values()).sort((a, b) => b.score - a.score);
          setLines([...sorted]);
        }

        if (msg.startsWith('bestmove')) {
          setIsThinking(false);
        }
      };

      worker.postMessage('uci');
      worker.postMessage('setoption name MultiPV value 3');
      worker.postMessage('isready');

      // If there's a pending position, analyze it
      if (pendingFen.current) {
        const fen = pendingFen.current;
        pendingFen.current = null;
        setTimeout(() => {
          worker.postMessage('stop');
          worker.postMessage(`position fen ${fen}`);
          worker.postMessage('go depth 20');
          setIsThinking(true);
        }, 100);
      }
    } catch {
      console.error('Failed to load Stockfish');
    }
  }, []);

  const analyze = useCallback(
    (fen: string) => {
      if (!enabled) return;

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
      worker.postMessage('go depth 20');
    },
    [enabled, initWorker]
  );

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      if (!next && workerRef.current) {
        workerRef.current.postMessage('stop');
        setLines([]);
        setDepth(0);
        setIsThinking(false);
      }
      if (next && !workerRef.current) {
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

  return { enabled, lines, depth, isThinking, analyze, toggle };
}
