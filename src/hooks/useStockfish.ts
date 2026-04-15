'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export interface EngineLineInfo {
  depth: number;
  score: number; // white's perspective
  mate: number | null;
  pv: string;
}

export interface BestMove {
  from: string;
  to: string;
  promotion?: string;
}

export type OpponentColor = 'white' | 'black' | 'random';

function eloToSkill(elo: number): number {
  if (elo <= 800) return 0;
  if (elo <= 1000) return 2;
  if (elo <= 1200) return 5;
  if (elo <= 1400) return 8;
  if (elo <= 1600) return 10;
  if (elo <= 1800) return 12;
  if (elo <= 2000) return 14;
  if (elo <= 2200) return 15;
  if (elo <= 2400) return 17;
  if (elo <= 2600) return 18;
  if (elo <= 2800) return 19;
  return 20;
}

function eloMoveTime(elo: number): number {
  if (elo < 1000) return 80;
  if (elo < 1200) return 120;
  if (elo < 1400) return 200;
  if (elo < 1600) return 350;
  if (elo < 1800) return 500;
  if (elo < 2000) return 700;
  if (elo < 2200) return 900;
  if (elo < 2400) return 1100;
  return 1400;
}

type Mode = 'idle' | 'analysis' | 'move';

/**
 * Single Stockfish worker shared between analysis and opponent-move calculation.
 * Modes:
 *   - 'analysis': continuous infinite-depth search for current position, emits info lines
 *   - 'move': one-shot limited search for opponent, emits bestmove
 *   - 'idle': no active search
 *
 * Opponent requests preempt analysis; after the opponent move is returned,
 * analysis resumes on whatever the current analysis position is.
 */
export function useStockfish() {
  // Analysis state
  const [lines, setLines] = useState<EngineLineInfo[]>([]);
  const [depth, setDepth] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isComputerThinking, setIsComputerThinking] = useState(false);

  // Opponent state
  const [opponentEnabled, setOpponentEnabled] = useState(false);
  const [opponentColor, setOpponentColor] = useState<OpponentColor>('black');
  const [elo, setElo] = useState(1500);

  // Worker + internal state
  const workerRef = useRef<Worker | null>(null);
  const modeRef = useRef<Mode>('idle');
  const analysisFenRef = useRef<string | null>(null);
  const analysisTurnRef = useRef<'w' | 'b'>('w');
  const moveFenRef = useRef<string | null>(null);
  const moveCallbackRef = useRef<((m: BestMove) => void) | null>(null);
  const parsedLinesRef = useRef<Map<number, EngineLineInfo>>(new Map());

  // Sends a command, optionally a gated batch
  const send = (cmd: string) => {
    workerRef.current?.postMessage(cmd);
  };

  // Begin analyzing the stored analysisFen
  const startAnalysis = useCallback(() => {
    const fen = analysisFenRef.current;
    if (!fen) return;
    parsedLinesRef.current.clear();
    setLines([]);
    setDepth(0);
    setIsAnalyzing(true);
    modeRef.current = 'analysis';
    send('setoption name MultiPV value 3');
    send('setoption name UCI_LimitStrength value false');
    send('setoption name Skill Level value 20');
    send(`position fen ${fen}`);
    send('go depth 22');
  }, []);

  // Kick off an opponent move request
  const startOpponentMove = useCallback(() => {
    const fen = moveFenRef.current;
    if (!fen) return;
    setIsComputerThinking(true);
    modeRef.current = 'move';
    send('setoption name MultiPV value 1');
    send(`setoption name Skill Level value ${eloToSkill(elo)}`);
    if (elo >= 1320) {
      send('setoption name UCI_LimitStrength value true');
      send(`setoption name UCI_Elo value ${Math.min(3190, elo)}`);
    } else {
      send('setoption name UCI_LimitStrength value false');
    }
    send(`position fen ${fen}`);
    send(`go movetime ${eloMoveTime(elo)}`);
  }, [elo]);

  // Initialize worker once
  useEffect(() => {
    try {
      const worker = new Worker('/stockfish/stockfish.js');
      workerRef.current = worker;

      worker.onmessage = (e) => {
        const msg = e.data as string;
        if (typeof msg !== 'string') return;

        if (msg.startsWith('info') && msg.includes('depth') && msg.includes(' pv ')) {
          if (modeRef.current !== 'analysis') return; // ignore info during move search
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
          const sign = analysisTurnRef.current === 'w' ? 1 : -1;

          let mate: number | null = null;
          if (scoreType === 'mate') {
            mate = rawScore * sign;
            rawScore = rawScore > 0 ? 10000 : -10000;
          }
          const score = rawScore * sign;
          const pv = parts.slice(pvIdx + 1).join(' ');

          parsedLinesRef.current.set(lineNum, { depth: d, score, mate, pv });
          setDepth(d);
          const sorted = Array.from(parsedLinesRef.current.entries())
            .sort((a, b) => a[0] - b[0])
            .map((entry) => entry[1]);
          setLines([...sorted]);
        }

        if (msg.startsWith('bestmove')) {
          if (modeRef.current === 'move' && moveCallbackRef.current) {
            const parts = msg.split(' ');
            const moveStr = parts[1];
            if (moveStr && moveStr !== '(none)') {
              const move: BestMove = {
                from: moveStr.slice(0, 2),
                to: moveStr.slice(2, 4),
                promotion: moveStr.length > 4 ? moveStr.slice(4, 5) : undefined,
              };
              try {
                moveCallbackRef.current(move);
              } catch {
                // noop
              }
            }
            moveCallbackRef.current = null;
            moveFenRef.current = null;
            setIsComputerThinking(false);
            modeRef.current = 'idle';
            // Resume analysis if we have a position to analyze
            if (analysisFenRef.current) {
              setTimeout(() => startAnalysis(), 50);
            }
          } else if (modeRef.current === 'analysis') {
            // Analysis hit max depth; just mark as finished
            setIsAnalyzing(false);
            modeRef.current = 'idle';
          }
        }
      };

      worker.postMessage('uci');
      worker.postMessage('setoption name MultiPV value 3');
      worker.postMessage('isready');
    } catch (e) {
      console.error('Failed to init Stockfish:', e);
    }

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [startAnalysis]);

  // Public API

  const analyze = useCallback(
    (fen: string) => {
      analysisFenRef.current = fen;
      analysisTurnRef.current = fen.split(' ')[1] === 'b' ? 'b' : 'w';
      // If in move mode, let the move finish first; its bestmove handler will resume analysis
      if (modeRef.current === 'move') return;
      // Stop whatever's running; when bestmove arrives we don't care, we'll start fresh
      send('stop');
      // Give the engine a tick to quiesce, then start analysis
      setTimeout(() => {
        if (modeRef.current === 'move') return;
        startAnalysis();
      }, 30);
    },
    [startAnalysis]
  );

  const requestMove = useCallback(
    (fen: string, onMove: (m: BestMove) => void) => {
      moveFenRef.current = fen;
      moveCallbackRef.current = onMove;
      // Interrupt analysis
      send('stop');
      setTimeout(() => startOpponentMove(), 30);
    },
    [startOpponentMove]
  );

  const cancelMove = useCallback(() => {
    if (modeRef.current === 'move') {
      send('stop');
      moveCallbackRef.current = null;
      moveFenRef.current = null;
      setIsComputerThinking(false);
      modeRef.current = 'idle';
      if (analysisFenRef.current) setTimeout(() => startAnalysis(), 50);
    }
  }, [startAnalysis]);

  const toggleOpponent = useCallback(() => {
    setOpponentEnabled((prev) => {
      if (prev) cancelMove();
      return !prev;
    });
  }, [cancelMove]);

  return {
    // Analysis
    lines,
    depth,
    isAnalyzing,
    analyze,
    // Opponent
    opponentEnabled,
    toggleOpponent,
    opponentColor,
    setOpponentColor,
    elo,
    setElo,
    isComputerThinking,
    requestMove,
    cancelMove,
  };
}
